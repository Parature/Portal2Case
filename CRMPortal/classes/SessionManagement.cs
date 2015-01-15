using System;
using System.Collections.Generic;
using System.Configuration;
using System.Linq;
using System.Web;
using Microsoft.Crm.Sdk.Messages;
using Microsoft.Xrm.Client;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;
using Xrm;

namespace Portal2Case.classes
{
    public class SessionManagement
    {
        public static ActorPool<XrmServiceContext> Pool;
        /*
         * Contains the list of ALL CRM contacts. These are cached to limit the delay of lookups during SSO.
         * Further, allows much more complicated lookup queries (case-insensitive, or regexes) than a QueryExpression can handle
         * It is replaced periodically in a very large re-retrieval.
         */
        private static List<Entity> _cachedContacts = new List<Entity>(); 

        public static Contact SessionContact
        {
            get
            {
                Contact user = null;
                try
                {
                    user = (Contact) HttpContext.Current.Session["CRMuser"];
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

        public static Contact RetrieveContact(string uid)
        {
            var crmContactFieldLookup = ConfigurationManager.AppSettings["CRMContactFieldLookup"];

            var resultEntity =
                _cachedContacts.FirstOrDefault(ent => ent.GetAttributeValue<string>(crmContactFieldLookup) == uid);

            if (resultEntity != null)
            {
                return (Contact)resultEntity;
            }

            //unable to log in the user. They don't exist in this parature instance.
            throw new ParatureException("Unable to find your account record. ");
        }

        //Warning: This is likely causing gen2 garbage collection, which will result in global halt during GC
        //Really needs to be updated to be more efficient, but there aren't any ways to retrieve customers who are deleted from CRM (so we can remove internally)
        //TODO: Profile and fix for GC reasons
        public static void RetrieveContactList()
        {
            var crmContactFieldLookup = ConfigurationManager.AppSettings["CRMContactFieldLookup"];
            var pageNumber = 1;
            var moreRecords = true;
            var allContactsList = new List<Entity>();
            
            while (moreRecords)
            {
                //query expression
                var qe = new QueryExpression(Contact.EntityLogicalName)
                {
                    ColumnSet = new ColumnSet(crmContactFieldLookup),
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

            //TODO: Profile to see how slow this is when we have thousands and thousands of records...
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
            SessionManagement.UserPermissions = permContext;
        }
    }
}