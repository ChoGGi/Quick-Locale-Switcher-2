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
if (typeof Cc === "undefined") var Cc = Components.classes;
if (typeof Ci === "undefined") var Ci = Components.interfaces;
if (typeof Cu === "undefined") var Cu = Components.utils;
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("chrome://qls/content/qlscommon.jsm");
/* jshint ignore:end */
//commonQLS.dump();

var QLSOverlay = {

  //holdover from old fox?
  QLSPreInit: function()
  {
    if (!commonQLS.oQLSPref && !this.bQLSInitializing) {
      this.bQLSInitializing = true;
      setTimeout(function() {
        QLSOverlay.QLSInit();
      }, 500);
    }
  },

  QLSInit: function()
  {
    this.QLSPrefObserver = {
      observe: function(subject, topic, prefName) {
        if (topic == "nsPref:changed" && prefName == commonQLS.generalUseragentLocale)
          QLSOverlay.CheckLocale();

        if (topic == "nsPref:changed" && prefName == "intl.accept_languages")
          commonQLS.GetAcceptLanguages(true);

        if (topic == "nsPref:changed" &&
            prefName == "spellchecker.dictionary" &&
            commonQLS.GetQLSPrefBool("switch_contentlocale") &&
            commonQLS.GetCCode(commonQLS.GetQLSPref("contentlocale")) != commonQLS.GetSpellCheckerDictionary() &&
            commonQLS.GetQLSPref("contentlocale") != commonQLS.GetSpellCheckerDictionary()) {
          commonQLS.SetQLSPref("previouscontentlocale", commonQLS.GetQLSPref("contentlocale"));
          commonQLS.SetQLSPref("contentlocale", commonQLS.GetSpellCheckerDictionary());
          QLSOverlay.CheckLocale();
        }

      }
    };

    this.QLSSettingsObserver = {
      observe: function(subject, topic, state) {
        if (topic == "qls-settings" && state == 'OK')
          QLSOverlay.ApplySettings();
      }
    };

    this.QLSHTTPRequestObserver = {
      //observe: function(subject, topic, state) {
      observe: function(subject, topic) {
        if (topic == "http-on-modify-request") {
          let oHTTPChannel = subject.QueryInterface(Ci.nsIHttpChannel),
          sURL = oHTTPChannel.URI.spec;

          let oBrowser = QLSOverlay.QLSGetBrowserFromChannel(oHTTPChannel);
          if (oBrowser)
            QLSOverlay.QLSModifyAcceptLanguageHeader(oHTTPChannel, sURL);
        }
      }
    };

    Services.prefs.addObserver(commonQLS.generalUseragentLocale, this.QLSPrefObserver, false);
    Services.prefs.addObserver("intl.accept_languages", this.QLSPrefObserver, false);
    Services.prefs.addObserver("spellchecker.dictionary", this.QLSPrefObserver, false);

    Services.obs.addObserver(this.QLSSettingsObserver, "qls-settings", false);
    Services.obs.addObserver(this.QLSHTTPRequestObserver, "http-on-modify-request", false);

    let sDefaultLocale = commonQLS.GetQLSPref("locale");
    if (!sDefaultLocale || sDefaultLocale == "")
      sDefaultLocale = commonQLS.GetLocale();

    if (!commonQLS.oQLSPref.prefHasUserValue('locale'))
      commonQLS.SetQLSPref("locale", sDefaultLocale);

    if (!commonQLS.oQLSPref.prefHasUserValue('fallbacklocale'))
      commonQLS.SetQLSPref("fallbacklocale", sDefaultLocale);

    if (!commonQLS.oQLSPref.prefHasUserValue('contentlocale'))
      commonQLS.SetQLSPref("contentlocale", sDefaultLocale);

    if (!commonQLS.oQLSPref.prefHasUserValue('previouslocale'))
      commonQLS.SetQLSPref("previouslocale", sDefaultLocale);

    if (!commonQLS.oQLSPref.prefHasUserValue('previouscontentlocale'))
      commonQLS.SetQLSPref("previouscontentlocale", sDefaultLocale);

    commonQLS.sDefaultLocale = commonQLS.GetDefaultLocale();
    if (!commonQLS.sDefaultLocale || commonQLS.sDefaultLocale == "")
      commonQLS.sDefaultLocale = "en-US";
    if (commonQLS.sDefaultLocale.indexOf("-") == -1)
      commonQLS.sDefaultLocale = QLSOverlay.CCodeToLocale(commonQLS.sDefaultLocale);

    let oKey = document.getElementById("qls-key-switchback");
    oKey.setAttribute("modifiers", commonQLS.GetQLSPref("switchback.modifiers"));
    oKey.setAttribute("key", commonQLS.GetQLSPref("switchback.key"));


    if (typeof gBrowser !== "undefined") {//not Thunderbird
      //let tabMM = gBrowser.selectedBrowser.messageManager;
      if (window.messageManager) {
        window.messageManager.loadFrameScript("chrome://qls/content/frame-script.js",true);
        window.messageManager.addMessageListener("qls2:pageload",function(message) {
          let t = message.target;
          if (t.getAttribute("type") == "content-primary" ||
              t.getAttribute("type") == "content") {
            //make sure it uses a clean list to change flag (isn't needed for non-multiprocess)
            QLSOverlay.ApplySettings();
          }
        });
      } else {
        //fire lang switch on load (doesn't work on e10s)
        gBrowser.addEventListener("DOMContentLoaded",function(){
          if (!QLSOverlay.preventAutoSwitchOnDOMContentLoaded) {
            QLSOverlay.preventAutoSwitchOnDOMContentLoaded = true;
            QLSOverlay.QLSCheckContentLocale(false);
          }
        },true);
      }

      //fire lang switch on tab change
      let oTabs = gBrowser.tabContainer;
      if (!oTabs) {
        oTabs = gBrowser.mPanelContainer;
        oTabs.addEventListener("select", function() {
          QLSOverlay.QLSCheckContentLocale(true);
        },false);
      } else {
        oTabs.addEventListener("TabSelect", function() {
          QLSOverlay.QLSCheckContentLocale(true);
        },false);
      }

    }

    /*Gecko 2.0>, customize toolbar done...*/
    window.addEventListener("aftercustomization", function load() {
      QLSOverlay.ApplySettings();
    }, false);

    QLSOverlay.ApplySettings();
    QLSOverlay.InitDefault();
    QLSOverlay.CheckLocale();
    commonQLS.QLSSwitchingAcceptLanguages = false;

    let oContent = document.getElementById("content-frame");
    if (!oContent)
      return;

    document.addEventListener("load", function() {
      QLSOverlay.QLSTBCheckAddressField();
      oContent.addEventListener("focus", QLSOverlay.QLSTBCheckAddressField, true);
    },true);

  },

  QLSGetBrowserFromChannel: function(aChannel)
  {

    try {
      let notificationCallbacks = aChannel.notificationCallbacks ? aChannel.notificationCallbacks : aChannel.loadGroup.notificationCallbacks;
      if (!notificationCallbacks)
        return null;

      let domWin = notificationCallbacks.getInterface(Ci.nsIDOMWindow);
      if (!domWin)
        return null;
      if (domWin.top.document.location != domWin.document.location)
        return null;

      return gBrowser.getBrowserForDocument(domWin.top.document);
    } catch (e) {
      return null;
    }
  },

  QLSDeInit: function()
  {
    try {
      Services.obs.removeObserver(this.QLSSettingsObserver, "qls-settings");
      Services.obs.removeObserver(this.QLSHTTPRequestObserver, "http-on-modify-request");
      Services.prefs.removeObserver(commonQLS.generalUseragentLocale, this.QLSPrefObserver);
      Services.prefs.removeObserver("intl.accept_languages", this.QLSPrefObserver);
      Services.prefs.removeObserver("spellchecker.dictionary", this.QLSPrefObserver);

      this.QLSPrefObserver = null;
      this.QLSSettingsObserver = null;
    } catch (e) {}
  },

  InitDefault: function()
  {
    //seamonkey
    if (document.getElementById('taskPopup'))
      commonQLS.InitDefaultSeamonkey();
    //rename default menuitem
    let el = document.getElementById("defaultQLS");
    if (el) {
      let sLabel = el.getAttribute('statustext') + " (" + commonQLS.sDefaultLocale + ")";
      el.setAttribute("label", sLabel);
      el.setAttribute("ccode", commonQLS.sDefaultLocale);
    }
  },

  ApplySettings: function()
  {
    let oMItem,
    oSItem,
    el,
    bShowSep = false,
    aAllMItems = commonQLS.QLSTLDToLocaleP().split(","),
    //aAllMItems = commonQLS.QLS_ALL_LOCALES.split("#"),
    aMItems = commonQLS.GetQLSPref("visiblemenuitems").split("#");

    function setAtr(el,sLocale,sLabel)
    {
      el = document.getElementById(el);
      if (!el)
        return;
      sLocale = commonQLS.GetQLSPref(sLocale);
      sLabel = commonQLS.GetQLSPref(sLabel);
      if (sLocale == "" || sLabel == "")
        return;

      bShowSep = true;
      el.setAttribute("hidden", false);
      el.setAttribute("clocale", sLocale);
      el.setAttribute("ccode", sLocale.toLowerCase());
      el.setAttribute("label", sLabel);
    }
    //custom lang menuitems
    setAtr("qlscustom1","customlocale1","customlabel1",1);
    setAtr("qlscustom2","customlocale2","customlabel2",1);
    setAtr("qlscustom3","customlocale3","customlabel3",1);
    if (bShowSep == true) {
      el = document.getElementById("msCavemanQLS2");
      if (el)
        el.setAttribute("hidden", false);
    }

    //show checked? menuitems
    for (let i = 0; i < aAllMItems.length; i++) {
      el = document.getElementById(aAllMItems[i]);
      if (el) {
        if (el.getAttribute("ui_checked") == 'true' || el.getAttribute("content_checked") == 'true')
          el.setAttribute("hidden",false);
        else
          el.setAttribute("hidden",true);
      }
    }
    //show visible? menuitems
    for (let i = aMItems.length - 1; i > -1; i--) {
      el = document.getElementById(aMItems[i]);
      if (el) {
        let oParent = el.parentNode;
        oParent.removeChild(el);
        el.setAttribute("hidden",false);
        oParent.insertBefore(el,oParent.childNodes[6]);
      }
    }

    oSItem = document.getElementById("statusbar-QLS");
    oMItem = document.getElementById("mCavemanQLS");
    if (commonQLS.GetQLSPrefBool("hide_statusbar") && oSItem)
      oSItem.setAttribute("hidden", true);
    else if (oSItem)
      oSItem.setAttribute("hidden", false);
    if (commonQLS.GetQLSPrefBool("hide_tools") && oMItem)
      oMItem.setAttribute("hidden", true);
    else if (oMItem)
      oMItem.setAttribute("hidden", false);

    QLSOverlay.QLSInitHostLocales(true);
    window.setTimeout(function() {
      QLSOverlay.QLSTBCheckAddressField();
    }, 500);

    QLSOverlay.QLSInitStatusBar(commonQLS.GetQLSPref("locale"), commonQLS.GetQLSPref("contentlocale"));
    QLSOverlay.QLSCheckContentLocale(false);
  },

  CheckLocale: function()
  {
    //Uncheck all.
    QLSOverlay.UnCheckLocale();

    let oElements,
    //Check ui locale
    sLocale = commonQLS.GetQLSPref("locale"),
    oElement = document.getElementById(sLocale);

    if (!oElement) {
      oElements = document.getElementsByAttribute('ccode', sLocale.toLowerCase());
      for (let i = 0; i < oElements.length; i++) {
        if (oElements[i].nodeName == "menuitem")
          oElement = oElements[i];
      }
    }

    if (!oElement) {
      sLocale = commonQLS.GetSeamonkeyLocale();
      if (sLocale && sLocale != "")
        oElement = document.getElementById(sLocale);
      if (!oElement)
        oElement = document.getElementsByAttribute('ccode', sLocale.toLowerCase())[0];
    }

    if (oElement) {
      oElement.setAttribute("hidden", false);
      oElement.setAttribute("ui_checked", 'true');
    }

    //Check content locale
    let sCLocale = commonQLS.GetQLSPref("contentlocale");

    oElement = document.getElementById(sCLocale);

    if (!oElement) {
      oElements = document.getElementsByAttribute('ccode', sCLocale.toLowerCase());

      for (let i = 0; i < oElements.length; i++) {
        if (oElements[i].nodeName == "menuitem")
          oElement = oElements[i];
      }
    }

    if (!oElement) {
      sCLocale = commonQLS.GetSeamonkeyLocale();
      if (sCLocale && sCLocale != "") {
        oElement = document.getElementById(sCLocale);
        //oSBPElement = document.getElementById('sbp_' + sCLocale);
      }

      if (!oElement)
        oElement = document.getElementsByAttribute('ccode', sCLocale.toLowerCase())[0];
    }

    if (oElement) {
      oElement.setAttribute("hidden", false);
      oElement.setAttribute("content_checked", 'true');
    }
/*
    let el = document.getElementById("defaultQLS");
    if (el)
      el.setAttribute('disabled', (sLocale == commonQLS.sDefaultLocale || sCLocale == commonQLS.sDefaultLocale));
    */

    QLSOverlay.QLSInitStatusBar(sLocale, sCLocale);
  },

  UnCheckLocale: function()
  {
    let oElements;
    function setEl(attr)
    {
      oElements = document.getElementsByAttribute(attr, 'true');
      for (let i = 0; i < oElements.length; i++) {
        if (!oElements[i])
          return QLSOverlay.UnCheckLocale();
        oElements[i].setAttribute(attr, 'false');
      }
    }
    setEl('content_checked');
    setEl('ui_checked');

  },

  //toggles flag on tab switch / page load
  QLSCheckContentLocale: function(bDontReloadBrowser)
  {
    if (typeof gBrowser === "undefined")//Thunderbird
      return;

    if (commonQLS.GetQLSPrefBool("useautoswitch") && !document.getElementById("addressCol2#1") && !document.getElementById("calendar-content-box")) {
      this.QLSInitHostLocales();

      let sFallbackLocale = commonQLS.GetQLSPref("fallbacklocale"),
      //sHost = commonQLS.QLSGetHost(window.location.href),
      sHost = commonQLS.QLSGetHost(gBrowser.currentURI.spec),
      sLocale = "";

      for (let i = 0; i < commonQLS.QLSHostToLocale.length; i++) {
        if (commonQLS.QLSHostToLocale[i][0] == sHost)
          sLocale = commonQLS.QLSHostToLocale[i][1];
      }
      if (sLocale == "") {
        let oDocument;
        try {
          oDocument = gBrowser.contentDocument.documentElement;
        } catch (e) {}

        //let oDocument = gBrowser.selectedBrowser.docShell.QueryInterface(Ci.nsIWebNavigation).document.documentElement;
        if (oDocument) {
          sLocale = oDocument.getAttribute("lang");
          if (!sLocale || sLocale == "")
            sLocale = oDocument.getAttribute("xml:lang");
        }
        if (sLocale && sLocale != "" && sLocale.indexOf('-') == -1)
          sLocale = QLSOverlay.CCodeToLocale(sLocale);
      }

      if ((!sLocale || sLocale == "") && commonQLS.GetQLSPrefBool("autoswitchfortld")) {
        //Check the current Top Level Domain.
        let sTLD = sHost.substr(sHost.lastIndexOf(".") + 1);
        if (sTLD != "")
          sLocale = commonQLS.QLSTLDToLocale(sTLD);
      }

      if (!sLocale || sLocale == "")
        sLocale = sFallbackLocale;

      if (commonQLS.GetQLSPref("contentlocale") == sLocale)
        return;
      QLSOverlay.UnCheckLocale();

      commonQLS.SetQLSPref("previouscontentlocale", commonQLS.GetQLSPref("contentlocale"));
      commonQLS.SetQLSPref("contentlocale", sLocale);
      QLSOverlay.CheckLocale();

      //let resetAcceptLocale = commonQLS.oQLSPref.getBoolPref("resetaccept");
      //if (resetAcceptLocale)
        QLSOverlay.QLSChangeContentAndDictionaryLocale(sLocale, bDontReloadBrowser);

      setTimeout(function() {
        QLSOverlay.preventAutoSwitchOnDOMContentLoaded = false;
      }, 500);
    }
  },

  QLSModifyAcceptLanguageHeader: function(oHTTPChannel, sURL)
  {
    if (!commonQLS.GetQLSPrefBool("useautoswitch") &&
        commonQLS.GetQLSPrefBool("switch_accept_languages")) { //Bool label is reversed... Argh!
      return;
    }

    let sRequestAL = oHTTPChannel.getRequestHeader("Accept-Language");
    if (sRequestAL && sRequestAL == "")
      return;

    QLSOverlay.QLSInitHostLocales();
    let sHost = commonQLS.QLSGetHost(sURL),
    sLocale = "";

    for (let i = 0; i < commonQLS.QLSHostToLocale.length; i++) {
      if (commonQLS.QLSHostToLocale[i][0] == sHost) {
        sLocale = commonQLS.QLSHostToLocale[i][1];
        break;
      }
    }

    if ((!sLocale || sLocale == "") && commonQLS.GetQLSPrefBool("autoswitchfortld")) {
      //Check the current Top Level Domain.
      let sTLD = sHost.substr(sHost.lastIndexOf(".") + 1);
      if (sTLD != "")
        sLocale = commonQLS.QLSTLDToLocale(sTLD);
    }

    if (sLocale && sLocale != "") {
      if (sRequestAL.indexOf(sLocale) < 0 || sRequestAL.indexOf(sLocale) > 7) {
        sRequestAL = sLocale + "," + commonQLS.GetCCode(sLocale) + ";q=1.0," + sRequestAL;
        oHTTPChannel.setRequestHeader("Accept-Language", sRequestAL, false);
      }
    }

  },

  QLSTBCheckAddressField: function(oField)
  {
    if (typeof(awGetInputElement) == "function")
      oField = awGetInputElement(1);
    if (!oField)
      oField = document.getElementById("addressCol2#1");
    if (oField) {
      let sValue = commonQLS.QLSGetEmailAddress(oField.value);
      if (sValue && sValue != "") {
        QLSOverlay.QLSCheckTBContentLocale(sValue);
      }
    }
  },

  QLSCheckTBContentLocale: function(sEmailAddress)
  {
    if (!commonQLS.GetQLSPrefBool("useautoswitch") &&
        !document.getElementById("addressCol2#1"))
      return;

    QLSOverlay.QLSInitHostLocales();
    let sFallbackLocale = commonQLS.GetQLSPref("fallbacklocale"),
    sLocale = "";

    for (let i = 0; i < commonQLS.QLSHostToLocale.length; i++) {
      if (commonQLS.QLSHostToLocale[i][0] == sEmailAddress)
        sLocale = commonQLS.QLSHostToLocale[i][1];
    }

    if ((!sLocale || sLocale == "") && commonQLS.GetQLSPrefBool("autoswitchfortld")) {
      //Check the current Top Level Domain.
      let sTLD = sEmailAddress.substr(sEmailAddress.lastIndexOf(".") + 1);
      if (sTLD != "")
        sLocale = commonQLS.QLSTLDToLocale(sTLD);
    }

    if (!sLocale || sLocale == "")
      sLocale = sFallbackLocale;

    if (commonQLS.GetQLSPref("contentlocale") == sLocale)
      return;
    /*For TB there's no need to switch if it's not avaiable...*/
    let aMItems = commonQLS.GetQLSPref("visiblemenuitems").split("#"),
    bFound = false;

    for (let i = 0; i < aMItems.length; i++) {
      if (sLocale.indexOf(aMItems[i]) >= 0 || aMItems[i].indexOf(sLocale) >= 0)
        bFound = true;
    }

    if (!bFound)
      return;
    QLSOverlay.UnCheckLocale();
    commonQLS.SetQLSPref("previouscontentlocale", commonQLS.GetQLSPref("contentlocale"));
    commonQLS.SetQLSPref("contentlocale", sLocale);
    QLSOverlay.CheckLocale();

    QLSOverlay.QLSChangeContentAndDictionaryLocale(sLocale, false);
  },

  QLSAddHostLocale: function(sLocale)
  {
    QLSOverlay.QLSInitHostLocales();

    let oField = document.getElementById("addressCol2#1"),
    //sHost = commonQLS.QLSGetHost(window.location.href),
    sHost = commonQLS.QLSGetHost(gBrowser.currentURI.spec);

    if (oField) {
      for (let i = 1; i < 30; i++) {
        oField = document.getElementById("addressCol2#" + i);
        if (oField) {
          sHost = commonQLS.QLSGetEmailAddress(oField.value);
          QLSOverlay.QLSAddHostLocaleCheckAndStore(sLocale, sHost);
        }
      }
    } else
      QLSOverlay.QLSAddHostLocaleCheckAndStore(sLocale, sHost);
  },

  QLSAddHostLocaleCheckAndStore: function(sLocale, sHost)
  {
    let iLen = commonQLS.QLSHostToLocale.length,
    bFound = false;

    for (let i = 0; i < iLen; i++) {
      if (commonQLS.QLSHostToLocale[i][0] == sHost) {
        commonQLS.QLSHostToLocale[i][1] = sLocale;
        bFound = true;
      }
    }
    if (!bFound) {
      commonQLS.QLSHostToLocale[iLen] = [];
      commonQLS.QLSHostToLocale[iLen][0] = sHost;
      commonQLS.QLSHostToLocale[iLen][1] = sLocale;
    }
    QLSOverlay.QLSStoreHostLocalePref();
    QLSOverlay.QLSInitHostLocales(true);
  },

  QLSStoreHostLocalePref: function()
  {
    let aTemp = [],
    sHostLocale = "";

    for (let i = 0; i < commonQLS.QLSHostToLocale.length; i++) {
      aTemp[i] = commonQLS.QLSHostToLocale[i].join(';');
    }
    sHostLocale = aTemp.join(' ');
    //don't add chrome:// or about:pages
    if (sHostLocale.indexOf("chrome://") == -1 && sHostLocale.indexOf("about:") == -1)
      commonQLS.SetQLSPref("autoswitchhosts", sHostLocale);
  },

  QLSInitHostLocales: function(bForceReCreate)
  {
    if (bForceReCreate || !commonQLS.QLSHostToLocale) {
      commonQLS.QLSHostToLocale = null;
      commonQLS.QLSHostToLocale = [];

      let aTmp = commonQLS.GetQLSPref("autoswitchhosts").split(' ');

      //remove chrome:// and about: pages
      //can be removed in a few updates or so
      //no sense in looping the list, unless what we want to remove is in it
      if (aTmp.indexOf("chrome://") != -1 || aTmp.indexOf("about:") != -1) {
        for (let i = 0; i < aTmp.length; i++) {
          if (aTmp[i].indexOf("chrome://") != -1 || aTmp[i].indexOf("about:") != -1) {
            let sTmp = commonQLS.GetQLSPref("autoswitchhosts");
            sTmp = sTmp.replace(aTmp[i],"").replace("  "," ");

            commonQLS.SetQLSPref("autoswitchhosts",sTmp);
            aTmp = sTmp;
          }
        }
      }
      //remove chrome:// and about: pages
      //can be removed in a few updates or so

      //init the (cleaned) list
      //aTmp = commonQLS.GetQLSPref("autoswitchhosts").split(' ');
      for (let i = 0; i < aTmp.length; i++) {
        commonQLS.QLSHostToLocale[i] = aTmp[i].split(';');
      }

    }
  },

  QLSInitStatusBar: function(sSelectedLocale, sSelectedCLocale)
  {
    let oSBPanel = document.getElementById('statusbar-QLS'),
    oTBButton = document.getElementById('tbtnCavemanQLS'),
    oSBTooltip = document.getElementById('statusbar-tooltip-QLS-locale'),
    oSBCTooltip = document.getElementById('statusbar-tooltip-QLS-contentlocale'),
    sTooltip,
    sCTooltip;

    if (!oSBPanel && !oSBTooltip && !oSBCTooltip)
      return;
    let sDisplayLocale = sSelectedCLocale;
    if (!sDisplayLocale || sDisplayLocale == "")
      sDisplayLocale = "en-US";
    if (sDisplayLocale.indexOf("-") == -1)
      sDisplayLocale = QLSOverlay.CCodeToLocale(sDisplayLocale);
    oSBPanel.setAttribute('ccode', sDisplayLocale);
    if (oTBButton)
      oTBButton.setAttribute('ccode', sDisplayLocale);
    if (oSBPanel.getAttribute('mode') != commonQLS.GetQLSPref("statusbarmode")) {
      oSBPanel.setAttribute('mode', "text");
      //The timeout is necessary because Ff sometimes renders the icon/text in a diffent order (text first/icon first)
      window.setTimeout(function() {
        QLSOverlay.SetStatusBarMode();
      }, 1);
    }
    oSBPanel.childNodes[0].value = sDisplayLocale;

    let oElement = document.getElementById(sSelectedLocale);
    if (!oElement)
      oElement = document.getElementsByAttribute('ccode', sSelectedLocale.toLowerCase())[0];
    if (!oElement) {
      sSelectedLocale = commonQLS.GetSeamonkeyLocale();
      oElement = document.getElementById(sSelectedLocale);
      if (!oElement)
        oElement = document.getElementsByAttribute('ccode', sSelectedLocale.toLowerCase())[0];
    }

    let oCElement = document.getElementById(sSelectedCLocale);
    if (!oCElement)
      oCElement = document.getElementsByAttribute('ccode', sSelectedCLocale.toLowerCase())[0];
    if (!oCElement) {
      sSelectedCLocale = commonQLS.GetSeamonkeyLocale();
      oCElement = document.getElementById(sSelectedCLocale);
      if (!oCElement)
        oCElement = document.getElementsByAttribute('ccode', sSelectedCLocale.toLowerCase())[0];
    }

    if (!oElement && !oCElement)
      return;
    sTooltip = document.getElementById('statusbar-tooltip-QLS-locale').getAttribute('localizedpart');
    sCTooltip = document.getElementById('statusbar-tooltip-QLS-contentlocale').getAttribute('localizedpart');

    sTooltip = sTooltip.replace("&#37;", "%");
    sCTooltip = sCTooltip.replace("&#37;", "%");
    sTooltip = sTooltip.replace(/%1/, oElement.getAttribute('label'));
    sCTooltip = sCTooltip.replace(/%1/, oCElement.getAttribute('label'));

    oSBTooltip.setAttribute('value', sTooltip);
    oSBCTooltip.setAttribute('value', sCTooltip);
  },

  SetStatusBarMode: function()
  {
    let oSBPanel = document.getElementById('statusbar-QLS');
    if (oSBPanel)
      oSBPanel.setAttribute('mode', commonQLS.GetQLSPref("statusbarmode"));
  },

  SwitchSpellCheckerDictionary: function(sData)
  {
    let oSC;
    try {
      try {
        oSC = Cc['@mozilla.org/spellchecker/engine;1'].getService(Ci.mozISpellCheckingEngine);
      } catch(e) {
        try {
          oSC = Cc['@mozilla.org/spellchecker/myspell;1'].getService(Ci.mozISpellCheckingEngine);
        } catch(e) {
          throw "No Spell checking Service";
        }
      }

      let aDictionaries = {},
      aCount = {},
      aLocales,
      iIndex;

      oSC.getDictionaryList(aDictionaries, aCount);

      aLocales = aDictionaries.value;
      iIndex = commonQLS.ArrayIndexOf(aLocales, sData);
      if (iIndex == -1) {
        //Long lang code does not exist, try short one.
        sData = commonQLS.GetCCode(sData);
        iIndex = commonQLS.ArrayIndexOf(aLocales, sData);
      }

      /*Try to do a "soft" match to find a dictionary that only contains the locale, e.g. fr-classique*/
      if (iIndex == -1) {
        iIndex = commonQLS.ArrayIndexOf(aLocales, sData, true);
        if (iIndex == -1) {
          //Long lang code does not exist, try short one.
          sData = commonQLS.GetCCode(sData);
          iIndex = commonQLS.ArrayIndexOf(aLocales, sData, true);
        }
        if (iIndex >= 0) sData = aLocales[iIndex];
      }

      if (iIndex >= 0) {
        //Only set if the locale is available cause it will break spell checking if you set a not installed dict.
        oSC.dictionary = sData;
        commonQLS.SetSpellCheckerDictionary(sData);
      }

      let oEditor = commonQLS.QLSGetEditorForNode(document.commandDispatcher.focusedElement || document.commandDispatcher.focusedWindow);

      if (typeof(InlineSpellCheckerUI) == "object") {
        InlineSpellCheckerUI.clearSuggestionsFromMenu();
        InlineSpellCheckerUI.clearDictionaryListFromMenu();
      }

      try {
        if (oEditor) {
          if (typeof(InlineSpellCheckerUI) == "object") {
            InlineSpellCheckerUI.init(oEditor);
            InlineSpellCheckerUI.mInlineSpellChecker.spellCheckRange(null);
          } else {
            let oSpellChecker = oEditor.getInlineSpellChecker ? oEditor.getInlineSpellChecker(true) : oEditor.inlineSpellChecker;
            if (oSpellChecker && oSpellChecker.spellChecker) {
              if (iIndex >= 0) oSpellChecker.spellChecker.SetCurrentDictionary(sData);
              oSpellChecker.spellCheckRange(null);
            }
          }
        }
      } catch(e) {}

      //gmail special...
      if (typeof(getBrowser) != "function" || !getBrowser().contentDocument.getElementById("canvas_frame"))
        return;
      let oDocument = getBrowser().contentDocument.getElementById("canvas_frame").contentDocument;
      if (!oDocument)
        return;
      let oElements = oDocument.getElementsByTagName('iframe');
      for (let i = 0; i < oElements.length; i++) {
        if (oElements[i].className && oElements[i].className.indexOf("editable") >= 0 && oElements[i].contentWindow) {
          let oWindow = oElements[i].contentWindow,
          oESession = oWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIWebNavigation).QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIEditingSession);

          if (oESession.windowIsEditable(oWindow))
            oEditor = oESession.getEditorForWindow(oWindow);
          if (oEditor) {
            InlineSpellCheckerUI.init(oEditor);
            InlineSpellCheckerUI.mInlineSpellChecker.spellCheckRange(null);
          }
        }
      }
    } catch(e) {}
  },

  QLSChangeContentAndDictionaryLocale: function(sLocale, bDontReloadBrowser)
  {

    if (!commonQLS.GetQLSPrefBool("switch_contentlocale"))
      return;
    let bReloadBrowser = !bDontReloadBrowser && commonQLS.GetQLSPrefBool("reloadbrowserafterhalswitch");
    if (!commonQLS.GetQLSPrefBool("switch_accept_languages")) //Bool label is reversed... Argh!
      commonQLS.UpdateAcceptLanguages(sLocale, bReloadBrowser,window);

    if (!commonQLS.GetQLSPrefBool("switch_spell_dictionaries")) {
      window.setTimeout(function() {
        QLSOverlay.SwitchSpellCheckerDictionary(sLocale);
      }, 250);
    }
  },

  ChangeLocale: function(sLocale)
  {
    let bChangeLocale = true;

    if (commonQLS.GetQLSPrefBool("switch_alwaysask")) {
      let oSettings = {
        gulocale: commonQLS.GetQLSPrefBool("switch_gulocale"),
        contentlocale: commonQLS.GetQLSPrefBool("switch_contentlocale"),
        alwaysask: commonQLS.GetQLSPrefBool("switch_alwaysask"),
        accepted: false
      };
      window.openDialog("chrome://qls/content/qlsaskswitchsettings.xul", "qls-askswitchsettings", "center", oSettings);
      if (oSettings.accepted) {
        commonQLS.SetQLSPrefBool("switch_gulocale", oSettings.gulocale);
        commonQLS.SetQLSPrefBool("switch_contentlocale", oSettings.contentlocale);
        commonQLS.SetQLSPrefBool("switch_alwaysask", oSettings.alwaysask);
      } else {
        bChangeLocale = false;
        QLSOverlay.CheckLocale();
      }
    }

    if (bChangeLocale) {
      if (commonQLS.GetQLSPrefBool("useautoswitch") &&
          commonQLS.GetQLSPrefBool("switch_contentlocale")) {
        QLSOverlay.QLSAddHostLocale(sLocale);
      }

      //website lang
      if (commonQLS.GetQLSPrefBool("switch_contentlocale")) {
        commonQLS.SetQLSPref("previouscontentlocale", commonQLS.GetQLSPref("contentlocale"));
        commonQLS.SetQLSPref("contentlocale", sLocale);

        if (!commonQLS.GetQLSPrefBool("switch_accept_languages")) //Bool label is reversed... Argh!
          commonQLS.UpdateAcceptLanguages(sLocale, commonQLS.GetQLSPrefBool("reloadbrowserafterhalswitch"),window);
        if (!commonQLS.GetQLSPrefBool("switch_spell_dictionaries"))
            QLSOverlay.SwitchSpellCheckerDictionary(sLocale);
      }

      //gui lang
      if (commonQLS.GetQLSPrefBool("switch_gulocale")) {
        commonQLS.SetQLSPref("previouslocale", commonQLS.GetQLSPref("locale"));
        commonQLS.SetQLSPref("locale", sLocale);
        commonQLS.SetLocale(sLocale);
        commonQLS.SetQLSPref("fallbacklocale", sLocale);

        commonQLS.oALPref.setBoolPref("locale.matchOS", false); //Switch to false since switching would otherwise be pointless..

        if (document.getElementById('taskPopup'))
          commonQLS.ChangeLocaleSeamonkey(sLocale);

        //don't think this is needed anymore...
        commonQLS.DoLocaleWorkAround(QLSOverlay,window);
      }

//might help for some strings
/*
Services.strings.flushBundles();
Services.obs.notifyObservers(null, "chrome-flush-skin-caches", null);
Services.obs.notifyObservers(null, "chrome-flush-caches", null);
*/
      QLSOverlay.CheckLocale();
    }
    //Alert other windows.
    let oWindows = Services.wm.getEnumerator("navigator:browser"),
    oWindow;

    while (oWindows.hasMoreElements()) {
      oWindow = oWindows.getNext();
      if (typeof(oWindow.CheckLocale) == "function")
        oWindow.QLSOverlay.CheckLocale();
    }
  },

  ChangeLocaleBack: function()
  {
    let sLocale = commonQLS.GetQLSPref("previouslocale");
    if (commonQLS.GetQLSPrefBool("switch_contentlocale"))
      sLocale = commonQLS.GetQLSPref("previouscontentlocale");

    QLSOverlay.ChangeLocale(sLocale);
  },

  CCodeToLocale: function(sData)
  {
    let sLocale = "";
    let oElement = document.getElementsByAttribute('ccode', sData)[0];
    if (oElement)
      sLocale = oElement.getAttribute('id');
    sLocale = sLocale.replace('tb_', '');
    sLocale = sLocale.replace('sbp_', '');
    return sLocale;
  },

  //I use one menu for tools menu/statusbar/toolbar, if I just add a popup="CavemanQLS" the tools menu won't do jack
  //this opens/closes it when you left click the menuitem ("on mouse over" doesn't work as well)
  toggleToolsPopupWhich: null,
  toggleToolsPopup: function(that,e)
  {
    //only toggle on left mouse
    if (e.button != 0)
      return;
    let popup = document.getElementById("CavemanQLS");
    if (!this.toggleToolsPopupWhich) {
      popup.openPopup(that,"end_before",0,0,false,false);
      this.toggleToolsPopupWhich = true;
    } else {
      popup.hidePopup();
      this.toggleToolsPopupWhich = null;
    }
  }

};

window.addEventListener("load", function load()
{
  window.removeEventListener("load",load,false);
  //let firstPaint go first
  window.setTimeout(function(){
    //QLSOverlay.QLSPreInit();
    QLSOverlay.QLSInit();
  },500);
},false);

window.addEventListener("unload", function load()
{
  window.removeEventListener("unload",load,false);
  QLSOverlay.QLSDeInit();
},false);
