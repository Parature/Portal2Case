using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;

namespace Portal2Case.classes
{
    public class ForbiddenAccessException : Exception
    {
        public ForbiddenAccessException()
        {
        }

        public ForbiddenAccessException(string message)
            : base(message)
        {
        }

        public ForbiddenAccessException(string message, Exception inner)
            : base(message, inner)
        {
        }
    }
}