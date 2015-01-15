<%@ Page Language="C#" MasterPageFile="~/Site.Master" AutoEventWireup="true" CodeBehind="Auth.aspx.cs" Inherits="Portal2Case.Pages.Auth" %>

<asp:Content ContentPlaceHolderID="HeadContent" runat="server" >
</asp:Content>
<asp:Content ContentPlaceHolderID="MainContent" runat="server">
    <script type="text/javascript">
        //For prevention of XSS, add the domain. Leave as-is for demo purposes.
        var originRestriction = {
            to: "*",
            from: "*"
        }

        /* AJAX proxy
         // check action
         // respond with id and status

            var pay = {
                'p2cAction': 'ajax',
                'id': id,
                'payload': payload
            }
        */
        $(window).on('message', function(ev) {
            var msg = ev.originalEvent.data;
            if(originRestriction.from !== "*"
                && ev.originalEvent.origin !== originRestriction.from)
            {
                parent.postMessage("Origin incorrect, rejecting since it may be XSS. Check the hosted site's origin.", "*");
                return;
            }

            try {
                var message = JSON.parse(msg);

                if (message && message.p2cAction == "ajax") {
                    var action = message.p2cAction;
                    var id = message.id;
                    var payload = message.payload;

                    //remove absolute url. Probably not necessary
                    payload.url = getRelUrl(payload.url);

                    var ret = {
                        payload: undefined,
                        status: undefined,
                        id: id,
                        p2cAction: action
                    }

                    //AJAX for them. When done, send back via postMessage
                    $.ajax(payload)
                        .done(function(data, statusText, xhr) {
                            ret.payload = data;
                            ret.status = xhr.status;
                        })
                        .fail(function(xhr) {
                            ret.payload = xhr.responseText;
                            ret.status = xhr.status;
                        })
                        .always(function() {
                            parent.postMessage(JSON.stringify(ret), originRestriction.to);
                        });
                }

            } catch (e) {}
        });

        /*
         * Globals
         */
        function getRelUrl(url) {
            var parser = document.createElement('a');
            parser.href = url;
            return parser.pathname;
        }
    </script>

    <script type="text/javascript">
        //stringified messages for IE
        parent.postMessage("ready", originRestriction.to);
    </script>
</asp:Content>