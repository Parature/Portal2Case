/*
 * Dependencies:
 * Moment.js and jQuery 1.8+ (use 1.10+ to be safe)
 */

//Entity class
function Entity(ent, entityMetadata) {
    this._meta = entityMetadata;
    this._ent = ent;
    this._getAttrMetadata = getAttrMetadata;
    
    //public properties
    this.guid = ent['Id']; 
    this.logicalName = ent['LogicalName'];
    this.attributes = getAttributes(ent, entityMetadata);
    
    //private inner
    function getAttributes(rawEnt, entityMetadata) {
        var attrs = [];
        var rawList = rawEnt.Attributes.$values;
        
        //get the Attribute objects
        for(var i = 0; i < rawList.length; i++) {
            var rawAttr = rawList[i];
            var meta = getAttrMetadata(rawAttr['Key']);

            //if metadata found
            if (meta != undefined && rawAttr != undefined) {
                var a = new Attribute(meta, rawAttr);
                attrs.push(a);
            }
        }
        
        return attrs;
    }
    
    function getAttrMetadata(logicalName) {
        var metList = entityMetadata['Attributes']['$values'];
        
        for(var i = 0; i < metList.length; i++) {
            if(metList[i]['LogicalName'] == logicalName) {
                return metList[i];
            }
        }
    }
}

Entity.prototype.getViewAttributes = function(viewArr) {
    var attrs = [];
    
    for(var i = 0; i < viewArr.length; i++) {
        var logName = viewArr[i];
        var a = this.getAttribute(logName);
    
        attrs.push(a);
    }
    
    return attrs;
}

Entity.prototype.getAttribute = function(logicalName) {
    for(var i = 0; i < this.attributes.length; i++) {
        if(this.attributes[i].logicalName == logicalName) {
            return this.attributes[i];
        }
    }
    
    //no attribute exists. Null in CRM
    var meta = this._getAttrMetadata(logicalName);
    
    return new Attribute(meta, undefined);
}

//Attribute class for entities.
function Attribute(meta, attr) {
    //properties
    this._meta = meta;
    this._attr = attr;
    this.val = undefined;
    this.logicalName = meta['LogicalName'];
    this.label = meta['DisplayName']['UserLocalizedLabel']['Label'];
    this.type = meta['$type'].split(',')[0].replace('Microsoft.Xrm.Sdk.Metadata.', ''); //don't need the assembly
    this.options = new AttributeOptions(meta);
    this.validCreate = meta['IsValidForCreate'];
    this.validUpdate = meta['IsValidForUpdate'];
    this.required = meta['RequiredLevel']['Value'] > 0;

    if (attr !== undefined) {
        var type = this.type;
        switch (type) {
            //option set
        case "StatusAttributeMetadata":
        case "StateAttributeMetadata":
        case "PicklistAttributeMetadata":
            this.val = attr['Value']['Value'];
            break;
        //direct
        case "BigIntAttributeMetadata":
        case "BooleanAttributeMetadata":
        case "DoubleAttributeMetadata":
        case "DecimalAttributeMetadata":
        case "IntegerAttributeMetadata":
        case "StringAttributeMetadata":
        case "MemoAttributeMetadata":
        case "AttributeMetadata":
            this.val = attr['Value'];
            break;
        //special parsing. DateTime using moment
        case "DateTimeAttributeMetadata":
            this.val = moment(attr['Value']).format('MMMM Do YYYY, h:mm:ss a'); //pretty local time
            break;
        //entity reference
        case "LookupAttributeMetadata":
            this.val = attr['Value']['Id'];
            break;
        //no idea
        case "EntityNameAttributeMetadata":
        case "ImageAttributeMetadata":
        default:
            break;
        }
    } else {
        this.val = "";
    }

}   

//Simple templating system. 
//Not all attribute types are supported for all operations - see the switch statement
Attribute.prototype.getDisplay = function() {
    var val = this.val === undefined 
        ? ""
        : this.val;

    //fake attribute, not all data there
    if (this._attr == undefined) {
        return val;
    }
    
    if (this.type == "LookupAttributeMetadata") {
        val = this._attr['Value']['Name'];
    } else {
        //check if it has options. This is a poor way to catch those with options
        for (var i = 0; i < this.options.opts.length; i++) {
            var o = this.options.opts[i];
            if (o['val'] === val) {
                val = o['label'];
                break;
            }
        }
    }

    return val === undefined 
        ? ""
        : val;
}

Attribute.prototype.getViewHtml = function() {
    var disp = this.getDisplay();
    var html = "<span>" + disp + "</span>";
    return html;
}

Attribute.prototype.getUpsertHtml = function() {
    var html = $();
    var type = this.type;
    switch(type) {
        //option set
        case "StatusAttributeMetadata":
        case "StateAttributeMetadata":
        case "PicklistAttributeMetadata":
            var opts = this.options.opts;
            html = $('<select />');
            html.attr({
                'name': this.logicalName
            });
            for (var i = 0; i < opts.length; i++) {
                var o = opts[i];
                var opt = $('<option />');
                opt.val(o.val);
                opt.text(o.label);
                //if selected/current value
                if (this.val === o.val) {
                    opt.attr('selected', 'selected');
                }
                html.append(opt);
            }
            break;
        //direct
        case "BigIntAttributeMetadata":
        case "BooleanAttributeMetadata":
        case "DoubleAttributeMetadata":
        case "DecimalAttributeMetadata":
        case "IntegerAttributeMetadata":
        case "StringAttributeMetadata":
        case "AttributeMetadata":
            html = $('<input />');
            html.attr({
                'data-type': this.type,
                'name': this.logicalName
            });
            html.val(this.val);
            break;
        //memo deserves a full text area
        case "MemoAttributeMetadata":
            html = $('<textarea />');
            html.attr({
                'data-type': this.type,
                'name': this.logicalName
            });
            html.val(this.val);
            break;
        //special parsing. DateTime using moment
        case "DateTimeAttributeMetadata":
            html = $('<input />');
            html.attr({
                'data-type': this.type,
                'name': this.logicalName
            });
            html.val(this.val);
            break;
        //entity reference
        case "LookupAttributeMetadata":
            break;
        //no idea
        case "EntityNameAttributeMetadata":
        case "ImageAttributeMetadata":
        default :
            break;
    }

    var field = html;
    if (html.length > 0) {
        field = $('<div class="fieldset" />');
        var label = $('<label>')
            .text(this.label)
            .attr('data-required', this.required);
        field.append(label).append(html);
    }

    return field;
}

Attribute.prototype.isValid = function() {
    var valid = false;

    if (this.required && this.val.trim() === "") {
        //empty 
        return false;
    }

    switch(this.type) {
        //option set
        case "BooleanAttributeMetadata":
        case "StatusAttributeMetadata":
        case "StateAttributeMetadata":
        case "PicklistAttributeMetadata":
            valid = this.options.CheckOptionValid(this.val);
            break;
        case "BigIntAttributeMetadata":
        case "IntegerAttributeMetadata":
        case "DoubleAttributeMetadata":
        case "DecimalAttributeMetadata":
            //isNaN evals "" as 0....
            valid = $.isNumeric(this.val);
            break;
        case "AttributeMetadata":
            break;
        //memo can be whatever
        case "StringAttributeMetadata":
        case "MemoAttributeMetadata":
            valid = true;
            break;
        //special parsing. DateTime using moment
        case "DateTimeAttributeMetadata":
            return moment(this.val).isValid();
            break;
        //entity reference
        case "LookupAttributeMetadata":
            break;
        //no idea
        case "EntityNameAttributeMetadata":
        case "ImageAttributeMetadata":
        default :
            break;
    }

    return valid;
}

// Format like the deserializer expects. It's fickle and requires explicit types
Attribute.prototype.getUpsertObject = function() {
    var obj = {
        'Key': this.logicalName,
    };
    
    var type = this.type;
    switch (type) {
        //option set
        case "StatusAttributeMetadata":
        case "StateAttributeMetadata":
        case "PicklistAttributeMetadata":
            obj['Value'] = {
                '$type': "Microsoft.Xrm.Sdk.OptionSetValue, Microsoft.Xrm.Sdk",
                'Value': this.val
            }
            break;
        //direct
        case "BigIntAttributeMetadata":
        case "BooleanAttributeMetadata":
        case "DoubleAttributeMetadata":
        case "DecimalAttributeMetadata":
        case "IntegerAttributeMetadata":
        case "StringAttributeMetadata":
        case "MemoAttributeMetadata":
        case "AttributeMetadata":
            obj['Value'] = this.val;
            break;
        //special parsing. DateTime using moment
        case "DateTimeAttributeMetadata":
            obj['Value'] = moment(this.val).toISOString(); //ISO8601
            break;
        //entity reference
        case "LookupAttributeMetadata":
            //not implemented
            break;
        //no idea
        case "EntityNameAttributeMetadata":
        case "ImageAttributeMetadata":
        default:
            break;
    }

    return obj;
}

//Metadata options list
function AttributeOptions(metadata) {
    this._meta = metadata['OptionSet'];
    //opts = {'label', 'value'}
    this.opts = (this._meta === undefined)
        ? [] 
        : getOpts(this._meta);
    
    //private inner
    function getOpts(meta) {
        var opts = [];

        var list = [];
        if (meta['Options'] != undefined && meta['Options']['$values']) {
            //picklist and option set
            list = meta['Options']['$values'];
        } else if (meta['FalseOption'] != undefined
            && meta['TrueOption'] != undefined) {
            //bool options....
            list = [meta['FalseOption'], meta['TrueOption']];
        }

        for(var i = 0; i < list.length; i++) {
            var opt = list[i];
            var o = {};
            
            o['label'] = opt['Label']['UserLocalizedLabel']['Label'];
            o['val'] = opt['Value'];
            
            opts.push(o);
        }

        return opts;
    }
}

AttributeOptions.prototype.CheckOptionValid = function(optVal)
{
    for (var i = 0; i < this.opts.length; i++) {
        var opt = this.opts[i];

        if (opt.val === Number(optVal)) {
            return true;
        }
    }

    return false;
}