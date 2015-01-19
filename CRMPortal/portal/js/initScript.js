/*
Copyright (c) Microsoft Corporation. All Rights Reserved.
MIT License
Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the Software), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

/*
 * This initializes the authentication process
 * It first checks to see if we are on a Parature Portal page with the ticket form or history form
 *  - if found, it will 
 *  1. Hide forms using CSS (see ~/portal/css/p2c_styling.css)
 *  2. Load a hidden iFrame pointed to the "url" link in the config (the page itself may initiate SSO itself if it wishes)
 *  3. After SSO, it will wait for a postMessage from the iframe to consider authentication a success or failure (the library adds an event listener to window automatically)
 *  4. Once authenticated, every function registered to $.p2c.ready() will be triggered and run
 * 
 * All AJAX requests will then be based off of $.p2c.config.url + $.p2c.config.baseApiUrl (which defaults to "/api")
 * All further API requests should go through $.p2c({<params>}) - a thin wrapper around $.ajax and functions identically  
 */
if ($('div#myTicketHistory, ' +
    'form#myTicketSearchForm, ' +
    'form[action="ticketNewProcess.asp"]').length > 0) {

    //on the correct page
    $.p2c.config({
        url: "http://localhost:64659",
    });

    $.p2c.init();
}


