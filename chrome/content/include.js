if (!Zotero.specialTagsColumn) {
	  Components.classes["@mozilla.org/moz/jssubscript-loader;1"].getService(
        Components.interfaces.mozIJSSubScriptLoader
    ).loadSubScript(
        "chrome://zotero-special-tags-column/content/zotero-special-tags-column.js"
    );
	  window.addEventListener('load', function(e) {
		    Zotero.specialTagsColumn.init();
	  }, false);	
}
