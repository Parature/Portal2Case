using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http.Formatting;
using System.Net.Http.Headers;
using System.Runtime.Serialization;
using System.Text;
using System.Threading.Tasks;
using System.Web;
using Microsoft.Xrm.Sdk;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Portal2Case.formatter
{
    public class AttributeJsonFormatter<T> : JsonConverter
    {
        public override bool CanConvert(Type objectType)
        {
            return Attribute.GetCustomAttributes(objectType).Any(v => v is KnownTypeAttribute);
        }

        public override object ReadJson(JsonReader reader, Type objectType, object existingValue,
            JsonSerializer serializer)
        {
            // Load JObject from stream
            var jObject = JObject.Load(reader);

            // Create target object based on JObject
            var attrs = Attribute.GetCustomAttributes(objectType); // Reflection. 

            // Displaying output. 
            foreach (var attr in attrs)
            {
                if (attr is KnownTypeAttribute)
                {
                    var k = (KnownTypeAttribute) attr;
                    var props = k.Type.GetProperties();
                    var found = true;
                    foreach (var f in jObject)
                    {
                        if (props.Any(z => z.Name == f.Key)) continue;
                        found = false;
                        break;
                    }

                    if (found)
                    {
                        var target = Activator.CreateInstance(k.Type);
                        serializer.Populate(jObject.CreateReader(), target);
                        return target;
                    }
                }
            }
            throw new Exception();
            // Populate the object properties
        }

        public override void WriteJson(JsonWriter writer, object value, JsonSerializer serializer)
        {
            throw new NotImplementedException();
        }
    }
}