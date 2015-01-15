using System;
using System.Collections;
using System.Collections.Generic;
using System.Configuration;
using System.IO;
using System.Linq;
using System.Text;
using System.Web;
using opentoken;

namespace Portal2Case.classes
{
    /// <summary>
    /// Wrapper class for SSO via opentoken.
    /// Can decode the HttpRequests to check for an opentoken, and help with parsing of the form-encoded data
    /// </summary>
    public class OpenTokenSso
    {
        /// <summary>
        /// Decode the opentoken
        /// </summary>
        /// <param name="req"></param>
        /// <param name="agentcfg">agentConfig string. This is provided by Parature, and should be considered EXTREMELY sensitive.</param>
        /// <returns></returns>
        public static Dictionary<string, string> DecodeOpenToken(HttpRequest req, string agentcfg)
        {
            IDictionary userInfo = null;

            // convert string to stream
            var byteArray = Encoding.UTF8.GetBytes(agentcfg);
            var stream = new MemoryStream(byteArray);

            //SSO with pingfed
            var agent = new Agent(stream);
            try
            {
                //throws an exception if 
                userInfo = agent.ReadToken(req);
            }
            catch (Exception ex)
            {
                //TODO: Should log here. 
                //There will be exceptions if the token provided is wrong, there is a server/server clock inconsistency, or something else is wrong.
            }

            return (userInfo as Dictionary<string, string>);
        }

        /// <summary>
        /// Parse the opentoken. The opentoken is a weak abstraction of the SAML data.
        /// Data from a SAML SSO exchange will generally include several k-v pairs.
        ///  * SAML_SUBJECT - string with the contents of a SAML subject tag
        ///  * __DATA__ - Form-encoded data from the SAML attributes
        /// This method is generally used with the latter pair.
        /// </summary>
        /// <param name="opentoken">The decoded opentoken.</param>
        /// <param name="attrParamName">Name of the key which stores the attribute form-encoded string</param>
        /// <returns></returns>
        public static Dictionary<string, string> ParseDataAttributes(Dictionary<string, string> opentoken, string attrParamName)
        {
            var attributes = Uri.UnescapeDataString(opentoken[attrParamName]);

            var keyValuePairs = attributes.Split('&')
                .Where(value => !value.StartsWith("permission")) //permission is a non-unique key, throwing exceptions
                .Select(value => value.Split('='))
                .ToDictionary(pair => pair[0], pair => pair[1]);

            return keyValuePairs;
        }

        public static string GetSsoAttribute(Dictionary<string, string> attributes, string ssoAttribute)
        {
            string uid;
            attributes.TryGetValue(ssoAttribute, out uid);

            return uid;
        }
    }
}