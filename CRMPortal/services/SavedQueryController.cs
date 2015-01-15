using System;
using System.Collections.Generic;
using System.Linq;
using System.Web.Http;
using System.Web.Http.Cors;
using System.Web.Mvc;
using System.Web.SessionState;
using System.Xml.Linq;
using Portal2Case.classes;
using Xrm;

namespace Portal2Case.services
{
    //[AuthFilter]  // uncomment if you don't want ANYONE to be able to access saved queries without being logged in.
    [SessionState(SessionStateBehavior.ReadOnly)]
    [EnableCors(origins: "http://demo.parature.com", headers: "*", methods: "*", SupportsCredentials = true)]
    public class SavedQueryController : ApiController
    {
        /// <summary>
        /// Returns the SavedQuery. It's not super useful by itself, but you can grab the fetchXML to decipher it manually.
        /// </summary>
        /// <param name="viewName"></param>
        /// <returns></returns>
        public Dictionary<string, XDocument> GetView([FromUri]string viewName)
        {
            var entReadPermissions = SessionManagement.UserPermissions.EntityPermissions.Read;
            var relatedReadPermissions = SessionManagement.UserPermissions.RelatedEntityPermissions.Read;

            SavedQuery view = null;
            SessionManagement.Pool.Perform(xrm => {
                view = xrm.SavedQuerySet.FirstOrDefault(q => q.Name == viewName);
            });

            //the view class is somewhat large, so simplifying before returning. Layout defines order, fetch defines sorting.
            var ret = new Dictionary<string, XDocument>()
            {
                {"layoutXml", XDocument.Parse(view.LayoutXml)},
                {"fetchXml", XDocument.Parse(view.FetchXml)}
            };

            //allow view retrieval for both primary entities and related entities
            var entityLogicalName = view.ReturnedTypeCode;
            if (entReadPermissions.Contains(entityLogicalName, StringComparer.CurrentCultureIgnoreCase) == false
                && relatedReadPermissions.Contains(entityLogicalName, StringComparer.CurrentCultureIgnoreCase) == false)
            {
                throw new ForbiddenAccessException("Not authorized to access this saved view from the portal.");
            }

            return ret;
        }
    }
}