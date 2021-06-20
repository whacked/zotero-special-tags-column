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

        // returns undefined/null if no matching pref
        var prefManager = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
        var tagFilterStringPref = prefManager.getCharPref("extensions.zotero.special-tags-column.tags-string") || "";
        Zotero.log("tag filter string: " + tagFilterStringPref);
        
        var allowedTags = {};
        var tagFilterStringSplit = unescape(tagFilterStringPref).split(",")
        for(var i = 0; i < tagFilterStringSplit.length; ++i) {
            let tagFilterString = tagFilterStringSplit[i].replace(/^\s*/, '').replace(/\s*$/, '')
            if(tagFilterString.length == 0) {
                continue;
            }
            allowedTags[tagFilterString] = true;
        }
        Zotero.log("ALLOWED: " + JSON.stringify(allowedTags));

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
                return tagItem.tag
            }).filter((tag) => {
                // Zotero.log("checking: " + tag)
                return allowedTags[tag]
            })
            return tags.sort().join(", ")
        }
    };
};
