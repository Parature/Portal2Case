# Portal2Case
The Microsoft Parature Portal2Case for .NET allows you to integrate a Parature Portal with Dynamics CRM's Case tracking system. It is a C# sample implementation for exposing a client-facing API for Dynamics CRM's normally CSR-focused Data Services. The functionality looks to mimic the Out-of-the-box functionality of Parature Portal Ticketing:

* Users can log into a website (the Parature Portal) to track their service requests (Cases)
* Cases can be created in real-time
* Status and history can be tracked for all of their Cases
* Answers from the Knowledgebase auto-suggested during Case creation
* Manage fields visible on Portal using CRM Saved Views

## Contribute
Please see the separate documentation on [contributing](CONTRIBUTING.md) to the ParatureSDK.

# Configuration
Configuration is a bit of a winding path with a lot of small steps. Bear with it - this integration is configuration-heavy but maintenance-light by design. Keep notes, and record logins - for each of the systems accessed. There's a lot to keep track of and due dilligence will save a lot of time. The overall configuration can take approximately 2 hours, and a lot more if any issues arise. Understanding the core technology will help tremendously. Configuration will be split into two sections: development and production. There are some minor configuration changes necessary when migrating to production, so this will be highlighted and commented upon.

#### Caveats
* This does not cover the methodology for importing CRM contacts into parture. See the [architectural overview documentation] for more information. In summary:
 * Contacts _must_ exist in both Parature and CRM. SSO (recommended) or data Import both valid options
 * Contacts need to be related in some fashion (recommendation: Username in Parature = GUID from CRM)
* Provided styling most likely won't work with many Portal Templates out of the box. Some minor changes will be necessary.
* Portal2Case does not work as-is with Safari. It relies on 3rd party cookies, which are disabled by default in Safari.

#### Preparation
1. Ensure you have environments for:
 * Parature
 * Dynamics CRM 2013/2015 (2011 should work but is not guaranteed). On-prem, non-IFD deployments is out of scope of this documentation.
 * Hosting (localhost is fine for testing)
2. Apply for SSO through the [Parature Partner Portal](http://partners.support.parature.com/)
3. Get familiar with "PortalAsIdP" SSO - [check a sample with SAML](https://github.com/brtubb/ParatureSampleSP-SAML)
4. Establish primary Unique Identifier between CRM Contacts and Parature Customers.
5. Read through the [architectural overview documentation](http://partners.support.parature.com/FileManagement/Download/78ee543ac214437bb159135c76d7fe4c). It'll help with any troubleshooting

#### Initial Development Configuration
_CRM_
[It is recommended to test on a [Trial Version](http://www.microsoft.com/en-us/dynamics/crm-free-trial-overview.aspx) first]

1. Import the managed (recommended) or unmanaged solutions ([documentation](http://technet.microsoft.com/en-us/library/dn531198%28 v=crm.7%29.aspx))
 * Found in /crmSolutions. Order for install: 
  1. Portal2Case_1_0{_managed}.zip
  2. Portal2Case_Comments_1_0{_managed}.zip
 * Remember to publish the customizations after import

_Parature_
[It is recommended to not develop on a live environment. Develop before Go-Live or in Sandbox]

1. Style your portal. You can find templates [here](http://templates.supportcenteronline.com/)
2. Request "PortalAsIdP" SSO for the development environment. See README [here under Usage section](https://github.com/brtubb/ParatureSampleSP-SAML/blob/master/SAMLdecoder/README.md)
 * For the Url and Port of the testing environment, provide "http://localhost:64659/" (default for this project)
3. In the Portal bottom file, link to all JS and css files under the [/portal](portal) folder
 * Order is important
 * initScript.js needs to be modified
 * See a guide [here](portal/LinkingToPortal.md)

_This Service_
It's assumed that this site will be hosted locally during development, then moved to a production server during production. This section will focus only on running on Localhost with the default port settings.

1. Modify Global.asax to include SSO redirect and Session management for users.
 * This is a complex topic so see the guide [here](SingleSignOn.md)
2. In the Web.Config file
 1. Modify the Xrm connection string to point to your CRM environment. Guide on simplified connection strings [here](http://msdn.microsoft.com/en-us/library/gg695810.aspx).
 2. Modify the "CorsDomainAllowed" under the appSettings section
  * This will be the base url of the portal. Example: "http://{farm}.parature.com" in a default configuration

#### Moving to Production
If you made it here, congratulations! Hardest part is done. Sadly, some parameters will have to change. 

_Checklist_
Make sure you do all items before moving to production.
* Domain mask the portal
* Determine the hosting location (and url) of this service that is internet-facing
* Complete portal design and test locally with this integration

_Changes_
1. Point this integration to your production CRM system.
 * Same steps as in development section.
 * Remember to import the CRM solutions! Definitely use the managed solutions!
2. Request/modify "PortalAsIdP" again.
 * This time, the Url and Port won't be localhost - it'll be the url of your hosting environment (called the "ACS url")
3. Change the portal bottom file to poing to the JS/CSS files (see step #3 under the above _Parature_ section) to the production server
 * Before you may have had "http://localhost:64659/portal/js/classes.js"
 * Now it needs to be "http{s}://{your-hosting-url}/portal/js/classes.js"
 * This needs to be changed for 5 files: p2c_styling.css, classes.js, initScript.js, jquery.p2c.js, ui.js
4. Modify initScript.js on the production server to use your production server's url
 * Before you may have had "http://localhost:64659"
 * Now it needs to be "http{s}://{your-hosting-url}"
5. Go through the "_This Service_" section again from above
 * Double check the CRM connection string
 * Change the "CorsDomainAllowed" in the Web.config to your Parature Portal's url
6. In ~/Auth.aspx, change the "originRestriction" object's properties to use the portal's url
 * Was: "*"
 * Now: "http{s}://{portal-url}.com"
