using System;
using System.Collections.Generic;
using System.Configuration;
using System.Linq;
using System.Web;
using System.Windows.Documents;
using Microsoft.Xrm.Client;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

namespace Portal2Case.classes
{
    public static class SessionManagement
    {
        private const string ContactLogicalName = "contact";
        //Globally available "threadpool" of crm services.
        public static ActorPool<CrmOrganizationServiceContext> Pool;
        public static List<string> CrmContactLookupFields = new List<string>();

        /*
         * Contains the list of ALL CRM contacts. These are cached to limit the delay of lookups during SSO.
         * Further, allows much more complicated lookup queries (case-insensitive, or regexes) than a QueryExpression can handle
         * It is replaced periodically in a very large re-retrieval. 
         */
        private static List<Entity> _cachedContacts = new List<Entity>(); 

        /// <summary>
        /// Wrapper around the Session contact
        /// </summary>
        public static EntityReference SessionContact
        {
            get
            {
                EntityReference user = null;
                try
                {
                    user = (EntityReference) HttpContext.Current.Session["CRMuser"];
                }
                catch (NullReferenceException e)
                { /* Session not initialized */ }

                return user;
            }

            set {
                if (HttpContext.Current.Session != null
                    && value != null)
                {
                    HttpContext.Current.Session["CRMuser"] = value;
                } 
            }
        }

        /// <summary>
        /// Wrapper around the Session contact's entity-level permissions
        /// </summary>
        public static SecurityContext UserPermissions
        {
            get
            {
                SecurityContext permissions = null;
                try
                {
                    permissions = (SecurityContext)HttpContext.Current.Session["CRMpermissions"];
                }
                catch (NullReferenceException e)
                { /* Session not initialized */ }

                return permissions;
            }
            set
            {
                if (HttpContext.Current.Session != null
                    && value != null)
                {
                    HttpContext.Current.Session["CRMpermissions"] = value;
                } 
            }
        }

        /// <summary>
        /// Retrieve the Contact based off of a lookup field (must be a string)
        /// </summary>
        /// <param name="paratureUidField"></param>
        /// <returns>Entity if found, otherwise null</returns>
        public static EntityReference RetrieveContact(string crmUidField, string paratureUidField)
        {
            var resultEntity =
                _cachedContacts.FirstOrDefault(ent => ent.GetAttributeValue<string>(crmUidField) == paratureUidField);
            return (resultEntity != null)
                ? resultEntity.ToEntityReference()
                : null;
        }

        /// <summary>
        /// Retrieve the contact from cache based off of the guid
        /// </summary>
        /// <param name="guid"></param>
        /// <returns>Entity if found, otherwise null</returns>
        public static EntityReference RetrieveContact(Guid guid)
        {
            var resultEntity = _cachedContacts.FirstOrDefault(ent => ent.Id == guid);
            return (resultEntity != null) 
                ? resultEntity.ToEntityReference()
                : null;
        }

        /// <summary>
        /// 
        /// 
        /// Warning: This may be causing gen2 garbage collection, which will result in global halt during GC
        /// Really needs to be updated to be more efficient, but there aren't any ways to retrieve customers who are deleted from CRM (so we can remove from Cache)
        /// </summary>
        /// <param name="_crmContactLookupFields">CRM attribute which is required during lookups</param>
        public static void CacheContactList()
        {
            var pageNumber = 1;
            var moreRecords = true;
            var allContactsList = new List<Entity>();
            
            while (moreRecords)
            {
                //query expression
                var qe = new QueryExpression(ContactLogicalName)
                {
                    ColumnSet = new ColumnSet(CrmContactLookupFields.ToArray()),
                    PageInfo = new PagingInfo
                    {
                        PageNumber = pageNumber,
                    }
                };

                EntityCollection ents = null;
                Pool.Perform(xrm => { ents = xrm.RetrieveMultiple(qe); });
                allContactsList.AddRange(ents.Entities);
                moreRecords = ents.MoreRecords; //check to see if we have more records in the system

                if (moreRecords)
                {
                    pageNumber++;
                }
            }

            //replace the current cached list with the updated list
            //this ensures old contacts that were deleted are not included anymore
            lock (_cachedContacts)
            {
                _cachedContacts = allContactsList;
            }
        }

        public static void Logout()
        {
            HttpContext.Current.Session["CRMuser"] = null;
        }

        public static bool NotAuthorized()
        {
            return SessionContact == null;
        }

        public static bool Authorized()
        {
            return SessionContact != null;
        }

        public static void SetUserPermissions()
        {
            //get from appconfig
            var entRead = ConfigurationManager.AppSettings["CRMentity_read"];
            var entCreate = ConfigurationManager.AppSettings["CRMentity_create"];
            var entUpdate = ConfigurationManager.AppSettings["CRMentity_update"];
            var relatedRead = ConfigurationManager.AppSettings["CRMrelated_read"];
            var relatedCreate = ConfigurationManager.AppSettings["CRMrelated_create"];
            var relatedUpdate = ConfigurationManager.AppSettings["CRMrelated_update"];

            //parse into List<string>
            var entReadList = entRead.Split(',').Select(sValue => sValue.Trim()).ToList();
            var entCreateList = entCreate.Split(',').Select(sValue => sValue.Trim()).ToList();
            var entUpdateList = entUpdate.Split(',').Select(sValue => sValue.Trim()).ToList();
            var relatedReadList = relatedRead.Split(',').Select(sValue => sValue.Trim()).ToList();
            var relatedCreateList = relatedCreate.Split(',').Select(sValue => sValue.Trim()).ToList();
            var relatedUpdateList = relatedUpdate.Split(',').Select(sValue => sValue.Trim()).ToList();

            //add to session
            var entPermissions = new EntityPermissionsContext(entReadList, entCreateList, entUpdateList);
            var relatedPermissions = new EntityPermissionsContext(relatedReadList, relatedCreateList, relatedUpdateList);
            var permContext = new SecurityContext(entPermissions, relatedPermissions);
            
            UserPermissions = permContext;
        }
    }
}