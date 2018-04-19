/* ***** BEGIN LICENSE BLOCK *****
Version: MPL 1.1/GPL 2.0/LGPL 2.1

The contents of this file are subject to the Mozilla Public License Version
1.1 (the "License"); you may not use this file except in compliance with
the License. You may obtain a copy of the License at
http://www.mozilla.org/MPL/

Software distributed under the License is distributed on an "AS IS" basis,
WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
for the specific language governing rights and limitations under the
License.

The Original Code is Quick Locale Switcher code.

The Initial Developer of the Original Code is Martijn Kooij a.k.a. Captain Caveman.

Alternatively, the contents of this file may be used under the terms of
either the GNU General Public License Version 2 or later (the "GPL"), or
the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
in which case the provisions of the GPL or the LGPL are applicable instead
of those above. If you wish to allow use of your version of this file only
under the terms of either the GPL or the LGPL, and not to allow others to
use your version of this file under the terms of the MPL, indicate your
decision by deleting the provisions above and replace them with the notice
and other provisions required by the GPL or the LGPL. If you do not delete
the provisions above, a recipient may use your version of this file under
the terms of any one of the MPL, the GPL or the LGPL.

***** END LICENSE BLOCK ***** */
"use strict";
/* jshint ignore:start */
const {classes: Cc, interfaces: Ci, utils: Cu} = Components;
Cu.import("resource://gre/modules/Services.jsm");
//Cu.import("resource://gre/modules/FileUtils.jsm");
const EXPORTED_SYMBOLS = ["commonQLS"];
/* jshint ignore:end */
//commonQLS.dump();

var commonQLS = {

  chromeReg: Cc["@mozilla.org/chrome/chrome-registry;1"].getService(Ci.nsIXULChromeRegistry),
  //chromeRegSea: Cc["@mozilla.org/chrome/chrome-registry;1"].getService(Ci.nsIChromeRegistrySea),
  rdfService: Cc["@mozilla.org/rdf/rdf-service;1"].getService(Ci.nsIRDFService),
  epService: Cc["@mozilla.org/uriloader/external-protocol-service;1"].getService(Ci.nsIExternalProtocolService),
  oQLSPref: Services.prefs.getBranch("extensions.qls2."),
  oPref: Services.prefs.getBranch("general.useragent."),
  oDefPref: Services.prefs.getDefaultBranch("general.useragent."),
  oALPref: Services.prefs.getBranch("intl."),
  oSCPref: Services.prefs.getBranch("spellchecker."),
  QLSHostToLocale: [],
  QLSSwitchingAcceptLanguages: null,
  sDefaultLocale: null,
  generalUseragentLocale: "general.useragent.locale",

  QLSGetEmailAddress: function(sValue)
  {
    if (sValue && sValue != "") {
      let iPos1 = sValue.indexOf("<"),
      iPos2 = sValue.indexOf(">");
      if (iPos1 >= 0 && iPos2 >= 0)
        sValue = sValue.substring(iPos1 + 1, iPos2); //Get the e-mail address.
    }
    return sValue;
  },

  ChangeLocaleSeamonkey: function(sLocale)
  {
    let oRDF = commonQLS.rdfService,
    QLS_InProfile = true,
    oDS;

    try {
      oDS = oRDF.GetDataSourceBlocking("rdf:chrome");
    } catch(e) {
      return;
    }

    let inProfile = oDS.GetTarget(oRDF.GetResource("urn:mozilla:package:qls"), oRDF.GetResource("http://www.mozilla.org/rdf/chrome#locType"), true);
    if (inProfile instanceof Ci.nsIRDFLiteral && inProfile.Value == "install")
      QLS_InProfile = false;

    try {
      let chromeRegistry = commonQLS.chromeReg;
      /*
      if (! ("selectLocaleForPackage" in chromeRegistry))
        chromeRegistry = commonQLS.chromeRegSea;
      */
      chromeRegistry.selectLocaleForPackage(sLocale, "qls", QLS_InProfile);
    } catch(e) {}
  },

  InitDefaultSeamonkey: function()
  {
    if (commonQLS.sDefaultLocale.length < 10)
      return;
    //if (commonQLS.sDefaultLocale.length > 10)

    let chromeRegistry = commonQLS.chromeReg;
    commonQLS.sDefaultLocale = chromeRegistry.getSelectedLocale("global");

    if (("selectLocaleForPackage" in chromeRegistry)) {
      let QLS_InProfile = true,
      oRDF = commonQLS.rdfService,
      oDS;

      try {
        oDS = oRDF.GetDataSourceBlocking("rdf:chrome");
      } catch(e) {
        return;
      }

      let inProfile = oDS.GetTarget(oRDF.GetResource("urn:mozilla:package:mozgest"), oRDF.GetResource("http://www.mozilla.org/rdf/chrome#locType"), true);
      if (inProfile instanceof Ci.nsIRDFLiteral && inProfile.Value == "install")
        QLS_InProfile = false;
      let QLSLocale = chromeRegistry.getSelectedLocale("qls");
      chromeRegistry.selectLocaleForPackage(QLSLocale, "qls", QLS_InProfile);
    }
  },

  OpenSettings: function(window)
  {
    //toggle instantApply pref?
    let bInstantApply = Services.prefs.getBoolPref("browser.preferences.instantApply");

    //ugh MODAL
    //window.openDialog("chrome://qls/content/qlssettings.xul", "qls-settings", "chrome,toolbar,resizable,centerscreen" + (bInstantApply ? ",dialog=no" : ",modal,dialog"));
    window.openDialog("chrome://qls/content/qlssettings.xul", "qls-settings", "chrome,toolbar,resizable,centerscreen" + (bInstantApply ? ",dialog=no" : ",dialog"));
    //window.openDialog("chrome://qls/content/qlssettings.xul", "qls-settings", "chrome,titlebar,toolbar,centerscreen,modal,resizable");
  },

  GetLocale: function()
  {
    try {
      return commonQLS.oPref.getComplexValue("locale", Ci.nsIPrefLocalizedString).data;
    } catch(e) {}
    return commonQLS.oPref.getCharPref("locale");
  },

  GetDefaultLocale: function()
  {
    try {
      return commonQLS.oDefPref.getComplexValue("locale", Ci.nsIPrefLocalizedString).data;
    } catch(e) {}
    return commonQLS.oDefPref.getCharPref("locale");
  },

  GetSeamonkeyLocale: function()
  {
    let chromeRegistry = commonQLS.chromeReg;
    return chromeRegistry.getSelectedLocale("qls");
  },

  SetLocale: function(sData)
  {
    let oPLS = Cc["@mozilla.org/pref-localizedstring;1"].createInstance(Ci.nsIPrefLocalizedString);
    oPLS.data = sData;
    commonQLS.oPref.setComplexValue("locale", Ci.nsIPrefLocalizedString, oPLS);
  },

  UpdateAcceptLanguages: function(sData, bReloadBrowser,win)
  {
    let sAL = commonQLS.GetAcceptLanguages(),
    aAL = sAL.split(','),
    sSearch = sData,
    iIndex = commonQLS.ArrayIndexOf(aAL, sSearch);

    sSearch = commonQLS.GetCCode(sSearch);
    if (iIndex == -1)
      iIndex = commonQLS.ArrayIndexOf(aAL, sSearch);
    //Remove lang code from the accept languages.
    while (iIndex >= 0) {
      aAL.splice(iIndex, 1);
      iIndex = commonQLS.ArrayIndexOf(aAL, sSearch);
      if (iIndex == -1) {
        sSearch = commonQLS.GetCCode(sSearch);
        iIndex = commonQLS.ArrayIndexOf(aAL, sSearch);
      }
    }
    //Add it at the beginning again, most detailed must come first.
    if (sData.length > sSearch) {
      aAL.unshift(sData);
      if (sSearch != sData)
        aAL.unshift(sSearch);
    } else {
      aAL.unshift(sSearch);
      if (sData != sSearch)
        aAL.unshift(sData);
    }
    sAL = aAL.join(',');

    commonQLS.QLSSwitchingAcceptLanguages = true;
    commonQLS.SetAcceptLanguages(sAL);
    commonQLS.QLSSwitchingAcceptLanguages = false;

    if (typeof gBrowser !== "undefined" && bReloadBrowser)
      win.gBrowser.reload();
  },

  GetAcceptLanguages: function(bForceGetCurrentValue)
  {
    let sResult = commonQLS.GetQLSPref("backup_acceptlanguages", "");
    if ((!sResult || sResult == "") || bForceGetCurrentValue) {
      try {
        sResult = commonQLS.oALPref.getComplexValue("accept_languages", Ci.nsIPrefLocalizedString).data;
      } catch(e) {
        sResult = "";
      }
      if (sResult == "")
        sResult = commonQLS.oALPref.getCharPref("accept_languages");
    }
    if (!commonQLS.QLSSwitchingAcceptLanguages)
      commonQLS.SetQLSPref("backup_acceptlanguages", sResult);
    return sResult;
  },

  SetAcceptLanguages: function(sData)
  {
    let oPLS = Cc["@mozilla.org/pref-localizedstring;1"].createInstance(Ci.nsIPrefLocalizedString);
    oPLS.data = sData;
    commonQLS.oALPref.setComplexValue("accept_languages", Ci.nsIPrefLocalizedString, oPLS);
  },

  QLSGetEditorForNode: function(oNode)
  {
    if (oNode instanceof HTMLHtmlElement)
      oNode = oNode.ownerDocument.defaultView;
    if (oNode instanceof Window) {
      let oSession = oNode.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIWebNavigation).QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIEditingSession);
      if (oSession.windowIsEditable(oNode))
        return oSession.getEditorForWindow(oNode);
    } else if (!oNode.readOnly)
      return oNode.QueryInterface(Ci.nsIDOMNSEditableElement).editor;
    return null;
  },

  DoLocaleWorkAround: function(QLSOverlay,window)
  {
    //Showing about:config seems to solve the problem of not being able to change non-installed locale (often) in Ff 1.0.7 and 1.4
    //window.open("chrome://qls/content/qlsreloadchrome.xul", "qlspleasewait", "chrome,close,titlebar,modal,centerscreen");
    //loading about:config doesn't help change locale anymore...

    let checkResult = {},
    bAskRestart = commonQLS.oQLSPref.getBoolPref("askautorestart"),
    bRestart,
    sTitle,
    sMsg,
    sNotify,
    document = window.document;

    try {
      if (bAskRestart == true) {

        sTitle = document.getElementById("mCavemanQLS").getAttribute('label');
        sMsg = document.getElementById("msCavemanQLS2").getAttribute('statustext');
        sNotify = document.getElementById("msCavemanQLS").getAttribute('statustext');

        bRestart = Services.prompt.confirmCheck(window, sTitle, sMsg, sNotify, checkResult);
        if (checkResult.value)
          commonQLS.oQLSPref.setBoolPref("askautorestart", false);
      }

      if (bRestart == true || bAskRestart == false)
        commonQLS.restart();

    } catch(e) {
// this section could be deleted, somebody didn't know how to restart old fox
      let bNotify = commonQLS.oQLSPref.getBoolPref("notifyrestart");
      if (bNotify != true)
        return;
        commonQLS.restart();

      //Show message in other versions.
      if (!document.getElementById("mCavemanQLS") && !document.getElementById("mpCavemanQLS"))
        return;
      sTitle = document.getElementById("mCavemanQLS").getAttribute('label');
      sMsg = document.getElementById("mpCavemanQLS").getAttribute('statustext');
      sNotify = document.getElementById("msCavemanQLS").getAttribute('statustext');
      Services.prompt.alertCheck(window, sTitle, sMsg, sNotify, checkResult);
      if (checkResult.value)
        commonQLS.oQLSPref.setBoolPref("notifyrestart", false);
    }
  },

  restart: function()
  {
    let obs,startup,
    cancelQuit = Cc["@mozilla.org/supports-PRBool;1"].createInstance(Ci.nsISupportsPRBool);
    if (typeof Services.startup === 'undefined') {//ff 4.0
      obs = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
      startup = Cc["@mozilla.org/toolkit/app-startup;1"].getService(Ci.nsIAppStartup);
    } else {//ff 4.0+
      obs = Services.obs;
      startup = Services.startup;
    }

    obs.notifyObservers(cancelQuit, "quit-application-requested","restart");
    if (cancelQuit.data)
      return; // somebody canceled our quit request
    startup.quit(Ci.nsIAppStartup.eAttemptQuit | Ci.nsIAppStartup.eRestart);
  },

  GetSpellCheckerDictionary: function()
  {
    let sResult = "";
    if (commonQLS.oSCPref.prefHasUserValue("dictionary")) {
      try {
        sResult = commonQLS.oSCPref.getComplexValue("dictionary", Ci.nsIPrefLocalizedString).data;
      } catch(e) {
        sResult = commonQLS.oSCPref.getCharPref("dictionary");
        if (sResult == "")
          sResult = commonQLS.sDefaultLocale;
      }
    } else
      sResult = commonQLS.sDefaultLocale;
    return sResult;
  },

  SetSpellCheckerDictionary: function(sData)
  {
    let oPLS = Cc["@mozilla.org/pref-localizedstring;1"].createInstance(Ci.nsIPrefLocalizedString);
    oPLS.data = sData;
    commonQLS.oSCPref.setComplexValue("dictionary", Ci.nsIPrefLocalizedString, oPLS);
  },

  GetQLSPref: function(sName)
  {
    try {
      return commonQLS.oQLSPref.getComplexValue(sName, Ci.nsIPrefLocalizedString).data;
    } catch(e) {}
    return commonQLS.oQLSPref.getCharPref(sName);
  },

  SetQLSPref: function(sName, sData)
  {
    let oPLS = Cc["@mozilla.org/pref-localizedstring;1"].createInstance(Ci.nsIPrefLocalizedString);
    oPLS.data = sData;
    commonQLS.oQLSPref.setComplexValue(sName, Ci.nsIPrefLocalizedString, oPLS);
  },

  GetQLSPrefBool: function(sName)
  {
    return commonQLS.oQLSPref.getBoolPref(sName);
  },

  SetQLSPrefBool: function(sName, bData)
  {
    commonQLS.oQLSPref.setBoolPref(sName, bData);
  },

  ArrayIndexOf: function(aArray, sFind, bTrySoftMatch)
  {
    let aValue,
    iIndex = -1,
    iLen = aArray.length,
    iIndex2, iLen2;

    for (iIndex = 0; iIndex < iLen; iIndex++) if (commonQLS.Alltrim(aArray[iIndex].toLowerCase()) == commonQLS.Alltrim(sFind.toLowerCase())) return iIndex;
    if (bTrySoftMatch)
    {
      for (iIndex = 0; iIndex < iLen; iIndex++)
      {
        aValue = aArray[iIndex].split(/,| |\.|\-/);
        iLen2 = aValue.length;
        for (iIndex2 = 0; iIndex2 < iLen2; iIndex2++)
        {
          if (commonQLS.Alltrim(aValue[iIndex2].toLowerCase()) == commonQLS.Alltrim(sFind.toLowerCase()))
            return iIndex;
        }
      }
    }

    return -1;
  },

  Alltrim: function(sText)
  {
    while (sText.charAt(0) == ' ' || sText.charCodeAt(0) == 13 || sText.charCodeAt(0) == 10 || sText.charCodeAt(0) == 9)
      sText = sText.substring(1);
    while (sText.charAt(sText.length-1) == ' ' || sText.charCodeAt(sText.length-1) == 13 || sText.charCodeAt(sText.length-1) == 10 || sText.charCodeAt(sText.length-1) == 9)
      sText = sText.substring(0, sText.length-1);
    return sText;
  },

  GetCCode: function(sData)
  {
    let iIndex = sData.search('-');
    if (iIndex >= 0)
      return sData.substring(0, iIndex);
    return sData;
  },

  QLSGetHost: function(sURI)
  {
    let sHost = sURI;

    try {
      let oIOS = Services.io,
      oURI = oIOS.newURI(sURI, null, null);

      oURI.spec = sURI;
      sHost = oURI.host;
    } catch(e) {}

    return sHost;
  },

  QLSTLDToLocaleP: function()
  {
    if (commonQLS.aQLSTLDToLocales.length === 0)
      commonQLS.QLSInitTLDToLocales();

    //build list
    if (!commonQLS.aQLSTLDToLocalesP) {
      let list = "";
      for (let i = 0; i < commonQLS.aQLSTLDToLocales.length; i++) {
        list += "," + commonQLS.aQLSTLDToLocales[i][0];
      }
      commonQLS.aQLSTLDToLocalesP = list.substring(1);
      return commonQLS.aQLSTLDToLocalesP;
    } else //already built
      return commonQLS.aQLSTLDToLocalesP;
  },

  QLSTLDToLocale: function(sData)
  {
    if (commonQLS.aQLSTLDToLocales.length === 0)
      commonQLS.QLSInitTLDToLocales();

    sData = sData.toLowerCase();

    for (let i = 0; i < commonQLS.aQLSTLDToLocales.length; i++) {
      if (sData == commonQLS.aQLSTLDToLocales[i][1])
        return commonQLS.aQLSTLDToLocales[i][0];
    }
    return "";
  },

  aQLSTLDToLocalesP: null,
  aQLSTLDToLocales: [],
  QLSInitTLDToLocales: function()
  {
    let l = commonQLS.aQLSTLDToLocales;
    l.push(['af-ZA','za']);
    l.push(['am-ET','et']);
    l.push(['ar-AE','ae']);
    l.push(['ar-BH','bh']);
    l.push(['ar-DZ','']);
    l.push(['ar-EG','eg']);
    l.push(['ar-IQ','iq']);
    l.push(['ar-JO','jo']);
    l.push(['ar-KW','kw']);
    l.push(['ar-LB','lb']);
    l.push(['ar-LY','ly']);
    l.push(['ar-MA','ma']);
    l.push(['arn-CL','']);
    l.push(['ar-OM','om']);
    l.push(['ar-QA','qa']);
    l.push(['ar-SA','sa']);
    l.push(['ar-SY','']);
    l.push(['ar-TN','tn']);
    l.push(['ar-YE','ye']);
    l.push(['as-IN','']);
    l.push(['ast-ES','']);
    l.push(['az-AZ-Cyrl','az']);
    l.push(['az-AZ-Latn','']);
    l.push(['ba-RU','']);
    l.push(['be-BY','by']);
    l.push(['ber-DZ','dz']);
    l.push(['bg-BG','bg']);
    l.push(['bn-BD','bd']);
    l.push(['bn-IN','']);
    l.push(['bo-BT','bt']);
    l.push(['bo-CN','']);
    l.push(['br-FR','']);
    l.push(['bs-BA-Cyrl','ba']);
    l.push(['bs-BA-Latn','']);
    l.push(['ca-AD','ad']);
    l.push(['ca-ES','']);
    l.push(['ca-FR','']);
    l.push(['ca-valencia','']);
    l.push(['co-FR','']);
    l.push(['cs-CZ','cz']);
    l.push(['cy-GB','cym']);
    l.push(['da-DK','dk']);
    l.push(['de-AT','at']);
    l.push(['de-CH','ch']);
    l.push(['de-DE','de']);
    l.push(['de-LI','li']);
    l.push(['de-LU','']);
    l.push(['div-MV','mv']);
    l.push(['dsb-DE','']);
    l.push(['el-GR','gr']);
    l.push(['en-AU','au']);
    l.push(['en-BZ','bz']);
    l.push(['en-CA','ca']);
    l.push(['en-CB','cb']);
    l.push(['en-GB','uk']);
    l.push(['en-IE','ie']);
    l.push(['en-IN','']);
    l.push(['en-JA','ja']);
    l.push(['en-MY','']);
    l.push(['en-NZ','nz']);
    l.push(['en-PH','']);
    l.push(['en-SG','']);
    l.push(['en-TT','tt']);
    l.push(['en-US','us']);
    l.push(['en-ZA','']);
    l.push(['en-ZW','zw']);
    l.push(['eo-EO','eo']);
    l.push(['es-AR','ar']);
    l.push(['es-BO','bo']);
    l.push(['es-CL','cl']);
    l.push(['es-CO','co']);
    l.push(['es-CR','cr']);
    l.push(['es-CU','']);
    l.push(['es-DO','do']);
    l.push(['es-EC','ec']);
    l.push(['es-ES','es']);
    l.push(['es-ES-ts','']);
    l.push(['es-GT','gt']);
    l.push(['es-HN','hn']);
    l.push(['es-MX','mx']);
    l.push(['es-NI','ni']);
    l.push(['es-PA','pa']);
    l.push(['es-PE','pe']);
    l.push(['es-PR','pr']);
    l.push(['es-PY','py']);
    l.push(['es-SV','sv']);
    l.push(['es-US','']);
    l.push(['es-UY','uy']);
    l.push(['es-VE','ve']);
    l.push(['et-EE','ee']);
    l.push(['eu-ES','']);
    l.push(['fa-IR','ir']);
    l.push(['fi-FI','fi']);
    l.push(['fil-PH','ph']);
    l.push(['fo-FO','fo']);
    l.push(['fr-BE','']);
    l.push(['fr-CA','']);
    l.push(['fr-CH','']);
    l.push(['fr-FR','fr']);
    l.push(['fr-LU','']);
    l.push(['fr-MC','mc']);
    l.push(['fur-IT','']);
    l.push(['fy-NL','']);
    l.push(['ga-IE','']);
    l.push(['gbz-AF','af']);
    l.push(['gd-GB','']);
    l.push(['gl-ES','']);
    l.push(['gsw-FR','']);
    l.push(['gu-IN','']);
    l.push(['ha-NG-Latn','ng']);
    l.push(['he-IL','il']);
    l.push(['hi-IN','in']);
    l.push(['hr-BA','']);
    l.push(['hr-HR','hr']);
    l.push(['hsb-DE','']);
    l.push(['hu-HU','hu']);
    l.push(['hy-AM','am']);
    l.push(['id-ID','id']);
    l.push(['ii-CN','']);
    l.push(['is-IS','is']);
    l.push(['it-CH','']);
    l.push(['it-IT','it']);
    l.push(['iu-CA-Cans','']);
    l.push(['iu-CA-Latn','']);
    l.push(['ja-JP','jp']);
    l.push(['ja-JP-mac','']);
    l.push(['ka-GE','ge']);
    l.push(['kk-KZ','kz']);
    l.push(['kl-GL','gl']);
    l.push(['km-KH','kh']);
    l.push(['kn-IN','']);
    l.push(['kok-IN','']);
    l.push(['ko-KR','kr']);
    l.push(['ky-KG','kg']);
    l.push(['lb-LU','lu']);
    l.push(['lo-LA','la']);
    l.push(['lt-LT','lt']);
    l.push(['lug-UG','']);
    l.push(['lv-LV','lv']);
    l.push(['mi-NZ','']);
    l.push(['mk-MK','mk']);
    l.push(['ml-IN','']);
    l.push(['mn-CN','']);
    l.push(['mn-MN','mn']);
    l.push(['moh-CA','']);
    l.push(['mr-IN','']);
    l.push(['ms-BN','bn']);
    l.push(['ms-MY','my']);
    l.push(['mt-MT','mt']);
    l.push(['nb-NO','no']);
    l.push(['ne-NP','np']);
    l.push(['nl-BE','be']);
    l.push(['nl-NL','nl']);
    l.push(['nn-NO','']);
    l.push(['nso-ZA','']);
    l.push(['oc-FR','']);
    l.push(['or-IN','']);
    l.push(['pa-IN','']);
    l.push(['pl-PL','pl']);
    l.push(['ps-AF','']);
    l.push(['pt-BR','br']);
    l.push(['pt-PT','pt']);
    l.push(['qut-GT','']);
    l.push(['quz-BO','']);
    l.push(['quz-EC','']);
    l.push(['quz-PE','']);
    l.push(['rm-CH','']);
    l.push(['ro-RO','ro']);
    l.push(['ru-RU','ru']);
    l.push(['rw-RW','rw']);
    l.push(['sah-RU','']);
    l.push(['sa-IN','']);
    l.push(['se-FI','']);
    l.push(['se-NO','']);
    l.push(['se-SE','se']);
    l.push(['si-LK','lk']);
    l.push(['sk-SK','sk']);
    l.push(['sl-SI','si']);
    l.push(['sma-NO','']);
    l.push(['sma-SE','']);
    l.push(['smj-NO','']);
    l.push(['smj-SE','']);
    l.push(['smn-FI','']);
    l.push(['sms-FI','']);
    l.push(['son-NE','']);
    l.push(['sq-AL','al']);
    l.push(['sr-BA-Cyrl','']);
    l.push(['sr-BA-Latn','']);
    l.push(['sr-ME','']);
    l.push(['sr-RS','']);
    l.push(['sv-FI','']);
    l.push(['sv-SE','']);
    l.push(['sw-KE','ke']);
    l.push(['syr-SY','sy']);
    l.push(['ta-IN','']);
    l.push(['ta-LK','']);
    l.push(['te-IN','']);
    l.push(['tg-TJ-Cyrl','tj']);
    l.push(['th-TH','th']);
    l.push(['tk-TM','tm']);
    l.push(['tn-ZA','']);
    l.push(['tr-TR','tr']);
    l.push(['tt-RU','']);
    l.push(['ug-CN','']);
    l.push(['uk-UA','ua']);
    l.push(['ur-IN','ur']);
    l.push(['ur-PK','pk']);
    l.push(['uz-UZ-Cyrl','uz']);
    l.push(['uz-UZ-Latn','']);
    l.push(['vi-VN','vn']);
    l.push(['wa-BE','']);
    l.push(['wo-SN','sn']);
    l.push(['xh-ZA','']);
    l.push(['yo-NG','']);
    l.push(['zh-CHS','chs']);
    l.push(['zh-CHT','cht']);
    l.push(['zh-CN','cn']);
    l.push(['zh-HK','hk']);
    l.push(['zh-MO','mo']);
    l.push(['zh-SG','sg']);
    l.push(['zh-TW','tw']);
    l.push(['zu-ZA','']);
  },

  //get the first window available
  window: function()
  {
    let wm = Services.wm.getMostRecentWindow,
    mainWin = wm("navigator:browser");//Firefox/Palemoon/Seamonkey
    if (!mainWin)
      mainWin = wm("mail:3pane");//thunderbird
    return mainWin;
  },

  dump: function(aString)
  {
    try {
      Services.console.logStringMessage("QLS Debug Message:\n " + aString);
    } catch(e) {
      commonQLS.catchError(e);
    }
  },

  catchError: function(e)
  {
    //http://blogger.ziesemer.com/2007/10/javascript-debugging-in-firefox.html
    try {
      if (e.stack)
        Cu.reportError(e.stack);
    } finally {
      //throw e;
      return null;
    }
  }

};
