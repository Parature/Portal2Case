using System;
using System.Collections.Generic;
using System.Linq;
using Microsoft.Xrm.Sdk;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Portal2Case.classes
{
    /// <summary>
    /// Wrapper for storing the custom converters. 
    /// Stores the custom converters invoked when a specific type is found. 
    /// For CRM entities.
    /// 
    /// JsonNet has major issues deserializing some CRM collections. 
    /// This coaxes the the collections through so the attributes are actually deserialized.
    /// </summary>
    class CustomJsonConverters
    {
        public static JsonConverter[] Get()
        {
            var arr = new JsonConverter[]
            {
                new AttributeCollectionConverter(), 
                new FormattedValueCollectionConverter(),
                new RelatedEntityConverter()
            };
            return arr;
        } 
    }

    /// <summary>
    /// Deserialize JSON of an Attribute Collection
    /// </summary>
    public class AttributeCollectionConverter : JsonCreationConverter<AttributeCollection>
    {
        protected override AttributeCollection Create(Type objectType, JObject jObject)
        {
            return new AttributeCollection();
        }

        private bool FieldExists(string fieldName, JObject jObject)
        {
            return jObject[fieldName] != null;
        }
    }

    /// <summary>
    /// Deserialize a FormattedValue Collection
    /// </summary>
    public class FormattedValueCollectionConverter : JsonCreationConverter<FormattedValueCollection>
    {
        protected override FormattedValueCollection Create(Type objectType, JObject jObject)
        {
            return new FormattedValueCollection();
        }

        private bool FieldExists(string fieldName, JObject jObject)
        {
            return jObject[fieldName] != null;
        }
    }

    /// <summary>
    /// Deserialize 'Related Entity' objects
    /// </summary>
    public class RelatedEntityConverter : JsonCreationConverter<RelatedEntityCollection>
    {
        protected override RelatedEntityCollection Create(Type objectType, JObject jObject)
        {
            return new RelatedEntityCollection();
        }

        private bool FieldExists(string fieldName, JObject jObject)
        {
            return jObject[fieldName] != null;
        }
    }

    /// <summary>
    /// Use the above three 'special' deserializers if necessary where CRM uses generic collections
    /// Otherwise will use the default JSON.net deserializer.
    /// </summary>
    /// <typeparam name="T"></typeparam>
    public abstract class JsonCreationConverter<T> : JsonConverter
    {
        protected abstract T Create(Type objectType, JObject jObject);

        public override bool CanConvert(Type objectType)
        {
            return typeof(T).IsAssignableFrom(objectType);
        }

        public override object ReadJson(JsonReader reader,
                                        Type objectType,
                                         object existingValue,
                                         JsonSerializer serializer)
        {
            // Load JObject from stream
            JObject jObject = JObject.Load(reader);

            // Create target object based on JObject
            T target = Create(objectType, jObject);

            if (target is AttributeCollection)
            {
                //populate the attribute collection
                var objVals = jObject.Children().FirstOrDefault(a => a.Path == "$values").Value<JProperty>();
                foreach (var item in objVals.Children<JArray>().Values())
                {
                    //json object in the array
                    var attr = JsonConvert.DeserializeObject<KeyValuePair<string, dynamic>>(item.ToString(),
                        new JsonSerializerSettings()
                        {
                            TypeNameHandling = TypeNameHandling.All
                        });

                    (target as AttributeCollection).Add(attr);
                }
            }
            else if (target is FormattedValueCollection)
            {
                //populate the attribute collection
                var objVals = jObject.Children().FirstOrDefault(a => a.Path == "$values").Value<JProperty>();
                foreach (var item in objVals.Children<JArray>().Values())
                {
                    //json object in the array
                    var attr = JsonConvert.DeserializeObject<KeyValuePair<string, string>>(item.ToString(),
                        new JsonSerializerSettings()
                        {
                            TypeNameHandling = TypeNameHandling.All
                        });

                    (target as FormattedValueCollection).Add(attr);
                }
            }
            else if (target is RelatedEntityCollection)
            {
                //populate the attribute collection
                var objVals = jObject.Children().FirstOrDefault(a => a.Path == "$values").Value<JProperty>();
                foreach (var item in objVals.Children<JArray>().Values())
                {
                    //json object in the array
                    var attr = JsonConvert.DeserializeObject<KeyValuePair<Relationship, EntityCollection>>(item.ToString(),
                        new JsonSerializerSettings()
                        {
                            TypeNameHandling = TypeNameHandling.All
                        });

                    (target as RelatedEntityCollection).Add(attr);
                }
            }
            else
            {
                // Populate the object properties
                serializer.Populate(jObject.CreateReader(), target);
            }

            return target;
        }

        public override void WriteJson(JsonWriter writer,
                                       object value,
                                       JsonSerializer serializer)
        {
            throw new NotImplementedException();
        }
    }
}
