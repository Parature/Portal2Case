/*
 * jQuery plugin for Portal2Case
 * - Handles Authenticate transparenty via a hidden iframe
 * - Wraps the standard jquery.ajax function with automated session renegotiation, retries, and switches between $.ajax and postMessage (all requests use the Promise API)
 * - Uses its own internal events to prevent race-conditions (primarily, $.p2c.ready which functions like $.ready)
 * 
 * Uses a really basic polyfill for console.log
 */
;(function( $, console ) {
    var _config = {
        url: undefined,
        baseApiUri: '/api', //always going to add it to api calls
        ready: false,
        iframe: undefined,
    };

    /*
     * Each object in array: [ params, extPromise ]
     */
    var _retryQueue = []; //store requests for retries
    
    /*
     * Wrapper for AJAX. Will buffer requests and retry if they get a 401
     */
    $.p2c = function(params, disableRetry, retryPromise) {
        //if disableRetry is true, return whatever the ajax results are
        if (disableRetry) {
            return _ajaxWrapper(params);
        } 

        //this buffers the request, in case we get a 401
        //401s will be stored and retried
        var intPromise = _ajaxWrapper(params);
        var extPromise = (retryPromise === undefined)
            ? $.Deferred()
            : retryPromise;

        //this is the internal promise that was triggered by AJAX. 
        //If successful - resolve, if a 401 - add to a retry queue, else - return as a fail
        intPromise
            .done(function(resp, status) {
                extPromise.resolve(resp, status);
            })
            .fail(function(resp, status) {
                if (status == 401 || resp.status == 401) {
                    console.log("Got a 401, added to queue");
                    //session timeout, add to the retry queue
                    _retryQueue.push([params, extPromise]);

                    //thought we were golden, try a reauth
                    if (_config.ready === true) {
                        _config.ready = false;

                         _authenticate(function() {
                             console.log("Reauthed");
                            _config.ready = true;
                            
                             //simple, naive retry of each in queue
                             //TODO: Test more to make sure we don't get into infinite loops
                             for (var i = 0; i < _retryQueue.length; i++) {
                                 var par = _retryQueue[i][0];
                                 var prom = _retryQueue[i][1];
                                 $.p2c(par, false, prom);
                             }
                         });
                    }
                } else {
                    //some other failure, or we expect a failure and don't want retries
                    extPromise.reject(resp, status);
                }
            });

        //we manually resolve or kill, based of the intPromise object's success
        return extPromise;
    };

    /*
     * events pass through here
     */
    $.p2c.evs = $('<div />'); 

    $.p2c.config = function(config) {
        _config.url = _parseUrl(config.url);
    };

    $.p2c.init = function() {
        var valid = _validateConfig(_config);

        if (!valid) {
            return;
        }

        _authenticate(triggerSuccess, logFailure);

        //on success trigger
        function triggerSuccess() {
            $.p2c.evs.trigger('ready');
            _config.ready = true;
        }

        function logFailure() {
            console.log();
        };
    };

    //Event triggered when authenticated. Fluff method
    $.p2c.ready = function(callback) {
        //if already authenticated, trigger the callback now.
        if(_config.ready) {
            $.p2c.evs.off('ready');
            $.p2c.evs.on('ready', callback);
            $.p2c.evs.trigger('ready');
            return;
        } 

        $.p2c.evs.on('ready', callback);
    }

    /***
     * Private Functions
     */
    //Ajax/postMessage wrapper for XDM calls. Returns a promise
    var _ajaxWrapper = function(params) {
        var url = getAjaxUrl(params.url);
        var type = params.type;
        var data = params.data;

        //internal object we'll use for the req
        var parameters = {
            url: url,
            type: type,
            data: data
        }

        //only using postMessage now.
        return postMessageAjaxProxy(parameters);

        /*
         * Helper methods
         */
        //parse so we are tolerant of screwups in the relative url
        function getAjaxUrl(relUrl) {
            var parser = _parseUrl(_config.url.href); //get the anchor object
            
            //build relative URL
            parser.pathname = _config.baseApiUri; //parse the base API path first
            var baseRel = parser.pathname;
            parser.pathname = relUrl;
            var relApi = parser.pathname;
            parser.pathname = relApi;
            var totalRel = baseRel + "/" + relApi;
            totalRel = totalRel.replace("//", "/"); //Chrome and IE behave differently. 
            //place back into the parser
            parser.pathname = totalRel;

            return parser.href;
        }

        //return promise, internally resolves or rejects
        //warning - there be dragons here
        function postMessageAjaxProxy(payload) {
            var def = $.Deferred();
            //postMessage proxy
            if (_config.iframe.length < 1) {
                //todo: throw event here
                console.log('Error, iframe not found');
                return;
            }

            var win = _config.iframe[0].contentWindow;
            var id = Math.random(); //random id
            
            /*
             * attach event.
             * this'll get triggered by ALL 'message' events
             * the '.ajax.<id>' lets us unbind JUST this event. Otherwise just fluff
             * using closures heavily, so be aware that we dependencies in the outer scope
             */
            $(window).on('message.ajax.' + id, function(ev) {
                var msg = ev.originalEvent.data;
                var message;

                try {
                    message = JSON.parse(msg);
                } catch (e) {
                    //fall through. May not be for us
                }  
                
                //message is for us
                if (message !== undefined && message['id'] == id) {
                    $(window).off('message.ajax.' + id); //stop triggering THIS event.
                    var status = message['status'];
                    var resp = message['payload'];

                    //resolve/reject, based off HTTP codes
                    if (status < 300) {
                        def.resolve(resp, status);
                    }
                    def.reject(resp, status); //resolve the ajax request
                }  
            });
            //TODO: Set a timeout on the wait

            //submit postMessage. Wrap it so we can track the response
            var pay = {
                'p2cAction': 'ajax',
                'id': id,
                'payload': payload
            }

            win.postMessage(JSON.stringify(pay), '*');

            //return the promise
            return def;
        }
    };

    /* Simple browser parser (anchor tag) returned
        url.protocol; // => "http:"
        url.hostname; // => "http://example.com"
        url.port;     // => "3000"
        url.pathname; // => "/pathname/"
        url.search;   // => "?search=test"
        url.hash;     // => "#hash"
        url.host;     // => "example.com:3000"
     */
    var _parseUrl = function(url)
    {
        var parser = document.createElement('a');
        parser.href = url;
        return parser;
    }

    var _validateConfig = function(config) {
        var valid = true;
        var errorMessage = "";
        //check for failure to init via config
        if (config.url == undefined) {
            errorMessage += 'Url is empty. \n';
            valid = false;
        }

        if (!valid) {
            console.log("P2C not properly initialized:");
            console.log(errorMessage);
        }

        return valid;
    }

    //Check if we are in an iframe
    var _inIframe = function() {
        try {
            return window.self !== window.top;
        } catch (e) {
            return true;
        }
    }

    //callback to trigger ready function when authentication is checked.
    //TODO: Add a failure check
    var _authenticate = function(onSuccess, onFailure) {
        if(_inIframe()) {
            //if in an iframe, alert the parent (which may be this same code) that we are not logged in and have a circular dependency
            //this can be very confusing, so remember that the IdP IS this page.
            parent.postMessage("sso", "*");
            return; //don't try to bootstrap the authentication process in an iframe. Just don't. Causes infinte loops
        }

        //load iframe which will proxy all requests
        iframeLoad()
                .done(onSuccess)
                .fail(onFailure);

        function iframeLoad() {
            //remove if it exists. creating a new one
            $(iframe).remove();

            //create a deferred object, an async promise (just like $.ajax).
            var def = new $.Deferred();

            //add event listeners to determine when the ready
            //use the dot notation so we can attached and remove non-globally
            $(window).off('message.auth');
            $(window).on("message.auth", function(ev) {
                var msg = ev.originalEvent.data;

                if (msg == 'ready') {
                    def.resolve();
                }

                if (msg == 'authFail') {
                    def.reject();
                }
            });

            //create the iframe and bootstrap it
            var iframe = $('<iframe />');
            iframe.attr({
                'src': _parseUrl(_config.url).origin + "/Auth.aspx",
                'id': 'authP2C'
            });
            iframe.attr('style', 'display:none !important'); //don't use $.css. Bad in IE
            iframe.appendTo('body');

            //save for later postMessage proxying if it is necessary
            _config.iframe = iframe;

            return def;
        }
    }
})( jQuery, console || { log: function () {}});