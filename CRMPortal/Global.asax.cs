using System;
using System.Collections.Generic;
using System.Configuration;
using System.Web;
using System.Web.Caching;
using System.Web.Http.Cors;
using System.Web.SessionState;
using Microsoft.Xrm.Client;
using Newtonsoft.Json;
using Portal2Case.classes;
using Portal2Case.services.filters;
using System.Web.Http;

namespace Portal2Case
{
    public class Global : HttpApplication
    {
        private const string WebApiPrefix = "api";
        private static readonly string WebApiExecutionPath = String.Format("~/{0}", WebApiPrefix);
        private const int CacheRenewInterval = 30;
        public List<Action> OnCacheExpired = new List<Action>()
        {
            //Add long-running static Actions here
            //They'll run every CacheRenewalInterval
            SessionManagement.CacheContactList
        };

        /// <summary>
        /// Configures application-level configs:
        ///     1. Configure the WebAPI with CORS, customer serializer/deserializer, and routes
        ///     2. Create a pool of XrmServiceContexts for thread safety
        ///     3. Initialize a periodic caching of contacts 
        /// </summary>
        /// <param name="sender"></param>
        /// <param name="e"></param>
        protected void Application_Start(object sender, EventArgs e)
        {
            var config = GlobalConfiguration.Configuration;
            var corsDomain = ConfigurationManager.AppSettings["CorsDomainAllowed"];
            var corsConfig = new EnableCorsAttribute(corsDomain, "*", "*")
            {
                //This will allow Cookies in all modern browsers.
                //IE8/9 will use a postMessage proxy - they don't support CORS well
                SupportsCredentials = true
            };
            config.EnableCors(corsConfig);
            //MUST be 'ALL' for proper deserialization right now. 
            config.Formatters.JsonFormatter.SerializerSettings.TypeNameHandling = TypeNameHandling.All;
            config.Filters.Add(new ExceptionFilter());
            WebApiConfig.Register(config);
            /*
             * Initialize the connection 'pool'. 
             * It's really a bunch resources which act on delegates
             */
            SessionManagement.Pool = new ActorPool<CrmOrganizationServiceContext>(30, () =>
            {
                var connection = new CrmConnection("Xrm");
                return new CrmOrganizationServiceContext(connection);
            });

            //Example of fields which are retrieved for ALL contacts in CRM. Used in lookups if the GUID lookup method isn't used
            SessionManagement.CrmContactLookupFields = new List<string>() { "emailaddress1" };

            //Scheduled tasks based off of cache expiration
            //Start all actions right off the batt though
            foreach (var action in OnCacheExpired)
            {
                action();
            }
            ScheduledTask("CacheInvalidated", CacheRenewInterval);
        }

        void Application_BeginRequest(Object source, EventArgs e)
        {
            //IE needs this policy header for CORS
            //Feel free to change
            HttpContext.Current.Response.AddHeader("p3p", "CP=\"CAO PSA OUR\"");
        }

        protected void Application_AcquireRequestState(object sender, EventArgs e)
        {
            //Redirect to SSO link if enabled in settings
            bool ssoEnabled;
            Boolean.TryParse(ConfigurationManager.AppSettings["SSOenabled"], out ssoEnabled);

            /*
             * Redirect if using SSO and the user is not authorized
             * WebResources and ScriptResources are weird cases -> Session is null even if authed. Passing through, shouldn't be a security risk
             */
            if (SessionManagement.NotAuthorized()
                && Request.Url.LocalPath.IndexOf("/Auth.aspx", StringComparison.OrdinalIgnoreCase) >= 0)
            {
                Response.Redirect("");
            }
        }

        protected void Application_AuthenticateRequest(object sender, EventArgs e)
        {
            //If this request is a call to the Controllers, we only want readonly access
            if (IsWebApiRequest())
            {
                HttpContext.Current.SetSessionStateBehavior(SessionStateBehavior.ReadOnly);
            }
        }

        private static bool IsWebApiRequest()
        {
            return HttpContext.Current.Request.AppRelativeCurrentExecutionFilePath != null
                && HttpContext.Current.Request.AppRelativeCurrentExecutionFilePath.StartsWith(WebApiExecutionPath);
        }

        #region Cache Expiration Scheduler
        /// <summary>
        /// Periodically invalidate the cache, which is stored in PortalCRUD
        /// </summary>
        /// <param name="name">Name of the cache which is invalidated</param>
        /// <param name="minutes">Number of minutes until the cache is invalidated </param>
        private void ScheduledTask(string name, int minutes)
        {
            HttpRuntime.Cache.Insert(name, minutes, null,
                DateTime.Now.AddMinutes(minutes), Cache.NoSlidingExpiration,
                CacheItemPriority.NotRemovable, CacheItemRemoved);
        }

        /// <summary>
        /// Runs when cache is invalidated. 
        /// </summary>
        /// <param name="jobKeyName"></param>
        /// <param name="period"></param>
        /// <param name="reason"></param>
        public void CacheItemRemoved(string jobKeyName, object period, CacheItemRemovedReason reason)
        {
            if (jobKeyName == "CacheInvalidated")
            {
                //start asynchronously.
                //This is a LONG running process, and we don't want to block requests unecessarily 
                var t = new System.Threading.Tasks.Task(() =>
                {
                    //run all queued up actions that need to happen
                    foreach (var action in OnCacheExpired)
                    {
                        action();
                    }

                    // recursively call function - restart the cache expiration period
                    ScheduledTask(jobKeyName, Convert.ToInt32(period));
                });

                //start the asynchronous task of caching all CRM contacts
                t.Start();
            }

        }
        #endregion
    }
}