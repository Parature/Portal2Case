using System.Web.Http.Controllers;
using Portal2Case.classes;
using AuthorizeAttribute = System.Web.Http.AuthorizeAttribute;

namespace Portal2Case.services.filters
{
    public class AuthFilter : AuthorizeAttribute
    {
        /// <summary>
        /// Check session to see if we know who this user is. 
        /// False will result in an exception and subsequent 401 response
        /// </summary>
        /// <param name="actionContext"></param>
        /// <returns></returns>
        protected override bool IsAuthorized(HttpActionContext actionContext)
        {
            return SessionManagement.Authorized();
        }
    }
}