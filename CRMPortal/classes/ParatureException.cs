using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;

namespace Portal2Case.classes
{
    /*
     * Defining this custom Exception to differentiate
     * between exceptions to display errors for and those thrown explicitly by
     * other classes. All messages should be custom defined so they are user friendly.
     */
    public class ParatureException : Exception
    {
        public ParatureException()
        {
        }

        public ParatureException(string message)
            : base(message)
        {
        }

        public ParatureException(string message, Exception inner)
            : base(message, inner)
        {
        }
    }
}