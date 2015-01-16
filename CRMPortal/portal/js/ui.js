/**
 * This is a rapidly developed UI for the CRM Incident on the Paraature Portal.
 * It takes the place of Parature Portal elements which are populated server side, and renders a similar UI using Javascript
 * Sadly, we do not have much access to the server templating system (beyond inserting some simple DOM placeholders, JS, and CSS), so JS is the preferred method
 * 
 * Ultimately, we recommend moving to a templating system
 * 
 * Dependencies:
 *  - jQuery (1.8+, recommend 1.10+)
 *  - LoDash (tested with 2.4.2)
 *  - jQuery.DataTables (tested with 1.10.2)
 *  - Moment.js (tested with 2.8.2)
 */

var detailsModal; //Modal used for Case details. Populated in the "details" event
//CRM saved queries
var caseTableCrmView = 'P2CCaseView';
var caseCreateCrmView = 'PortalCaseCreate';
var caseDetailsCrmView = 'PortalCaseDetails';
var commentsTableCrmView = 'P2C_PortalView';
var commentCreateCrmView = 'P2C_PortalCreateComment';
//DOM level text or classes
var loadingClass = 'p2c-loading';
var caseCreateSuccessText = "Case created successfully.";

/*
 * Creates the the table of Cases for this user. 
 * It's placed before the Table on myhistory.asp and mytickets.asp (both of which are hidden)
 *  - during load, it will have a class of "p2c-loading"
 *  - Queries the remove WebService server to CRM info (entities, metadata, saved view)
 *  - Builds the table DOM and inserts the Cases into it
 */
$.p2c.ready(function() {
    var incidentList;
    var incidentMetadata;
    var listView;
    var listViewSort;
    var divWrapper = $('<div id="p2c-cases" class="' + loadingClass + '" />');

    //List
    var viewForm = $('div#myTicketHistory, form#myTicketSearchForm');
    if (viewForm.length < 1) {
        //no form found, not on the right page
        return;
    }
    
    //insert the wrapper where all other DOM will be inserted
    divWrapper.insertBefore(viewForm);

    //wait for all three ajax calls to finish
    // Once done, build the table and insert into the wrapper div
    $.when(_getIncidents(), p2cUtil.getIncidentMetadata(), p2cUtil.getSavedView(caseTableCrmView))
    .done(function(inc, meta, view) {
        //We got all the Ajax data. remove the loader class
        divWrapper.removeClass(loadingClass);

        //Push the raw data back to the above variables so we don't have to pass them around
        incidentMetadata = meta[0];
        listView = getViewArr(view[0]);
        listViewSort = getViewOrder(view[0]); // Data

        //Convert the raw JSON to classes.
        var rawList = inc[0]['Entities']['$values'] || [];
        incidentList = [];
        for (var i = 0; i < rawList.length; i++) {
            var entity = new Entity(rawList[i], incidentMetadata);
            incidentList.push(entity);
        }

        //build the datatable
        var labelArr = p2cUtil.getFriendlyAttributeNames(incidentMetadata, listView); //grab Labels for Attributes. Used to create column headers
        var table = _getViewTable(labelArr); //build the table structure (no data yet)
        table.appendTo(divWrapper); //Insert before data population. Otherwise paging controls won't be added by DataTables.
        _populateViewTable(table, incidentList, labelArr); // insert the data into the table
    });

    /*
     * Ajax
     */
    function _getIncidents() {
        return $.p2c({
            url: "entity/incident",
            type: "get",
        });
    }

    /*
     * View Helpers. Create DOM and build templates
     */
    function _populateViewTable(table, entities, labelArr) {
        //Map the data into simple objects data tables can understand...
        //data is array of objects, wich are k-v pairs {logicalName: displayValue}
        var dataRows = _.map(entities, function(ent) {
            var obj = {};

            for (var i = 0; i < listView.length; i++) {
                var logicalName = listView[i];
                var val = ent.getAttribute(logicalName).getDisplay();

                obj[logicalName] = val;
            }

            return obj;
        });

        //grab so we can retrieve a type if it exists
        var ent = entities.length > 0
            ? entities[0]
            : undefined;
        //row definitions specify the data (in above object) and their friendly title
        var rowDef = _.map(labelArr, function(attr) {
            var logicalName = Object.keys(attr)[0];
            var ret = {
                'data': logicalName,
                'title': attr[logicalName]
            }

            if (ent != undefined) {
                var type = ent.getAttribute(logicalName).type;
                ret['type'] = type;
            }

            return ret;
        });

        //map to the array format datatables expects for ordering
        var colOrder = p2cUtil.getTableViewOrder(listView, listViewSort);

        table.dataTable({
            data: dataRows,
            columns: rowDef,
            order: colOrder,
            pageLength: 5, //5 results per page
            lengthMenu: [[5, 10, 25, 50, -1], [5, 10, 25, 50, "All"]],
            'fnCreatedRow': function(nRow, aData, iDataIndex) {
                $(nRow).children().each(function(index) {
                    var data = $(this);
                    data.attr('data-logicalname', rowDef[index]['data']);

                    //Trigger event for Details
                    if (rowDef[index]['data'] == "ticketnumber") {
                        data.on('click', function() {
                            var ticketnumber = $(this).text();
                            
                            var inc = _.find(incidentList, function(inc) { 
                                return inc.getAttribute('ticketnumber').val == ticketnumber; 
                            });

                            $.p2c.evs.trigger('details', [inc.guid, incidentMetadata]);
                        });
                    }
                });
            }
        });
    }

    function _getViewTable(labelArr) {
        var columns = $('<tr />');
    
        for(var i = 0; i < labelArr.length; i++) {
            var logicalName = Object.keys(labelArr[i])[0];
            var label = labelArr[i][logicalName];
        
            var col = $('<th />')
                .text(label)
                .attr({
                    'data-logicalname': logicalName,
                });
            columns.append(col);
        }
    
        columns = $('<thead />').append(columns);
        var table = $('<table class="tableList ticketlist" id="viewTable" />');
        return table;
    }
});

/*
 * Creates the Case form for creation from the portal
 * It's placed before the parature Ticket form (ticketnewwizard.asp)
 * 
 */
$.p2c.ready(function() {  
    //Private variables we want to hold onto so we don't need to pass them around
    var createView;
    var incidentMetadata;
    var form;
    var submit;
    var easyAnswerContainer;

    //Creation
    var createForm = $('form[action="ticketNewProcess.asp"]');
    if (createForm.length < 1) {
        //not on the correct page
        return;
    }

    //insert the form we'll use
    form = $('<form id="caseCreate" class="' + loadingClass + '"></form>');
    form.insertBefore('form[action="ticketNewProcess.asp"]');

    $.when(p2cUtil.getSavedView(caseCreateCrmView), p2cUtil.getIncidentMetadata())
    .done(function(viewData, metaData) {
        form.removeClass(loadingClass);
        //Parse the saved query data to get the attributes displayed and the order
        createView = p2cUtil.getViewArr(viewData[0]);
        //metadata
        incidentMetadata = metaData[0];

        /*
         * Start building the DOM
         */
        //Retreve the input elements in the form
        var fields = p2cUtil.getFormFields(createView, incidentMetadata);
        form.append(fields);
        //Add an additional submit button at the end. Bind an event to it to tear everything down at the end.
        submit = p2cUtil.addSubmitButton(form, incidentMetadata, function(data) {
            //DOM
            var confirmation = $('<div id="createCaseConf">');
            confirmation.attr('data-incidentid', data);
            confirmation.text(caseCreateSuccessText);

            confirmation.insertBefore(form);
            form.remove();
            submit.remove();

            //clear easy answer results and remove it too
            easyAnswerContainer.children().remove();
        });

        //Easy Answer Scaffolding.
        easyAnswerContainer = $('<div id="EasyAnswerContainer">')
            .insertBefore(submit);
        var formInputs = form.find('input, textarea');

        //bind event - When values change, search the KB
        formInputs.on('change', function() {
            easyAnswerContainer.children().remove(); //clear container
            var inputArr = [];

            //push the text value from each element to search the KB
            formInputs.each(function(index, input) {
                inputArr.push($(input).val());
            });

            //Asynchronously search the KB
            var search = _searchKb(inputArr);
            search.done(function(data) {
                //parse out the search results
                var results = $('.searchResults', data).outerHTML();
                //display the results
                easyAnswerContainer.append(results);
            });
        });
    });

    /* Easy Answer Clone */
    function _searchKb(textArr) {
        var kbUrl = "//" + location.hostname
            + "/ics/support/KBResult.asp?"
            + "searchOption=anywords&questionID=&searchTime=-1&" 
            + "task=knowledge&resultLimit=50&pageContentIdentifier=&submitsearch=Search&searchFor=";
        
        /*
        * Case details passed in as an array of strings.
        * Add spaces between each index and then uri encode for search
        */
        var str = "";
        for (var i = 0; i < textArr.length; i++) {
            str += textArr[i] + " ";
        }

        kbUrl += encodeURIComponent(str);

        return $.get(kbUrl);
    }
});

/*
 * Additional informatin on Cases are available in a Modal.
 * This is a separate CRM view which governs the attributes to display. May be totally different than the Table list.
 * In the table, case numbers are clickable elements which will trigger an internal "details" event. 
 *  - It passes along the guid of the case for lookup. It invokes another Case lookup
 * 
 * Loads Case Comments after loading the Case. More details in the next section
 */
$.p2c.evs.on('details', function(ev, guid, incidentMetadata) {
    var detailsView;
    var detailsViewSort;
    var labelArr;
    
    //create modal to display the case details. Remove if one exists already
    if ($(detailsModal).length > 0) {
        $(detailsModal).remove();
    }

    _createModalDiv();
   
    //wait for the multiple ajax to finish
    $.when(getSavedView('PortalCaseDetails'), getEntity('incident', guid))
    .done(function(view, entity) {
        detailsModal.removeClass(loadingClass);
        //save for later
        detailsView = p2cUtil.getViewArr(view[0]);
        detailsViewSort = p2cUtil.getViewOrder(view[0]);

        //We want the first entity returned. Should only be one
        var inc = entity[0];

        /*
         * DOM
         */
        labelArr = p2cUtil.getFriendlyAttributeNames(incidentMetadata, detailsView); //need to know the display label for attributes
        var form = _createForm();
        var fields = _populateForm(inc, labelArr);
        form.append(fields);

        //Trigger the loading of case comments associated to this Case
        $.p2c.evs.trigger('caseComments', [inc.Id, incidentMetadata]);
    });

    /*
     * Helper functions
     */
    //DOM
    function _createModalDiv() {
        //Create and add the DOM container
        detailsModal = $('<div id="caseDetails" class="' + loadingClass + '">' +
            '<div id="frameContents" style="width: 100%;"></div>' +
            '<span id="detailsClose">X</span>' +
        '</div>')
            .appendTo('body');

        //Event listener to remove the modal when the customer clicks the button
        detailsModal.find('#detailsClose').on('click', function() {
            var container = detailsModal.children('div#frameContents');
            container.children().remove();
            detailsModal.addClass('hidden');
            //reshow the modal
            detailsModal.children("img.loader").removeClass('hidden');
        });
    }

    function _createForm() {
        //create a form and append
        var form = $('<form id="caseDetails" />');
        form.appendTo(detailsModal.find('#frameContents'));
        return form;
    }

    function _populateForm(inc) {
        var incident = new Entity(inc, incidentMetadata);
        var attributes = incident.getViewAttributes(detailsView);
    
        var fields = $('<div />');
        for(var i = 0; i < attributes.length; i++) {
            var a = attributes[i];
        
            var fieldset = $('<div class="fieldset"/>')
                .attr('data-logicalName', a.logicalName)
                .append(
                    $('<label></label>')
                        .text(a.label)
                )
                .append(a.getViewHtml());
            
            fields.append(fieldset);
        }
    
        return fields.children();
    }
});

/*
 * Triggered in the "details" section event handler above.
 *  
 * We've added a custom Entity called "Case Comments" to CRM (if the solution is installed).
 * Also loaded in the Modal. 
 *  - Part of the Activity Feed for Cases
 *  - Meant for internaly/external communication with CSRs. Customers can create comments, as can CSRs.
 *  - Not entirely built-out. Do not currently respect internal vs external comments nor attachments.
 */
$.p2c.evs.on('caseComments', function(ev, id, incMetadata) {
    $('div#tabContainer').remove();
    var tabWrapper = $('<div id="tabContainer"><ul class="tabsMenu"></ul><div class="tabs"></div>');
    var commentView;
    var commentViewOrder;
    var commentCreateView;

    //Wait for all AJAX to complete. Need to retrieve a bunch of 
    $.when(p2cUtil.getRelatedEntities('incident', id, 'new_casecomments'),
            p2cUtil.getSavedView(commentsTableCrmView),
            p2cUtil.getCommentsMetadata(),
            p2cUtil.getSavedView(commentCreateCrmView))
        .done(function(commentsList, view, meta, createView) {
            //metadata
            var commentsMetadata = meta[0];
            //comments list - convert to the Entity Class (classes.js)
            var rawComments = commentsList[0].Entities.$values;
            var comments = [];
            for (var i = 0; i < rawComments.length; i++) {
                var comm = new Entity(rawComments[i], commentsMetadata);
                comments.push(comm);
            }

            //get the views and sorting of columns
            commentView = p2cUtil.getViewArr(view[0]);
            commentViewOrder = getViewOrder(view[0]);
            commentCreateView = p2cUtil.getViewArr(createView[0]);

            /*
             * DOM
             */
            var labelArr = p2cUtil.getFriendlyAttributeNames(commentsMetadata, commentView);
            var table = _getTable(labelArr); //build the table using the label array
            //NOTE: On successful submission of a comment, the comments area is torn down and reloaded
            var createForm = $('<form />')
                .append(getFormFields(commentCreateView, commentsMetadata));
            //Add a submit button. Will retrigger the Case Comments area after submission so it gets reloaded
            _addRelatedSubmitButton(createForm, incMetadata, id, commentsMetadata, function() {
                $.p2c.evs.trigger('caseComments', [id, incMetadata]);
            });

            tabWrapper.appendTo(detailsModal.find('#frameContents'));
            _addTab("All Comments", table);
            _addTab("Submit Comment", createForm);

            _populateViewTable(table, comments, labelArr);
            _initTabs();
    });

    /*
    * View Helpers. Creates DOM
    */
    function _getTable(labelArr) {
        var columns = $('<tr />');

        for (var i = 0; i < labelArr.length; i++) {
            var logicalName = Object.keys(labelArr[i])[0];
            var label = labelArr[i][logicalName];

            var col = $('<th />')
                .text(label)
                .attr({
                    'data-logicalname': logicalName,
                });
            columns.append(col);
        }

        columns = $('<thead />').append(columns);
        var table = $('<table class="tableList" id="commentsTable" />').append(columns);
        return table;
    }

    function _populateViewTable(table, entities, labelArr) {
        //Map the data into simple objects data tables can understand...
        //data is array of objects, wich are k-v pairs {logicalName: displayValue}
        var dataRows = _.map(entities, function(ent) {
            var obj = {};

            for (var i = 0; i < commentView.length; i++) {
                var logicalName = commentView[i];
                var val = ent.getAttribute(logicalName).getDisplay();

                obj[logicalName] = val;
            }

            return obj;
        });

        //row definitions specify the data (in above object) and their friendly title
        var rowDef = _.map(labelArr, function(attr) {
            var logicalName = Object.keys(attr)[0];

            return {
                'data': logicalName,
                'title': attr[logicalName]
            }
        });

        //map to the array format datatables expects for ordering
        var colOrder = p2cUtil.getTableViewOrder(commentView, commentViewOrder);

        table.dataTable({
            data: dataRows,
            columns: rowDef,
            order: colOrder,
            pageLength: 3, //5 results per page
            lengthMenu: [[3, 5], [3, 5]],
            'fnCreatedRow': function(nRow, aData, iDataIndex) {
                $(nRow).children().each(function(index) {
                    var data = $(this);
                    data.attr('data-logicalname', rowDef[index]['data']);
                });
            }
        });
    }

    //Build tabs to switch between the comments table and the cretion form
    function _addTab(label, elems) {
        var count = tabWrapper.find('ul.tabsMenu').children().length;
        
        //label on tab
        tabWrapper.find('ul.tabsMenu').append('<li><a href="#tab-' + count + '">' + label + '</a></li>');
        
        //tab contents
        var tab = $('<div id="tab-' + count + '" class="tabContent"></div>');
        tab.append(elems);
        tabWrapper.find('div.tabs').append(tab);
    }

    //Add events to the forms so they can be clicked on
    function _initTabs() {
        tabWrapper.find('ul.tabsMenu li').eq(0).addClass('current');
        tabWrapper.find('.tabContent').eq(0).show();

        //prevent incorrect events firing and redirecting
        tabWrapper.find("ul.tabsMenu a").click(function(event) {
            event.preventDefault();
            $(this).parent().addClass("current");
            $(this).parent().siblings().removeClass("current");
            var tab = $(this).attr("href");
            tabWrapper.find(".tabContent").not(tab).css("display", "none");
            $(tab).show();
        });
    }
    
    function _addRelatedSubmitButton(form, parentMeta, parentGuid, metadata, onConfirm) {
        var submit = $('<button type="button" class="crmSubmit">Submit</submit>');
        submit.appendTo(form);

        submit.on('click', function() {
            var vals = form.serializeArray();
            formDisabledState(form, 'disabled');

            //validate
            var successfulValidation = validValues(vals, metadata);
            if (!successfulValidation) {
                alert("Invalid Fields set in the form. Please correct.");
                formDisabledState(form, ''); //reenable
                return false;
            }

            //turn into our class object
            var insertEnt = createInsertObj(vals, metadata);

            //create the case
            p2cUtil.createRelatedEntity(parentMeta['LogicalName'], parentGuid, metadata['LogicalName'], insertEnt)
                .done(function(data, status) {
                    onConfirm(data);
                    return false;
                })
                .fail(function(data, status) {
                    form.remove();
                    submit.remove();
                });
        });

        return submit;
    }

});

/*
 * Helper and AJAX functions under the p2cUtil namespace.
 * These functions were all used multiple times and proved useful to keep separate and hidden during development
 */
(function( ns, $ ) {
    /*
     * Private Variables
     */
    var _p2cSessStoreId = "%P2C%_";

    /*
     * Public Functions
     * 
     */
    ns.getFriendlyAttributeNames = function(entMetadata, view) {
        var nameObj = [];
        var attributes = entMetadata.Attributes.$values;

        //attributes
        for (var i = 0; i < attributes.length; i++) {
            var attr = attributes[i];

            if (view.indexOf(attr['LogicalName']) > -1) {
                var obj = {};
                var key = attr['LogicalName'];
                var val = attr['DisplayName']['UserLocalizedLabel']['Label'];
                obj[key] = val;
                nameObj.push(obj);
            }
        }

        //preserve original view
        nameObj = _.sortBy(nameObj, function(attr) {
            var index = _.indexOf(view, Object.keys(attr)[0]);
            return index;
        });

        return nameObj;
    };

    ns.getIncidentMetadata = function() {
        //adding a really basic caching layer using sessionStorage API
        //resets after closing of browser
        var def = $.Deferred(); 
        var key = 'metadata/incident'; //saved using this key

        var cachedData = p2cSessStoreGet(key);
        if (cachedData == undefined) {
            $.p2c({
                url: "metadata/incident",
                type: "get",
            }).done(function(data) {
                p2cSessStorePut(key, data); //cache
                def.resolve([data]);
            }).fail(function(data) {
                def.reject([data]);
            });
        } else {
            //using an array since that is what is expected by the 'done' function
            def.resolve([cachedData]);
        }

        return def;
    }

    ns.getSavedView = function(viewName) {
        //adding a really basic caching layer using sessionStorage API
        //resets after closing of browser
        var def = $.Deferred(); 
        var key = 'savedquery-' + viewName; //saved using this key

        var cachedData = p2cSessStoreGet(key);
        if (cachedData == undefined) {
            //doesnt exist. Retrieve, cache, and return
            $.p2c({
                url: "savedquery",
                data: { viewName: viewName },
                type: "get",
            }).done(function(data) {
                p2cSessStorePut(key, data); //cache
                def.resolve([data]);
            }).fail(function(data) {
                def.reject([data]);
            });
        } else {
            //using an array since that is what is expected by the 'done' function
            def.resolve([cachedData]);
        }

        return def;
    }

    ns.getCommentsMetadata = function() {
        //adding a really basic caching layer using sessionStorage API
        //resets after closing of browser
        var def = $.Deferred(); 
        var key = 'metadata/new_casecomments'; //saved using this key

        var cachedData = p2cSessStoreGet(key);
        if (cachedData == undefined) {
            $.p2c({
                url: "metadata/new_casecomments",
                type: "get",
            }).done(function(data) {
                p2cSessStorePut(key, data); //cache
                def.resolve([data]);
            }).fail(function(data) {
                def.reject([data]);
            });
        } else {
            //using an array since that is what is expected by the 'done' function
            def.resolve([cachedData]);
        }

        return def;
    }

    ns.getEntity = function(entLogicalName, guid) {
        return $.p2c({
            url: "entity/" + entLogicalName + "/" + guid,
            type: "get",
        });    
    }

    ns.getRelatedEntities = function(mainEntName, id, relatedEntityName) {
        //mainEntName and relatedEntityName are the logical names
        return $.p2c({
            url: "entity/" + mainEntName + "/" + id + "/" + relatedEntityName,
            type: "get",
        });
    }

    //view object is now a complicated XDoc in C#. Map into an array
    ns.getViewArr = function(viewObj) {
        //todo: check for undefined
        return _.map(viewObj.layoutXml.grid.row.cell, function(col) {
            return col['@name'];
        });
    }

    ns.getViewOrder = function(viewObj) {
        //todo: check for undefined
        return viewObj.fetchXml.fetch.entity.order;
    }

    ns.createEntity = function(entLogicalName, attrCollection) {
        return $.p2c({
            url: "entity/" + entLogicalName,
            data: JSON.stringify(attrCollection),
            type: "post",
        });
    }

    ns.createRelatedEntity = function(mainEntLogicalName, guid, entLogicalName, attrCollection) {
        return $.p2c({
            url: "entity/" + mainEntLogicalName + "/" + guid + "/" + entLogicalName,
            data: JSON.stringify(attrCollection),
            type: "post",
        });
    }
    
    //Turn a form back into a JSON object the server will understand
    ns.createInsertObj = function(formValArr, entityMetadata) {
        var arr = {
            '$type': "Microsoft.Xrm.Sdk.AttributeCollection, Microsoft.Xrm.Sdk",
            '$values': []
        };

        //create the attributes, modify with new value, and return
        for (var i = 0; i < formValArr.length; i++) {
            var field = formValArr[i];
            var aMetadata = getAttrMetadata(field['name'], entityMetadata);
            var attr = new Attribute(aMetadata, undefined);
            attr.val = field['value'];

            arr['$values'].push(attr.getUpsertObject());
        }

        return arr;
    }

    //purely for datatables' way of sorting columns.
    ns.getTableViewOrder = function(viewArr, viewSort) {
        //make sure the viewSort is an array
        if (Object.prototype.toString.call(viewSort) !== '[object Array]') {
            viewSort = [viewSort];
        }

        var colOrder = _.map(viewSort, function(attr) {
            var sortType;
            if (attr['@descending'] === "true") {
                sortType = "desc";
            } else if (attr['@descending'] === "false") {
                sortType = "asc";
            } else {
                return false;
            }

            var colIndex = viewArr.indexOf(attr['@attribute']);
            var order = [colIndex, sortType];

            return order;
        });

        return colOrder;
    }

    //create the DOM elements in a form
    ns.getFormFields = function(attrArr, entityMetadata) {
        var dom = $('<div />');
        for (var i = 0; i < attrArr.length; i++) {
            var aMetadata = getAttrMetadata(attrArr[i], entityMetadata);
            var attr = new Attribute(aMetadata, undefined);

            dom.append(attr.getUpsertHtml());
        }
        return dom.children();
    }

    //from the logical name, find the schema for this attribute.
    ns.getAttrMetadata = function(logicalName, entityMetadata) {
        var metList = entityMetadata['Attributes']['$values'];
        
        for(var i = 0; i < metList.length; i++) {
            if(metList[i]['LogicalName'] == logicalName) {
                return metList[i];
            }
        }
    }

    ns.addSubmitButton = function(form, metadata, onConfirm) {
        var submit = $('<button type="button" class="crmSubmit">Submit</submit>');
        submit.appendTo(form);

        submit.on('click', function() {
            var vals = form.serializeArray();
            formDisabledState(form, 'disabled');

            //validate
            var successfulValidation = validValues(vals, metadata);
            if (!successfulValidation) {
                alert("Invalid Fields set in the form. Please correct.");
                formDisabledState(form, ''); //reenable
                return false;
            }

            //turn into our class object
            var insertEnt = createInsertObj(vals, metadata);

            //create the case
            createEntity(metadata['LogicalName'], insertEnt)
                .done(function(data, status) {
                    onConfirm(data);
                })
                .fail(function(data, status) {
                    form.remove();
                    submit.remove();
                });
        });

        return submit;
    }

    ns.validValues = function(formVals, entityMetadata) {
        //turn into Attribute objects, and check validity
        for (var i = 0; i < formVals.length; i++) {
            var field = formVals[i];
            var aMetadata = getAttrMetadata(field['name'], entityMetadata);
            var attr = new Attribute(aMetadata, undefined);
            attr.val = field['value'];

            if (attr.isValid() === false) {
                return false;
            }
        }

        return true;
    }

    ns.formDisabledState = function(form, disabledAttrVal) {
        $(form).find('input, textarea, button, select').prop('disabled', disabledAttrVal);
    }

    
    ns.p2cSessStoreClear = function() {
        var keys = Object.keys(sessionStorage);
        for (var i = 0; i < keys.length; i++) {
            var k = keys[i];

            //remove only if the variable starts with the predetermined string
            if (k.indexOf(_p2cSessStoreId) === 0) {
                delete sessionStorage[k];
            }
        }
    }

    /*
     * Private Functions
     * 
     */
    //Session Storage wrapper. Appends '%P2C%_' for removal on logout 
    var p2cSessStoreGet = function(key) {
        var dataStr = sessionStorage.getItem(_p2cSessStoreId + key);
    
        try {
            var data = JSON.parse(dataStr);
            return data;
        } catch (e) {
        
        }

        return undefined;
    }

    var p2cSessStorePut = function(key, val) {
        var dataStr = JSON.stringify(val);
        //append the predetermined string for uniqueness
        sessionStorage.setItem(_p2cSessStoreId + key, dataStr);
    }

}( window.p2cUtil = window.p2cUtil || {}, jQuery ));

/*
 * Logging out of the portal AND P2C (aka Single Log Out)
 */
$(window).load(function() {
    //Capture the original logout function
    var proxied = window.exitSupport;

    //Override the original logout function so we logout of the portal first
    window.exitSupport = function() {
        //remove cached items from session storage
        p2cUtil.p2cSessStoreClear();

        //set a timeout to log out in 1 second regardless of success or failure
        setTimeout(function() {
            proxied.apply(this, arguments);
        }, 1000);

        //submit logout, then on confirmation/failure, logout normally
        _logoutP2C().done(function() {
            proxied.apply(this, arguments);
        });
    };
  
    function _logoutP2C() {
        return $.p2c({
            url: 'auth',
            type: 'DELETE',
        });
    }
});

/*
 * DataTables alterations - sorting for date/times
 */
//prevent it from Alerting when there is an error. Throw a JS error instead.
$.fn.dataTableExt.sErrMode = "throw";
$.extend(jQuery.fn.dataTableExt.oSort, {
    //custom datetime parsing
    "DateTimeAttributeMetadata-pre": function (a) {
        var x;
        if ($.trim(a) != '') {
            //Parsing using a custom Moment format
            //returns unix (epoch) integrer
            x = moment(a, 'MMMM Do YYYY, h:mm:ss a').unix();
        } else {
            x = 0;
        }
 
        return x;
    },
 
    "DateTimeAttributeMetadata-asc": function (a, b) {
        return a - b;
    },
 
    "DateTimeAttributeMetadata-desc": function (a, b) {
        return b - a;
    }
});