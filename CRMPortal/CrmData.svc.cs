using System.Data.Services;
using System.Data.Services.Common;
using Microsoft.Xrm.Client;

namespace Portal2Case
{
    public class CrmData : DataService<CrmOrganizationServiceContext>
    {
        // This method is called only once to initialize service-wide policies.
        public static void InitializeService(DataServiceConfiguration config)
        {
            config.SetEntitySetAccessRule("*", EntitySetRights.AllRead);
            config.SetServiceOperationAccessRule("*", ServiceOperationRights.All);
            config.DataServiceBehavior.MaxProtocolVersion = DataServiceProtocolVersion.V2;
        }
    }
}
