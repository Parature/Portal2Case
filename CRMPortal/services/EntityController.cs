using System;
using System.Collections.Generic;
using System.Linq;
using System.Web.Http;
using System.Web.Http.Cors;
using System.Web.Mvc;
using System.Web.SessionState;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Messages;
using Microsoft.Xrm.Sdk.Metadata;
using Microsoft.Xrm.Sdk.Query;
using Newtonsoft.Json;
using Portal2Case.classes;
using Portal2Case.services.filters;

namespace Portal2Case.services
{
    [AuthFilter]
    [SessionState(SessionStateBehavior.ReadOnly)]
    [EnableCors(origins: "http://demo.parature.com", headers: "*", methods: "*", SupportsCredentials = true)]
    public class EntityController : ApiController
    {
        public EntityCollection GetEntityCollection(string entityLogicalName)
        {
            var user = SessionManagement.SessionContact;
            var permissions = SessionManagement.UserPermissions.EntityPermissions.Read;

            if (!permissions.Contains(entityLogicalName, StringComparer.CurrentCultureIgnoreCase))
            {
                throw new ForbiddenAccessException("Not authorized to access this entity from the portal");
            }

            var qe = new QueryExpression(entityLogicalName)
            {
                ColumnSet = new ColumnSet(true)
            };
            qe.Criteria.AddCondition("customerid", ConditionOperator.Equal, user.Id);

            EntityCollection ents = null;
            SessionManagement.Pool.Perform(xrm => { ents = xrm.RetrieveMultiple(qe); });

            return ents;
        }

        public Entity GetEntity(string entityLogicalName, string guid)
        {
            var user = SessionManagement.SessionContact;
            var permissions = SessionManagement.UserPermissions.EntityPermissions.Read;

            //ensure user isn't trying to retrieve an entity they don't have access to
            if (!permissions.Contains(entityLogicalName, StringComparer.CurrentCultureIgnoreCase))
            {
                throw new ForbiddenAccessException("Not authorized to access this entity from the portal");
            }

            var entRef = new EntityReference
            {
                Id = new Guid(guid),
                LogicalName = entityLogicalName
            };

            Entity ent = null;
            SessionManagement.Pool.Perform(xrm => { ent = xrm.Retrieve(entRef.LogicalName, entRef.Id, new ColumnSet(true)); });

            //throw exception if it's the wrong user's case
            if (ent.GetAttributeValue<EntityReference>("customerid").Equals(user.ToEntityReference()) == false)
            {
                throw new ForbiddenAccessException("You are not authorized to access this entity.");
            }

            //map to a friendly (de)serializable version
            return ent;
        }

        /// <summary>
        /// Create an Entity directly.
        /// </summary>
        /// <param name="entityLogicalName"></param>
        /// <param name="attri">Currently unused. The attribute list is manually parsed from the POST body.</param>
        /// <returns>Guid of created object</returns>
        public Guid PostEntity(string entityLogicalName, [FromUri] AttributeCollection attri)
        {
            var user = SessionManagement.SessionContact;
            var permissions = SessionManagement.UserPermissions.EntityPermissions.Create;

            //not allowed to create entities of this type
            if (!permissions.Contains(entityLogicalName, StringComparer.CurrentCultureIgnoreCase))
            {
                throw new ForbiddenAccessException("Not authorized to access this entity from the portal");
            }

            //read the post body
            var result = Request.Content.ReadAsStringAsync().Result;
            var attributes = JsonConvert.DeserializeObject<AttributeCollection>(result, CustomJsonConverters.Get());

            var ent = new Entity(entityLogicalName);

            //populate the basics for the entity
            foreach (var attr in attributes)
            {
                ent[attr.Key] = attr.Value;
            }

            var resp = new Guid();
            SessionManagement.Pool.Perform(xrm =>
            {
                ent["customerid"] = user.ToEntityReference();
                resp = xrm.Create(ent);
            });

            return resp;
        }

        /// <summary>
        /// Create an entity related to another entity.
        /// </summary>
        /// <param name="entityLogicalName">Logical Name of the </param>
        /// <param name="guid"></param>
        /// <param name="relatedEntityLogicalName"></param>
        /// <returns></returns>
        public Guid PostRelatedEntity(string entityLogicalName, string guid, string relatedEntityLogicalName)
        {
            var user = SessionManagement.SessionContact;
            var entityPermissions = SessionManagement.UserPermissions.EntityPermissions.Read;
            var relatedPermissions = SessionManagement.UserPermissions.RelatedEntityPermissions.Create;

            //parse post body
            var result = Request.Content.ReadAsStringAsync().Result;
            var attributes = JsonConvert.DeserializeObject<AttributeCollection>(result, CustomJsonConverters.Get());

            /*
             * Permissions checking
             */
            //parent entity, which will have the secondary associated with it
            var mainEntity = GetEntity(entityLogicalName, guid);
            if(mainEntity.GetAttributeValue<EntityReference>("customerid").Equals(user.ToEntityReference()) == false)
            {
                //not the correct user
                throw new ForbiddenAccessException("Not authorized to create related entities for other customers' entities.");
            }
            //ensure user isn't trying to create an entity they don't have access to
            if (entityPermissions.Contains(entityLogicalName, StringComparer.CurrentCultureIgnoreCase) == false
                || relatedPermissions.Contains(relatedEntityLogicalName, StringComparer.CurrentCultureIgnoreCase) == false)
            {
                throw new ForbiddenAccessException("Not authorized to create this entity from the portal");
            }

            //end resulting entity
            var ent = new Entity(relatedEntityLogicalName);

            //populate the basics for the entity
            foreach (var attr in attributes)
            {
                ent[attr.Key] = attr.Value;
            }

            var resp = new Guid();
            SessionManagement.Pool.Perform(xrm =>
            {
                //link the objects
                ent["regardingobjectid"] = mainEntity.ToEntityReference();
                resp = xrm.Create(ent);
            });

            return resp;
        }

        public EntityCollection GetRelatedEntities(string entityLogicalName, string guid, string relatedEntityLogicalName)
        {
            var user = SessionManagement.SessionContact;
            var entityPermissions = SessionManagement.UserPermissions.EntityPermissions.Read;
            var relatedPermissions = SessionManagement.UserPermissions.RelatedEntityPermissions.Read;

            /*
             * Permissions checking
             */
            //parent entity, which will have the secondary associated with it
            var mainEntity = GetEntity(entityLogicalName, guid);
            if (mainEntity.GetAttributeValue<EntityReference>("customerid").Equals(user.ToEntityReference()) == false)
            {
                //not the correct user
                throw new ForbiddenAccessException("Not authorized to create related entities for other customers' entities.");
            }
            //ensure user isn't trying to get an entity they don't have access to
            if (entityPermissions.Contains(entityLogicalName, StringComparer.CurrentCultureIgnoreCase) == false
                || relatedPermissions.Contains(relatedEntityLogicalName, StringComparer.CurrentCultureIgnoreCase) == false)
            {
                throw new ForbiddenAccessException("Not authorized to create this entity from the portal");
            }

            //Get the entities associated with the main entity
            var qe = new QueryExpression(relatedEntityLogicalName)
            {
                ColumnSet = new ColumnSet(true),
            };
            qe.Criteria.AddCondition("regardingobjectid", ConditionOperator.Equal, mainEntity.Id.ToString());

            EntityCollection ents = null;
            SessionManagement.Pool.Perform(xrm => { ents = xrm.RetrieveMultiple(qe); });

            return ents;
        }

        #region Private Functions -> Not guaranteed to be secure! Currently unused
        /// <summary>
        /// Get a list of all entities in the system
        /// </summary>
        /// <returns></returns>
        private IEnumerable<string> GetEntities()
        {
            var req = new RetrieveAllEntitiesRequest
            {
                EntityFilters = EntityFilters.Entity,
                RetrieveAsIfPublished = true
            };

            IEnumerable<string> entityList = new List<string>();
            SessionManagement.Pool.Perform(xrm =>
            {
                var response = xrm.Execute(req) as RetrieveAllEntitiesResponse;
                if (response != null)
                {
                    entityList = response.EntityMetadata.Select(m => m.LogicalName);
                }
            });

            return entityList;
        }
        
        /// <summary>
        /// Filters by attribute logical name. Equals only
        /// </summary>
        /// <param name="entityLogicalName"></param>
        /// <param name="attrLogicalName"></param>
        /// <param name="attrVal"></param>
        /// <returns></returns>
        private EntityCollection GetEntityCollectionWhere(string entityLogicalName, string attrLogicalName, string attrVal)
        {
            var user = SessionManagement.SessionContact;
            var permissions = SessionManagement.UserPermissions.EntityPermissions;

            var qe = new QueryExpression(entityLogicalName)
            {
                ColumnSet = new ColumnSet(true),
            };
            qe.Criteria.AddCondition(attrLogicalName, ConditionOperator.Equal, attrVal);

            EntityCollection ents = null;
            SessionManagement.Pool.Perform(xrm => { ents = xrm.RetrieveMultiple(qe); });

            return ents;
        }
        #endregion
    }
}