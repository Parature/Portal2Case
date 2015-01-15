using System.Web.Http;
using System.Web.Http.Cors;
using System.Web.Mvc;
using System.Web.SessionState;
using Microsoft.Xrm.Sdk.Messages;
using Microsoft.Xrm.Sdk.Metadata;
using Portal2Case.classes;

namespace Portal2Case.services
{
    //[AuthFilter]  // uncomment if you don't want ANYONE to be able to access entity metadata without being logged in.
    [SessionState(SessionStateBehavior.ReadOnly)]
    [EnableCors(origins: "http://demo.parature.com", headers: "*", methods: "*", SupportsCredentials = true)]
    public class MetadataController : ApiController
    {
        public EntityMetadata GetEntityMetadata(string entityLogicalName)
        {
            var entReadPermissions = SessionManagement.UserPermissions.EntityPermissions.Read;
            var relatedReadPermissions = SessionManagement.UserPermissions.RelatedEntityPermissions.Read;
            
            //allow metadata retrieval for both primary entities and related entities
            if (entReadPermissions.Contains(entityLogicalName) == false
                && relatedReadPermissions.Contains(entityLogicalName) == false)
            {
                throw new ForbiddenAccessException("Not authorized to access this entity from the portal");
            }

            // Get the metadata for the currently list's entity
            // This metadata is used to create a "Property Descriptor Collection"
            var mdRequest = new RetrieveEntityRequest()
            {
                EntityFilters = EntityFilters.All,
                LogicalName = entityLogicalName,
                RetrieveAsIfPublished = false
            };

            EntityMetadata entityData = null;

            SessionManagement.Pool.Perform(xrm =>
            {
                // Execute the request
                var entityResponse = (RetrieveEntityResponse)xrm.Execute(mdRequest);
                entityData = entityResponse.EntityMetadata;
            });

            return entityData;
        }
    }
}