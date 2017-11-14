
define([
    "dojo/_base/declare",
    "mxui/widget/_WidgetBase",
    "dojo/dom-class",
    "dojo/dom-attr",
    "dojo/dom-style",
    "dojo/dom-construct",
    "dojo/_base/lang",
    "dojo/date/locale",
    "mxui/dom"
], function (declare, _WidgetBase, domClass, domAttr, domStyle, domConstruct, lang, locale, dom) {
    return declare("StringFormatter.widget.StringFormatter", [_WidgetBase], {
    
    _hasStarted         : false,
    _mxobj              : null,
    replaceattributes   : null,
    
    startup : function() {
        if (this._hasStarted)
            return;
        
        this.attributeList = this.notused;
        this._hasStarted = true;
        domClass.add(this.domNode, 'stringformatter_widget');
        if (this.browserTooltip != null) {
            domAttr.set(this.domNode, "title", this.browserTooltip);
        }

        if (this.onclickmf !== '') {
            this.connect(this.domNode, "onclick", this.execmf);
            domStyle.set(this.domNode, {cursor: "pointer"});
        }
            

        // this.actLoaded();
    },

    update : function(obj, callback){
        domConstruct.empty(this.domNode);
        
        if (!obj){
            callback && callback();
            return;
        }
        
        this._mxobj = obj;

        this.subscribe({
            guid : obj.getGuid(),
            callback : this.getData
        });

        
        this.getData();

        callback && callback();
    },

    // We get data eighter by reference or by object.
    // The trick is to push an object in the array, containing information that can later on be used in the buildString function.
    getData : function() {
        this.replaceattributes = [];
        var referenceAttributeList = [];
        var numberlist = [];
        for (var i = 0; i  < this.attributeList.length; i++) {
            var value = null;
            if(this._mxobj.get(this.attributeList[i].attrs) !== null) {
                value = this.fetchAttr(this._mxobj, this.attributeList[i].attrs, this.attributeList[i].renderHTML, i);
                this.replaceattributes.push({ id: i, variable: this.attributeList[i].variablename, value: value});
            } else {
                //we'll jump through some hoops with this.
                referenceAttributeList.push(this.attributeList[i]);
                numberlist.push(i);
            }
        }
        
        if(referenceAttributeList.length > 0){
            //if we have reference attributes, we need to fetch them. Asynchronicity FTW
            this.fetchReferences(referenceAttributeList, numberlist);
        } else {
            this.buildString();
        }        
    },

    // The fetch referencse is an async action, we use dojo.hitch to create a function that has values of the scope of the for each loop we are in at that moment.
    fetchReferences : function(list, numberlist) {
        for(var i = 0; i < list.length; i++) {
            var self = this;
            var listContent = list;
            var listObj = list[i];
            var split = list[i].attrs.split('/');
            var guid = this._mxobj.getReference(split[0]);
            var htmlBool = list[i].renderHTML;
            var oldnumber = numberlist[i];
            if(guid !== ''){
                mx.data.get({
                    guid : guid,
                    callback : lang.hitch(this, function(data, obj) {
                        value = self.fetchAttr(obj, data.split[2], data.htmlBool, data.oldnumber);
                        self.replaceattributes.push({ id: data.i, variable: data.listObj.variablename, value: value});
                        self.buildString();
                    }, { i: i, listObj: listObj, split: split, htmlBool: htmlBool, oldnumber: oldnumber } )
                });
            } else {
                //empty reference
                value = '';
                self.replaceattributes.push({ id: i, variable: listObj.variablename, value: value});
                self.buildString();
            }
        }
    },

    // Fetch attributes.
    fetchAttr : function(obj, attr, htmlBool, i) {
        if(obj.isDate(attr)){
            if (this.attributeList[i].datetimeago) {
                var timeago = this.parseTimeAgo(obj.get(attr));
                return timeago;
            } else {
                var format = {};
                format.dateformat = this.attributeList[i].dateformat;
                format.timeformat = this.attributeList[i].timeformat;
                var date = this.parseDate(format, obj.get(attr));
                return date;
            }
        } else if (obj.isEnum(attr)){
            var caption = obj.getEnumCaption(attr, obj.get(attr));
            caption = this.checkString(caption, htmlBool);
            return caption;
        } else {
                
            var value = mx.parser.formatAttribute(obj, attr);
            var attrdatatype = obj.getAttributeType(attr);
            
                        if( attrdatatype == "Float" || attrdatatype == "Currency") {
                            value = mx.parser.formatAttribute(obj, attr, {places : this.decimalPrecision});
                        } else if (attrdatatype == "String") {
                            value = this.checkString(value, htmlBool);
                        }               

            return value;
        }
    },

    // buildstring also does renderstring because of callback from fetchReferences is async.
    buildString : function(message){
        var str = this.displaystr;

        for (attr in this.replaceattributes) {
            var settings = this.replaceattributes[attr];
            str = str.split('\${' + settings.variable + '}').join(settings.value);
        }

        this.renderString(str);
    },

    renderString : function(msg) {
        domConstruct.empty(this.domNode);
        var div = dom.create("div", { 'class': 'stringformatter'});
        div.innerHTML = msg;
        this.domNode.appendChild(div);
    },

    checkString : function (string, htmlBool) {
        if(string.indexOf("<script") > -1 || !htmlBool)
            string = dom.escapeString(string);   
        return string;  
    },

    parseDate : function(format, value) {
        var datevalue = value;
        if ((format.dateformat !== '' || format.timeformat !== '') && value !== '') {
            var selector = 'date';
            if (format.dateformat !== '' && format.timeformat !== '')
                selector = 'datetime';
            else if (format.timeformat !== '')
                selector = 'time';
            
            datevalue = locale.format(new Date(value), {
                selector : selector,
                datePattern : format.dateformat,
                timePattern : format.timeformat
            });
        }
        return datevalue;
    },

    parseTimeAgo : function(value) {
        var date = new Date(value),
        now = new Date(),
        appendStr = (date > now) ? 'from now' : 'ago',
        diff = Math.abs(now.getTime() - date.getTime()),
        seconds = Math.floor(diff / 1000),
        minutes = Math.floor(seconds / 60),
        hours = Math.floor(minutes / 60),
        days = Math.floor(hours / 24),
        weeks = Math.floor(days / 7),
        months = Math.floor(days / 31),
        years = Math.floor(months / 12);
        
        function createTimeAgoString(nr, unitSingular, unitPlural) {
            return nr + " " + (nr === 1 ? unitSingular : unitPlural) + " "+appendStr;
        }
        
        if (seconds < 60) {
            return createTimeAgoString(seconds, "second", "seconds");
        } else if (minutes < 60) {
            return createTimeAgoString(minutes, "minute", "minutes");
        } else if (hours < 24) {
            return createTimeAgoString(hours, "hour", "hours");
        } else if (days < 7) {
            return createTimeAgoString(days, "day", "days");
        } else if (weeks < 5) {
            return createTimeAgoString(weeks, "week", "weeks");
        } else if (months < 12) {
            return createTimeAgoString(months, "month", "months");
        } else if (years < 10) {
            return createTimeAgoString(years, "year", "years");
        } else {
            return "a long time "+appendStr;
        }
    },

    execmf : function() {
        if(!this._mxobj)
            return;

        var progressModal = (this.progressModal) ? "modal" : "";

        mx.ui.action(this.onclickmf, {
            params: {
                actionname  : this.onclickmf,
                applyto : 'selection',
                guids : [this._mxobj.getGuid()]
            },
            progress: progressModal,
            progressMsg: this.progressMsg,
            callback: function(result) {      
                // ok          
            },
            error       : function() {
                // error
            }
        });
    }
});
});
require(["StringFormatter/widget/StringFormatter"]);
