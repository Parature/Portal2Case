# Portal Resource Integration
Portal2Case uses JavaScript and CSS to bridge the gap between the externally-hosted web-service and the End-User facing UI. These resources perform a couple functions:

* Override the standard Parature Portal Ticket module
* Provide an API for cross-origin AJAX (for CRM data retrieval)
* Abstract the complicated authentication process
* Build the new UI and respond to End-User input

The code cannot entirely mimic the standard Portal functionality, particularly when it comes to visuals, so some minor changes may be required by the implementer for their specific environment.

#### Dependencies
The JavaScript relies on some polyfills to support older browsers such as IE8/9.

[These can be found in a variety of online libraries or code snippets]
* String.prototype.trim
* Array.prototype.indexOf
* Object.keys

A variety of libraries are also put to use to simplify development. Some dependencies may be eliminated in the future. The versions used during development are in parenthesis.

_Scripts should be loaded in this order_
* jQuery (v1.11.1)
* jQuery DataTables (v1.10.2, remember to link the CSS too)
* LoDash (v2.4.1, compat version)
* Moment.js (v2.8.2)

"Lighter" versions of these libraries may be used (ex. Zepto instead of jQuery) but are not guaranteed to work and have not been tested.

#### Files and Load Order
The integration client-side code is split amongst 5 files. Their load order and a brief summary are:

1. `/portal/css/p2c_styling.css`
 * Style sheet for the base integration
2. `/portal/js/classes.js`
 * Class definitions for C# CRM classes
3. `/portal/js/jquery.p2c.js`
 * jQuery wrapper for CORS AJAX and Authentication bootstrapping
4. `/portal/js/ui.js`
 * Bulk of the integration. Code which builds the UI, handles data, and interacts with the user.
5. `/portal/js/initScript.js`
 * Short script to kick-off the Authentication process

Previously mentioned dependencies must be loaded before these files.

#### Where are these links added?
If you are new to Parature and learning how to use the Portal in general, please contact Parature Support (link in the Service Desk) to get started. The basic process is modification of a portal [template](http://templates.supportcenteronline.com/) to fit your use case.

In each template, there is a "bottom" file, which is uploaded via the Service Desk. The bottom file is copied inline into the DOM for each page load on the Portal. Place the scripts mentioned above into the bottom file as `<script>` and `<link>` elements in the order specifed.