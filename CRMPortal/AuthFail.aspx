<%@ Page Language="C#" AutoEventWireup="true" CodeBehind="AuthFail.aspx.cs" Inherits="Portal2Case.AuthFail" %>

<!DOCTYPE html>

<html xmlns="http://www.w3.org/1999/xhtml">
<head runat="server">
    <title></title>
</head>
<body>
    <form id="form1" runat="server">
    <div>
        Authentication Failed. <br/>
        <a href="~/Auth.aspx">Retry</a>
    </div>
    <script type="text/javascript">
        //Alert the parent window that SSO totally failed
        parent.postMessage("authFail", "*");
    </script>

    </form>
</body>
</html>
