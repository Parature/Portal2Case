using System;
using System.Configuration;

namespace Portal2Case
{
    public partial class Sso : System.Web.UI.Page
    {
        protected void Page_Load(object sender, EventArgs e)
        {
            //Redirect to the link which starts IdP initiated SSO
            var url = ConfigurationManager.AppSettings["StartSsoLink"];
            Response.Redirect(url);
        }
    }
}