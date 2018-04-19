"use strict";
function InitWindow()
{
	let oSettings = window.arguments[0];
	document.getElementById('switch_gulocale').checked = oSettings.gulocale;
	document.getElementById('switch_contentlocale').checked = oSettings.contentlocale;
	document.getElementById('switch_alwaysask').checked = oSettings.alwaysask;
}

function ApplyAndClose()
{
	let oSettings = window.arguments[0];
	oSettings.gulocale = document.getElementById('switch_gulocale').checked;
	oSettings.contentlocale = document.getElementById('switch_contentlocale').checked;
	oSettings.alwaysask = document.getElementById('switch_alwaysask').checked;
	oSettings.accepted = true;

	window.close();
}

