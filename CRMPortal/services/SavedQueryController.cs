using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Web;
using System.Web.Http;
using System.Xml.Linq;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;
using Portal2Case.classes;

namespace Portal2Case.services
{
    //[AuthFilter]  // uncomment if you don't want ANYONE to be able to access saved queries without being logged in.
    public class SavedQueryController : ApiController
    {
        const string SavedQueryLogicalName = "savedquery";

        /// <summary>
        /// Returns the SavedQuery. It's not super useful by itself, but you can grab the fetchXML to decipher it manually.
        /// </summary>
        /// <param name="viewName"></param>
        /// <returns></returns>
        public Dictionary<string, XDocument> GetView([FromUri]string viewName)
        {
            var entReadPermissions = SessionManagement.UserPermissions.EntityPermissions.Read;
            var relatedReadPermissions = SessionManagement.UserPermissions.RelatedEntityPermissions.Read;

            var qe = new QueryExpression(SavedQueryLogicalName)
            {
                ColumnSet = new ColumnSet(true),
                Criteria = new FilterExpression()
                {
                    Conditions =
                    {
                        new ConditionExpression("name", ConditionOperator.Equal, viewName)
                    }
                }
            };

            Entity view = null;
            SessionManagement.Pool.Perform(xrm => { view = xrm.RetrieveMultiple(qe).Entities.FirstOrDefault(); });
            if (view == null)
            {
                throw new HttpResponseException(HttpStatusCode.NotFound);
            }

            //the view class is somewhat large, so simplifying before returning. Layout defines order, fetch defines sorting.
            var ret = new Dictionary<string, XDocument>()
            {
                {"layoutXml", XDocument.Parse(view.GetAttributeValue<string>("layoutxml"))},
                {"fetchXml", XDocument.Parse(view.GetAttributeValue<string>("fetchxml"))}
            };

            //allow view retrieval for both primary entities and related entities
            var regardingEntity = view.GetAttributeValue<string>("returnedtypecode");
            if (entReadPermissions.Contains(regardingEntity, StringComparer.CurrentCultureIgnoreCase) == false
                && relatedReadPermissions.Contains(regardingEntity, StringComparer.CurrentCultureIgnoreCase) == false)
            {
                throw new ForbiddenAccessException("Not authorized to access this saved view from the portal.");
            }

            return ret;
        }
    }
}