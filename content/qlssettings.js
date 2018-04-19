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

function drag_handler(e)
{
  e.dataTransfer.dropEffect = "move";
  e.dataTransfer.setData("text/unicode", e.target.id);
}

function drop_handler(e)
{
  let sDroppedLocale = e.dataTransfer.getData("text"),
  id = e.target.getAttribute('id');

  MoveQLSMenuItem(sDroppedLocale, id);
}

function MoveQLSMenuItem(sSource, sTarget)
{
	let sMItems = GetPref("visiblemenuitems") + "#";
	sMItems = sMItems.replace(sSource + "#", "", "g");
	sMItems = sMItems.replace(sTarget + "#", sSource + "#" + sTarget + "#", "g");
	SetPref("visiblemenuitems", sMItems.substr(0, sMItems.length - 1));
	RefreshVisibleMenuItems(document.getElementById("visiblemenuitems-search").value);

}

function InitWindow()
{
  //has a tendency to keep enlarging window
  //window.sizeToContent();

	commonQLS.oQLSPref = Services.prefs.getBranch("extensions.qls2.");
	//commonQLS.QLSHostToLocale = null;
	commonQLS.QLSHostToLocale = [];

	DisableSwitchOptions(document.getElementById('switch_alwaysask').checked);
	DisableStatusBarMode(document.getElementById('hide_statusbar').checked);
	RefreshVisibleMenuItems('');
	QLSInitHostLocales();
	InitAutoSwitchListbox();

	document.getElementById("lbvisiblemenuitems").addEventListener('dragstart', drag_handler, false);
	document.getElementById("lbvisiblemenuitems").addEventListener('drop', drop_handler, false);

  //disable hover checkboxes if "parent" disabled
  if (commonQLS.oQLSPref.getBoolPref("useautoswitch") == false)
    document.getElementById("autoswitchfortld").disabled = true;
}

function checkboxToggle(child)
{
  //toggle disabled state of child checkbox
  let checkbox = document.getElementById(child);
  if (checkbox.disabled == true) {
    checkbox.disabled = false;
  } else {
    checkbox.disabled = true;
    checkbox.checked = false;
    //update user pref element
    let pref = document.getElementById(checkbox.getAttribute("preference"));
    pref.value = false;
  }
}

function BeforeClose()
{
	Services.obs.notifyObservers(opener, "qls-settings", "OK");
  return true;
}

function CheckLocale(sLocale)
{
	let sMItems = GetPref("visiblemenuitems") + "#";
	sMItems = sMItems.replace(sLocale + "#", "", "g");
	if (document.getElementById(sLocale).getAttribute("checked") == "true")
		sMItems += sLocale + "#";
	SetPref("visiblemenuitems", sMItems.substr(0, sMItems.length - 1));
}

function SelectAllItems(bSelect)
{
	let oList = document.getElementById('lbvisiblemenuitems'),
	oItem,
  iLen = oList.getRowCount();

	for (let i = 0; i < iLen; i ++) {
		oItem = oList.getItemAtIndex(i);
		oItem.setAttribute("checked", bSelect);
		CheckLocale(oItem.id);
	}
}

function DisableSwitchOptions(bDisable)
{
  function setAtr(file)
  {
    document.getElementById(file).setAttribute('disabled', bDisable);
  }
  setAtr('switch_gulocale');
  setAtr('switch_contentlocale');
}

function DisableStatusBarMode(bDisable)
{
  let oStatusBarMode = document.getElementById('statusbarmode');
	oStatusBarMode.setAttribute('disabled', bDisable);
  function setAtr(file) {
    file.setAttribute('disabled', bDisable);
  }
  setAtr(oStatusBarMode.childNodes[0]);
  setAtr(oStatusBarMode.childNodes[1]);
  setAtr(oStatusBarMode.childNodes[2]);
}

function InitAutoSwitchListbox()
{
	let oList = document.getElementById('lbitems'),
	oItem, oLItem, oCloneItem,
	sLabel = "",
	iLen = commonQLS.QLSHostToLocale.length;

	RemoveListboxItems();

	oCloneItem = document.getElementById('liclone');
	for (let i = 0; i < iLen; i ++) {
		if (commonQLS.QLSHostToLocale[i][0] && commonQLS.QLSHostToLocale[i][0] != "") {
			oItem = oCloneItem.cloneNode(true);
			oItem.setAttribute('id', 'li_' + i);
			oItem.setAttribute('selected', false);
			oItem.setAttribute('current', false);
			oItem.childNodes[0].setAttribute('hostname', commonQLS.QLSHostToLocale[i][0]);
			sLabel = commonQLS.QLSHostToLocale[i][0];
			oLItem = document.getElementById(commonQLS.QLSHostToLocale[i][1]);
			if (oLItem)
        sLabel += " (" + oLItem.label + ")";
			else
        sLabel += " (" + commonQLS.QLSHostToLocale[i][1] + ")";
			oItem.childNodes[0].setAttribute('label', sLabel);
			oItem.setAttribute('hidden', false);
			oList.appendChild(oItem);
		}
	}
}

function RefreshVisibleMenuItems(sFilter)
{
	let oList = document.getElementById('lbvisiblemenuitems'),
	oLItem, oCItem,
	//aMItems = commonQLS.QLS_ALL_LOCALES.split("#"),
	aMItems = commonQLS.QLSTLDToLocaleP().split(","),
	aVMItems = GetPref("visiblemenuitems").split("#"),
	sVMItems = "",
	i,
	bSaveVMItems = false;

	RemoveAllChildren(oList);
	if (sFilter == "")
    document.getElementById("visiblemenuitems-search").value = "";
	else
    sFilter = sFilter.toLowerCase();

	for (i = 0; i < aVMItems.length; i ++) {
		oCItem = document.getElementById("clone_" + aVMItems[i]);
		if (oCItem) {
			oLItem = oCItem.cloneNode(true);
			if (oLItem.getAttribute('label').toLowerCase().indexOf(sFilter) >= 0 || sFilter == "") {
				oLItem.id = oLItem.id.replace("clone_", "");
				oList.appendChild(oLItem);
				oLItem.setAttribute("checked", true);
			}
			sVMItems += aVMItems[i] + "#";
		}
		else {
			bSaveVMItems = true;
			//Services.console.logStringMessage("Quick Locale Switcher unsuspected locale: " + aVMItems[i]);
		}
	}
	for (i = 0; i < aMItems.length; i ++) {
		if (!document.getElementById(aMItems[i])) {
      let temp = document.getElementById("clone_" + aMItems[i]);
      if (temp) {
        oLItem = temp.cloneNode(true);
        if (oLItem.getAttribute('label').toLowerCase().indexOf(sFilter) >= 0 || sFilter == "") {
          oLItem.id = oLItem.id.replace("clone_", "");
          oList.appendChild(oLItem);
        }
      }
		}
	}
	if (bSaveVMItems)
		SetPref("visiblemenuitems", sVMItems.substr(0, sVMItems.length - 1));
}

function FilterAutoSwitchHosts(sFilter)
{
	let oList = document.getElementById('lbitems'),
	oItem,
	iLen = oList.childNodes.length - 1;

	sFilter	= sFilter.toLowerCase();
	for (let i = iLen; i >= 0; i --) {
		oItem = oList.childNodes[i];
		if (oItem.nodeName == "richlistitem" && oItem.getAttribute('id') != 'liclone') {
			if (oItem.childNodes[0].getAttribute('label').toLowerCase().indexOf(sFilter.toLowerCase()) >= 0 || sFilter == "")
				oItem.setAttribute('hidden', false);
			else
				oItem.setAttribute('hidden', true);
		}
	}
}

function ClearAutoSwitchFilter(bApplyFilter)
{
	document.getElementById('autoswitch-filter').value = '';
	if (bApplyFilter)
    FilterAutoSwitchHosts('');
}

function RemoveListboxItems()
{
	let oList = document.getElementById('lbitems'),
	oItem,
	iLen = oList.childNodes.length - 1;

	for (let i = iLen; i >= 0; i --) {
		oItem = oList.childNodes[i];
		if (oItem.nodeName == "richlistitem" && oItem.getAttribute('id') != 'liclone')
      oList.removeChild(oItem);
	}
}

function RemoveAllChildren(oItem)
{
	let iLen = oItem.childNodes.length - 1;
	for (let i = iLen; i >= 0; i --) {
		oItem.removeChild(oItem.childNodes[i]);
	}
}

function RemoveAutoSwitchHosts(bRemoveAll)
{
	let oList = document.getElementById('lbitems'),
	oItem,
	iLen,
  iHIndex;

	iLen = oList.getRowCount() - 1;
	for (let i = iLen; i > -1; i --) {
		oItem = oList.getItemAtIndex(i);
		if ((oItem.getAttribute('selected') == "true" || bRemoveAll) &&
        (!oItem.getAttribute('hidden') || oItem.getAttribute('hidden') == "false")) {
			iHIndex = GetAutoSwitchIndex(oItem.childNodes[0].getAttribute('hostname'));
			if (iHIndex >= 0) {
				commonQLS.QLSHostToLocale.splice(iHIndex, 1);
				oList.removeChild(oItem);
			}
		}
	}
	ClearAutoSwitchFilter(false);
	QLSStoreHostLocalePref();
	QLSInitHostLocales();
	InitAutoSwitchListbox();
}

function GetAutoSwitchIndex(sHost)
{
	let iLen = commonQLS.QLSHostToLocale.length;
	for (let i = 0; i < iLen; i ++) {
		if (commonQLS.QLSHostToLocale[i][0] == sHost)
      return i;
	}
	return -1;
}

function QLSStoreHostLocalePref()
{
	let aTemp = [],
	sHostLocale = "",
	iLen = commonQLS.QLSHostToLocale.length;

	for (let i = 0; i < iLen; i ++) {
		aTemp[i] = commonQLS.QLSHostToLocale[i].join(';');
	}
	sHostLocale = aTemp.join(' ');
	SetPref("autoswitchhosts", sHostLocale);
}

function QLSInitHostLocales()
{
	let aTmp = GetPref("autoswitchhosts").split(' ');
	for (let i = 0; i < aTmp.length; i ++) {
		commonQLS.QLSHostToLocale[i] = aTmp[i].split(';');
	}
}

function LoadLanguagePacksFTP()
{
  let sURI = "",
  sVersion = "3.5",
  sOS = "win32",
  sApplication = "firefox",
  sPlatform = navigator.platform.toLowerCase(),
  oAppInfo = Services.appinfo;


  if (sPlatform.indexOf('win') != -1)
    sOS = "win32";
  if (sPlatform.indexOf('mac') != -1 || sPlatform.indexOf('darwin') != -1)
    sOS = "mac";

  if (oAppInfo.OS.toLowerCase().indexOf("linux") >= 0) {
    sOS = "linux-i686";
    if (sPlatform.indexOf('64') != -1)
      sOS = "linux-x86_64";
  }

  if (oAppInfo.ID == "{ec8030f7-c20a-464f-9b0e-13a3a9e97384}")
    sApplication = "firefox";
  if (oAppInfo.ID == "{3550f703-e582-4d05-9a08-453d09bdfdc6}")
    sApplication = "thunderbird";

  sVersion = oAppInfo.version;

  sURI = "ftp://ftp.mozilla.org/pub/mozilla.org/" + sApplication + "/releases/" + sVersion + "/" + sOS + "/xpi/";
  OpenLink(sURI);
}

function LoadDictionariesSite()
{
  let sURI = "",
  sApplication = "firefox",
  oAppInfo = Services.appinfo;

  if (oAppInfo.ID == "{ec8030f7-c20a-464f-9b0e-13a3a9e97384}")
    sApplication = "firefox";
  if (oAppInfo.ID == "{3550f703-e582-4d05-9a08-453d09bdfdc6}")
    sApplication = "thunderbird";

  sURI = "https://addons.mozilla.org/en-US/" + sApplication + "/language-tools/";
  OpenLink(sURI);
}

function OpenLink(sURI)
{
    if (typeof gBrowser === "undefined") {
      commonQLS.epService.loadUrl(Services.io.newURI(sURI, null, null));
      return;
    }

    let oBrowser = commonQLS.window().gBrowser;
    oBrowser.selectedTab = oBrowser.addTab(sURI);
}

function GetPref(sName)
{
	try {
    return commonQLS.oQLSPref.getComplexValue(sName, Ci.nsIPrefLocalizedString).data;
  }	catch (e) {}
	return commonQLS.oQLSPref.getCharPref(sName);
}

function SetPref(sName, sData)
{
	let oPLS = Cc["@mozilla.org/pref-localizedstring;1"].createInstance(Ci.nsIPrefLocalizedString);
	oPLS.data = sData;
	commonQLS.oQLSPref.setComplexValue(sName, Ci.nsIPrefLocalizedString, oPLS);
}

function GetPrefBool(sName)
{
	return commonQLS.oQLSPref.getBoolPref(sName);
}

function SetPrefBool(sName, bData)
{
	commonQLS.oQLSPref.setBoolPref(sName, bData);
}
