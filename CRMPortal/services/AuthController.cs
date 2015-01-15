using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Web.Http;
using System.Web.Http.Cors;
using System.Web.Mvc;
using System.Web.SessionState;
using Portal2Case.classes;
using Portal2Case.services.filters;

namespace Portal2Case.services
{
    [AuthFilter]
    [SessionState(SessionStateBehavior.ReadOnly)]
    [EnableCors(origins: "http://demo.parature.com", headers: "*", methods: "*", SupportsCredentials = true)]
    public class AuthController : ApiController
    {
        public bool Get()
        {
            return true;
            //return nothing. The AuthFilter will intercept before this url is hit. Header will be a 200 if successful, 401 if fail
        }

        /// <summary>
        /// Remove the current user from session
        /// </summary>
        public void Delete()
        {
            SessionManagement.Logout();
        }
    }
}