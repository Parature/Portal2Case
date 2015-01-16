using System;
using Portal2Case.classes;

namespace Portal2Case
{
    public partial class Logout : System.Web.UI.Page
    {
        protected void Page_Load(object sender, EventArgs e)
        {
            SessionManagement.Logout();
        }
    }
}