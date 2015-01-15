<%@ Page Language="C#" AutoEventWireup="true" CodeBehind="Logout.aspx.cs" Inherits="Portal2Case.Pages.Logout" %>

<!DOCTYPE html>

<html xmlns="http://www.w3.org/1999/xhtml">
<head runat="server">
    <title></title>
</head>
<body>
    <form id="form1" runat="server">
    <div>
        Logged out. <br/>
        <a href="~/Auth.aspx">Attempt Login</a>
        <!-- 
            Page is purely for convenience during testing. 
            The preferrable method of logging out is a DELETE to the auth controller. 
        -->
    </div>
    </form>
</body>
</html>
