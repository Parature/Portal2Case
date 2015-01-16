# Integrating with Single Sign On
Single Sign On (SSO) is a simple concept with very complex implementations. We try to keep it as simple as possible, but it may still be confusing _how_ it connects to the Portal2Case integration. Let's walk through a small scenario.

Say the user has a login to the parature portal with their email and a password. This is quite common for simple portal integrations. If we happen to fortunate, and CRM doesn't allow duplicate Contacts with the same email (and they also all have emails), then we can use this to our advantage. Starting with the [sample "PortalAsIdP"](https://github.com/brtubb/ParatureSampleSP-SAML) configuration using SAML, we can copy the section that parses SAML data:

```
//This section is in Global.asax, function: Application_AcquireRequestState
//These two lines aren't really used right now, and are left as reference
bool ssoEnabled;
Boolean.TryParse(ConfigurationManager.AppSettings["SSOenabled"], out ssoEnabled);

//This should look familiar to those who have tested with sample previously mentioned. It's slightly adapted to this scenario
var options = new Options(KentorAuthServicesSection.Current);
var samlVal = Request["SAMLResponse"];
if (samlVal != null)
{
    KentorAuthServicesSection.Current.IdentityProviders.RegisterIdentityProviders(options);
    KentorAuthServicesSection.Current.Federations.RegisterFederations(options);
    var req = new HttpRequestWrapper(Context.Request);
    var reqData = new HttpRequestData(req);
    var samlResp = CommandFactory.GetCommand(CommandFactory.AcsCommandName)
        .Run(reqData, options);
    var claims = samlResp.Principal.Claims
        .Where(c => c.Type != "permissions") //permissions has multiple keys/values and won't work in a dictionary
        .ToDictionary(c => c.Type, c => c.Value);
                
    /*
    * Scenario: email is the unique identifier in CRM.
    * Usually it should be GUID, but requirements can change.
    */
    var email = claims["email"];
    //Retrieving from a cached list of contacts. See the SessionManagement class for more information
    var contact = SessionManagement.RetrieveContact("emailaddress1", email);
    if (contact != null)
    {
        //store in session. User is authenticated
        SessionManagement.SessionContact = contact;
        SetUserPermissions();
    }

    Response.Redirect("~/Auth.aspx");
}
```
[_note: Remember to add the required config sections to the Web Config._ It's all in the example project previously mentioned.]

The "new stuff" is at the bottom after the claims are parsed. Let's walk through it line-by-line.
First, grab the customer data we care about (email in this case).
```
    /*
    * Scenario: email is the unique identifier in CRM.
    * Usually it should be GUID, but requirements can change.
    */
    var email = claims["email"];
```
_Normally, we recommend using GUIDs, but this keeps the concepts a little easier to understand_

So now we have the customer's email. There's a lot of power in this simple claim. The implications are:
1. They are signed in to the portal (it's the server giving us this information)
2. They _cannot_ modify this information without us knowing about it (Exception thrown)

Awesome! Now we can use this to find them in CRM.

```
    var contact = SessionManagement.RetrieveContact("emailaddress1", email);
    if (contact != null)
    {
        //store in session. User is authenticated
        SessionManagement.SessionContact = contact;
        SetUserPermissions();
    }
```

Two things are happening here. First, we try to find this contact based off their email. Look at the 'SessionManagement' class to understand what is going on here. In summary, we are checking their email against a list of cached contacts from CRM. Second, if we do find a matching contact, we have a match and can authenticate them! Setting the SessionContact in effect finalizes the process. When this happens - we fully trust that we know who the user is in CRM. This ends the login flow for all intents and purposes, and they can begin to query CRM. The final line (SetUserPermissions) is a helper method to limit the entities the contact can query from CRM. It is configured in the Web.Config.

#### Final Note
As you may discern, there are a million ways to match contacts between systems. It really depends on the data quality in both Parature and CRM. A "quality" system has two major features:
1. The contact exists in both Parature and CRM (so we should always match)
2. There are no duplicates.
 * There should never be a question of which CRM contact the Parature Contacts matches

This second point is particularly troublesome with some CRM systems which do not have fields forces as globally unique. Therefore, to bypass this whole painful scenario we recommend SSO _into_ the portal, with the Contact in parature having a username = the CRM Guid (which is almost 100% likely to be unique).