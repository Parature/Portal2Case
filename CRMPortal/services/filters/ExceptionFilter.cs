using System;
using System.Net;
using System.Net.Http;
using System.Web.Http.Filters;
using Portal2Case.classes;

namespace Portal2Case.services.filters
{
    public class ExceptionFilter : ExceptionFilterAttribute
    {
        public override void OnException(HttpActionExecutedContext ctx)
        {
            var exceptionType = ctx.Exception;

            //401 - user isn't authenticated
            if (exceptionType is UnauthorizedAccessException)
            {
                ctx.Response = new HttpResponseMessage(HttpStatusCode.Unauthorized);
            }

            //403 - access not allowed to this entity
            if (exceptionType is ForbiddenAccessException)
            {
                ctx.Response = new HttpResponseMessage(HttpStatusCode.Forbidden);
            }
        }
    }
}