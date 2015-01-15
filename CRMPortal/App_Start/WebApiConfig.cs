using System.Net.Http.Headers;
using System.Web.Http;

namespace Portal2Case
{
    public static class WebApiConfig
    {
        public static void Register(HttpConfiguration config)
        {
            /*
             * Order matters!
             */
            config.Routes.MapHttpRoute(
                name: "Auth",
                routeTemplate: "api/{controller}",
                defaults: new
                {
                    controller = "Auth"
                }
            );

            config.Routes.MapHttpRoute(
                name: "Metadata",
                routeTemplate: "api/Metadata/{entityLogicalName}",
                defaults: new
                {
                    controller = "Metadata",
                    entityLogicalName = RouteParameter.Optional
                }
            );

            config.Routes.MapHttpRoute(
                name: "EntityService",
                routeTemplate: "api/Entity/{entityLogicalName}/{guid}",
                defaults: new
                {
                    controller = "Entity",
                    guid = RouteParameter.Optional
                }
            );

            config.Routes.MapHttpRoute(
                name: "EntityRelatedService",
                routeTemplate: "api/Entity/{entityLogicalName}/{guid}/{relatedEntityLogicalName}",
                defaults: new
                {
                    controller = "Entity",
                    relatedEntityLogicalName = RouteParameter.Optional
                }
            );

            config.Routes.MapHttpRoute(
                name: "Default",
                routeTemplate: "api/{controller}/{id}",
                defaults: new { id = RouteParameter.Optional }
            );

            config.Formatters.JsonFormatter.SupportedMediaTypes.Add(new MediaTypeHeaderValue("text/html"));
        }
    }
}
