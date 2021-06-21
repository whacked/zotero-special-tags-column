Zotero.specialTagsColumn = new function() {
    /**
     * Initiate specialTagsColumn
     * called from include.js
     * adds a select listener to the main window
     * @return {void}
     */
    this.init = async function () {
        Zotero.log("special tags column: init");
        await Zotero.Schema.schemaUpdatePromise;

        var trim = (s) => {
            return s.replace(/^\s*/, '').replace(/\s*$/, '')
        }

        // returns undefined/null if no matching pref
        var prefManager = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
        var tagFilterStringPref = unescape(trim(prefManager.getCharPref("extensions.zotero.special-tags-column.tags-string") || ""));
        Zotero.log("tag filter string: " + tagFilterStringPref);
        
        var specialTagsMapping = {};
        if(tagFilterStringPref.startsWith("{") && tagFilterStringPref.endsWith("}")) {
            Zotero.log("parsing settings as JSON")
            specialTagsMapping = JSON.parse(tagFilterStringPref)
        } else {
            Zotero.log("parsing settings as comma-delimited string")
            var tagFilterStringSplit = tagFilterStringPref.split(",")
            for(var i = 0; i < tagFilterStringSplit.length; ++i) {
                let tagFilterString = trim(tagFilterStringSplit[i])
                if(tagFilterString.length == 0) {
                    continue;
                }
                specialTagsMapping[tagFilterString] = true;
            }
        }

        Zotero.log("Loaded special tags: " + JSON.stringify(specialTagsMapping));

        // ref better-bibtex.ts:264 $patch$ technique
        var original_getCellText = Zotero.ItemTreeView.prototype.getCellText;
        Zotero.ItemTreeView.prototype.getCellText = function(row, col) {
            // row: number
            // col: object
            if (col.id !== 'zotero-items-column-special-tags') {
                return original_getCellText.apply(this, arguments)
            }
            const item = this.getRow(row).ref
            if (item.isNote() || item.isAttachment() || (item.isAnnotation != null ? item.isAnnotation() : null)) {
                return ''
            }
            const tags = item._tags.map((tagItem) => {
                // looks like it just contains the "tag" field
                return specialTagsMapping[tagItem.tag]
            }).filter(tag => tag)
            return tags.sort().join(", ")
        }
    };
};
