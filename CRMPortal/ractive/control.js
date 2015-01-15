var rawList = incList['Entities']['$values'];
incidentList = [];
for (var i = 0; i < rawList.length; i++) {
    var entity = new Entity(rawList[i], meta);
    incidentList.push(entity);
}

var viewArr = getViewArr(p2ccaseview);
var labelArr = getFriendlyAttributeNames(meta, viewArr);

//helpers
function getFriendlyAttributeNames(entMetadata, view) {
    var nameObj = [];
    var attributes = entMetadata.Attributes.$values;
    
    //attributes
    for(var i = 0; i < attributes.length; i++) {
        var attr = attributes[i];
        
        if(view.indexOf(attr['LogicalName']) > -1) {
            var key = attr['LogicalName'];
            var val = attr['DisplayName']['UserLocalizedLabel']['Label'];
            var obj = {
                logicalName: key,
                display: val,
            };

            nameObj.push(obj);
        }
    }

    //preserve original view
    nameObj = _.sortBy(nameObj, function(attr) {
        var index = _.indexOf(view, Object.keys(attr)[0]);
        return index;
    });

    return nameObj;
}

function getViewArr(viewObj) {
    //todo: check for undefined
    return _.map(viewObj.layoutXml.grid.row.cell, function(col) {
        return col['@name'];
    });
}


/*
 * This is a component
 */
var crmAttribute = Ractive.extend({
    template: '#crmAttribute',
    isolated: false,
    data: {
        editing: false,
        getPartial: function(type) {
            /*
             * Return the partial's name. Combined since many are shared
             */
            switch (type) {
            case "BooleanAttributeMetadata":
            case "StatusAttributeMetadata":
            case "StateAttributeMetadata":
            case "PicklistAttributeMetadata":
                return "dropdown";
                break;
            case "BigIntAttributeMetadata":
            case "IntegerAttributeMetadata":
                return "int";
                break;
            case "DoubleAttributeMetadata":
            case "DecimalAttributeMetadata":
                return "float";
                break;
            //memo can be whatever
            case "StringAttributeMetadata":
            case "MemoAttributeMetadata":
                return "direct";
                break;
            //special parsing. DateTime using moment
            case "DateTimeAttributeMetadata":
                return "datetime";
                break;
            //no real bearing here. Not yet defined
            case "AttributeMetadata":
            case "LookupAttributeMetadata":
            case "EntityNameAttributeMetadata":
            case "ImageAttributeMetadata":
            default:
                throw "Not Implemeneted";
                break;
            }
        }
    },
    onrender: function() {
        this.on('setEdit', function(ctv, newVal) {
            this.set({
                editing: newVal
            });
        });
    },

});

/*
 * This is actually rendered and shown. note that it makes use of a component
 */
var tableList = new Ractive({
    el: 'container',
    template: '#template',
    components: {
        entityAttribute: crmAttribute,    
    },
    data: { 
        header: labelArr,
        entities: incidentList,
    },

});