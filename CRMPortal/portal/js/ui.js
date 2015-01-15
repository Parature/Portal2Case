﻿var detailsModal;

//list view
$.p2c.ready(function() {
    var incidentList;
    var incidentMetadata;
    var listView;
    var listViewSort;
    var divWrapper = $('<div id="p2c-cases" class="p2c-loading" />');

    //List
    var viewForm = $('div#myTicketHistory, form#myTicketSearchForm');
    if(viewForm.length > 0) {
        divWrapper.insertBefore(viewForm);

        //wait for all three ajax calls to finish
        //main bulkd of the program
        $.when(getIncidents(), p2cUtil.getIncidentMetadata(), p2cUtil.getSavedView('P2CCaseView'))
        .done(function(inc, meta, view) {
            divWrapper.removeClass('p2c-loading');

            //store for later
            incidentMetadata = meta[0];
            listView = getViewArr(view[0]);
            listViewSort = getViewOrder(view[0]);

            //get list of Entities as class list
            var rawList = inc[0]['Entities']['$values'] || [];
            incidentList = [];
            for (var i = 0; i < rawList.length; i++) {
                var entity = new Entity(rawList[i], incidentMetadata);
                incidentList.push(entity);
            }

            //build table
            var labelArr = p2cUtil.getFriendlyAttributeNames(incidentMetadata, listView);
            var table = getViewTable(labelArr);
            table.appendTo(divWrapper); //Insert before data population. Otherwise paging controls won't be added.
            populateViewTable(table, incidentList, labelArr);
        });
    }

    /*
     * Ajax
     */
    function getIncidents() {
        return $.p2c({
            url: "entity/incident",
            type: "get",
        });
    }

    /*
     * View Helpers. Creates DOM
     */
    function populateViewTable(table, entities, labelArr) {
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

    function getViewTable(labelArr) {
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

//create view
$.p2c.ready(function() {  
    //save for later
    var createView;
    var createViewSort;
    var incidentMetadata;
    var form;
    var submit;
    var easyAnswerContainer;

    //Creation
    var createForm = $('form[action="ticketNewProcess.asp"]');
    if(createForm.length > 0) {
        //insert the form we'll use
        form = $('<form id="caseCreate" class="p2c-loading"></form>');
        form.insertBefore('form[action="ticketNewProcess.asp"]');

        $.when(p2cUtil.getSavedView('PortalCaseCreate'), p2cUtil.getIncidentMetadata())
        .done(function(viewData, metaData) {
            form.removeClass('p2c-loading');
            //view
            createView = p2cUtil.getViewArr(viewData[0]);
            createViewSort = p2cUtil.getViewOrder(viewData[0]);

            //metadata
            incidentMetadata = metaData[0];

            //DOM
            var fields = p2cUtil.getFormFields(createView, incidentMetadata);
            form.append(fields);
            submit = p2cUtil.addSubmitButton(form, incidentMetadata, function(data) {
                //DOM
                var confirmation = $('<div id="createCaseConf">');
                confirmation.attr('data-incidentid', data);
                confirmation.text("Case created successfully.");

                confirmation.insertBefore(form);
                form.remove();
                submit.remove();

                //clear easy answer results
                easyAnswerContainer.children().remove();
            });

            //Easy Answer
            easyAnswerContainer = $('<div id="EasyAnswerContainer">')
                .insertBefore(submit);
            var formInputs = form.find('input, textarea');

            //bind event
            formInputs.on('change', function() {
                easyAnswerContainer.children().remove(); //clear container
                var inputArr = [];

                formInputs.each(function(index, input) {
                    inputArr.push($(input).val());
                });

                //Asynchronously search the KB
                var search = searchKb(inputArr);
                search.done(function(data) {
                    //parse out the search results
                    var results = $('.searchResults', data).outerHTML();
                    //display the results
                    easyAnswerContainer.append(results);
                });
            });
        });
    }

    /* Easy Answer */
    function searchKb(textArr) {
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

//Case details -> custom event
$.p2c.evs.on('details', function(ev, guid, incidentMetadata) {
    var detailsView;
    var detailsViewSort;
    var labelArr;
    
    //create modal. Remove if one exists already
    if ($(detailsModal).length > 0) {
        $(detailsModal).remove();
    }

    createModalDiv();
   
    //wait for the multiple ajax to finish
    $.when(getSavedView('PortalCaseDetails'), 
        getEntity('incident', guid))
    .done(function(view, entity) {
        detailsModal.removeClass('p2c-loading');
        //save for later
        detailsView = p2cUtil.getViewArr(view[0]);
        detailsViewSort = p2cUtil.getViewOrder(view[0]);

        var inc = entity[0];

        //build up the DOM
        labelArr = p2cUtil.getFriendlyAttributeNames(incidentMetadata, detailsView);
        var form = createForm();
        var fields = populateForm(inc, labelArr);
        form.append(fields);

        //append comments
        $.p2c.evs.trigger('caseComments', [inc.Id, incidentMetadata]);
    });

    /*
     * Helper functions
     */
    //DOM
    function createModalDiv() {
        //Create and add the DOM container
        detailsModal = $('<div id="caseDetails" class="p2c-loading">' +
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

    function createForm() {
        //create a form and append
        var form = $('<form id="caseDetails" />');
        form.appendTo(detailsModal.find('#frameContents'));
        return form;
    }

    function populateForm(inc) {
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

//Case comments. Triggered after case details.
$.p2c.evs.on('caseComments', function(ev, id, incMetadata) {
    $('div#tabContainer').remove();
    var tabWrapper = $('<div id="tabContainer"><ul class="tabsMenu"></ul><div class="tabs"></div>');
    var commentView;
    var commentViewOrder;

    $.when(p2cUtil.getRelatedEntities('incident', id, 'new_casecomments'),
            p2cUtil.getSavedView('P2C_PortalView'),
            p2cUtil.getCommentsMetadata(),
            p2cUtil.getSavedView('P2C_PortalCreateComment'))
        .done(function(commentsList, view, meta, createView) {
            var commentsMetadata = meta[0];
            //comments list
            var rawComments = commentsList[0].Entities.$values;
            var comments = [];
            for (var i = 0; i < rawComments.length; i++) {
                var comm = new Entity(rawComments[i], commentsMetadata);
                comments.push(comm);
            }

            //view
            commentView = p2cUtil.getViewArr(view[0]);
            commentViewOrder = getViewOrder(view[0]);
            var commentCreateView = p2cUtil.getViewArr(createView[0]);

            //DOM
            var labelArr = p2cUtil.getFriendlyAttributeNames(commentsMetadata, commentView);
            var table = getTable(labelArr);
            //NOTE: On successful submission of a comment, the comments area is torn down and reloaded
            var createForm = $('<form />')
                .append(getFormFields(commentCreateView, commentsMetadata));
            p2cUtil.addRelatedSubmitButton(createForm, incMetadata, id, commentsMetadata, function() {
                $.p2c.evs.trigger('caseComments', [id, incMetadata]);
            });

            tabWrapper.appendTo(detailsModal.find('#frameContents'));
            addTab("All Comments", table);
            addTab("Submit Comment", createForm);

            populateViewTable(table, comments, labelArr);
            initTabs();
    });

    /*
    * View Helpers. Creates DOM
    */
    function getTable(labelArr) {
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

    function populateViewTable(table, entities, labelArr) {
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

    function addTab(label, elems) {
        var count = tabWrapper.find('ul.tabsMenu').children().length;
        
        //label on tab
        tabWrapper.find('ul.tabsMenu').append('<li><a href="#tab-' + count + '">' + label + '</a></li>');
        
        //tab contents
        var tab = $('<div id="tab-' + count + '" class="tabContent"></div>');
        tab.append(elems);
        tabWrapper.find('div.tabs').append(tab);
    }

    function initTabs() {
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
});

/*
 * Helper and AJAX functions under the p2cUtil
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

    ns.addRelatedSubmitButton =  function(form, parentMeta, parentGuid, metadata, onConfirm) {
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
            createRelatedEntity(parentMeta['LogicalName'], parentGuid, metadata['LogicalName'], insertEnt)
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
 * Temporary workaround for logging out of the portal AND P2C (aka Single Log Out)
 */
$(window).load(function() {
    // log all calls to setArray
    var proxied = window.exitSupport;
    window.exitSupport = function() {
        //set a timeout to log out in 1.5 seconds regardless of success or failure
        setTimeout(function() {
            proxied.apply(this, arguments);


        }, 1500);

        //remove cached items from session storage
        p2cUtil.p2cSessStoreClear();
        //submit logout, then on confirmation/failure, logout normally
        logoutP2C().done(function() {
            proxied.apply(this, arguments);
        });
    };
  
    function logoutP2C() {
        return $.p2c({
            url: 'auth',
            type: 'DELETE',
        });
    }
});

/*
 * DataTables alterations
 */
//prevent it from Alerting. Throw a JS error instead.
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