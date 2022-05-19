// for future work, see https://github.com/scitedotai/scite-zotero-plugin
// for useful techniques for setting up custom columns.

Zotero.specialTagsColumn = new function () {
    const SPECIAL_TAGS_COLUMN_ID = 'zotero-items-column-special-tags'

    const trim = (s) => {
        return s.replace(/^\s*/, '').replace(/\s*$/, '')
    }

    function makeElement(tagName) {
        return document.createElementNS('http://www.w3.org/1999/xhtml', tagName)
    }

    function SPAN() {
        return makeElement('span')
    }

    /**
     * currently this will support 3 kinds of configs:
     * 1. comma-delimited string: given a string of "specialTag1, specialTag2, ..."
     *    the plugin will match "specialTag1", "specialTag2", etc exactly on items containing those tags
     * 2. JSON mapping of string --> string
     *    given a mapping of
     *    - "specialTag1": "renamed1"
     *    - "specialTag2": "other2"
     *    it will match items with "specialTag1" and "specialTag2", and render them as
     *    "renamed1", "other2" respectively
     * 3. JSON mapping of string --> mapping of string-->string
     *    given a mapping of
     *    - "specialTag1": {
     *          "style": {
     *              "border": "2px solid blue"
     *          },
     *          "innerText": "newTagContent"
     *      }
     *    it will match "specialTag1" and render "newTagContent" with a blue border around it
     * @returns Record<string, string | Record<string, string>>
     */
    function parseSpecialTagsConfig(configString) {
        let parsed = {}
        if (configString.startsWith("{") && configString.endsWith("}")) {
            Zotero.log("parsing settings as JSON")
            parsed = JSON.parse(configString)
        } else {
            Zotero.log("parsing settings as comma-delimited string")
            var tagFilterStringSplit = configString.split(",")
            for (var i = 0; i < tagFilterStringSplit.length; ++i) {
                let tagFilterString = trim(tagFilterStringSplit[i])
                if (tagFilterString.length == 0) {
                    continue;
                }
                parsed[tagFilterString] = tagFilterString;
            }
        }
        return parsed
    }

    /**
     * Initiate specialTagsColumn
     * called from include.js
     * adds a select listener to the main window
     * @return {void}
     */
    this.init = async function () {
        Zotero.log("special tags column: init");

        // returns undefined/null if no matching pref
        var prefManager = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
        var tagFilterStringPref = unescape(trim(prefManager.getCharPref("extensions.zotero.special-tags-column.tags-string") || ""));
        Zotero.log("tag filter string: " + tagFilterStringPref);
        var specialTagsMapping = parseSpecialTagsConfig(tagFilterStringPref)

        function getSpecialTags(item) {  // given an item, return Array<string> where tags are among those defined in specialTagsMapping
            /** 
             * item example: (note that _tags is hidden!)
                {
                "key": "IMK3HAVC",  // string
                "version": 0,
                "itemType": "journalArticle",
                "title": "Lorem Ipsum Sit Dolor Amet",
                "date": "09/2017",
                "language": "en",
                "shortTitle": "Lorem Ipsum",
                "libraryCatalog": "DOI.org (Crossref)",
                "url": "https://example.com/doi/10.0000/example.1234",
                "accessDate": "2022-05-18T01:57:19Z",
                "volume": "12",
                "pages": "345-346",
                "publicationTitle": "Etaoin Shrdlu",
                "DOI": "10.0000/example.1234",
                "issue": "9",
                "journalAbbreviation": "Eta. Shr.",
                "ISSN": "1024-768",
                "creators": [
                    {
                    "firstName": "Alice X.",
                    "lastName": "Smith",
                    "creatorType": "author"
                    },
                    {
                    "firstName": "Bob Y.",
                    "lastName": "Stone",
                    "creatorType": "author"
                    }
                ],
                "tags": [
                    {
                    "tag": "example"
                    }
                ],
                "collections": [],
                "relations": {},
                "dateAdded": "2022-05-18T01:57:19Z",
                "dateModified": "2022-05-18T05:09:01Z"
                }

            * item._tags example:
                [{"tag":"notation"},{"tag":"dance"},{"tag":"⛄⛄⛄⛄⛄"}]
             */
            if (item.isNote() || item.isAttachment() || (item.isAnnotation != null ? item.isAnnotation() : null)) {
                return null
            }
            return item._tags.map((tagItem) => {
                // looks like tagItem just contains the "tag" field
                return specialTagsMapping[tagItem.tag]
            }).filter(tag => tag)
        }

        Zotero.log("Loaded special tags: " + JSON.stringify(specialTagsMapping));

        // for the monkey patch technique, see $patch$ in
        // https://github.com/retorquere/zotero-better-bibtex/blob/dff2485/content/better-bibtex.ts#L276
        if (typeof Zotero.ItemTreeView === 'undefined') {  // version 6+
            const itemTree = require('zotero/itemTree')

            let totalKnownFields = 0
            let injectedFieldId = 0
            var original_getID = Zotero.ItemFields.getID
            Zotero.ItemFields.getID = function (field) {
                /**
                 * HACK HACK HACK
                 * 
                 * zotero wants an integer field id
                 * but looking at https://github.com/zotero/zotero/blob/557a75c/chrome/content/zotero/xpcom/data/itemFields.js#L114
                 * looks like the fields are loaded from the database.
                 * since this field piggybacks on existing information,
                 * and for simplicity, we don't want to mess with a database.
                 * 
                 * so what we do here, is figure out how many fields have
                 * known IDs, and return the maximum known ID + 1.
                 * 
                 * because the known fields (populated in _fields in itemFields.js) is done asynchronously,
                 * it is empty when this plugin gets loaded. we assume when getID is actually called,
                 * the fields are correctly loaded.
                 * we do not know what happens when a competing add-on uses the same hack
                 */

                if (field == SPECIAL_TAGS_COLUMN_ID) {

                    // get size of the _allFields array from Zotero.itemFields
                    if (totalKnownFields == 0) {
                        for (const field of Zotero.ItemFields.getAll()) {
                            let fieldId = field.id
                            if (original_getID(fieldId)) {
                                totalKnownFields++
                            }
                            // to peek at something else and see what Zotero wants to see. It takes a number (id) or string (name)
                            // Zotero.log(JSON.stringify(Zotero.ItemFields.getName(fieldId)))
                        }
                    }
                    injectedFieldId = totalKnownFields + 1

                    // MONKEY MONKEY PATCH:
                    // Zotero breaks if isBaseField returns null for the given field;
                    // since our field is slipped in from nowhere, we must also force
                    // isBaseField to know about it, and return a valid value (`false`)
                    var original_isBaseField = Zotero.ItemFields.isBaseField
                    Zotero.ItemFields.isBaseField = function (field) {
                        if (field == injectedFieldId) {
                            return false
                        }
                        return original_isBaseField(field)
                    }

                    return injectedFieldId
                }

                return original_getID(field)
            }

            var original_getColumns = itemTree.prototype.getColumns
            itemTree.prototype.getColumns = function () {
                // this function calls getID and expects a number for dataKey from it
                const columns = original_getColumns.apply(this, arguments)
                columns.splice(
                    columns.findIndex(column => column.dataKey === 'title') + 1,
                    0,
                    {
                        // known keys
                        //   dataKey  <-- critical
                        //   defaultIn
                        //   defaultSort
                        //   disabledIn
                        //   fixedWidth
                        //   flex
                        //   iconLabel
                        //   ignoreInColumnPicker
                        //   label
                        //   minWidth
                        //   primary
                        //   staticWidth
                        //   submenu
                        //   width
                        //   zoteroPersist
                        // dataKey: 'medium',
                        dataKey: SPECIAL_TAGS_COLUMN_ID,
                        // label: l10n.localize('ZoteroPane.column.specialTags'),
                        label: 'Special tags',
                        flex: '1',
                        zoteroPersist: new Set(['width', 'ordinal', 'hidden', 'sortActive', 'sortDirection']),
                    }
                )
                return columns
            }

            var original_renderCell = itemTree.prototype._renderCell
            itemTree.prototype._renderCell = function (index, data, col) {
                const item = this.getRow(index).ref

                if (col.dataKey === 'title') {
                    let cell = original_renderCell.apply(this, arguments)

                    /*
                    // EXPERIMENTAL: this injects tags directly into the title line
                    const tagsContainer = makeElement('div')
                    tagsContainer.className = 'special-tags-inline'

                    for (const tagText of getSpecialTags(item)) {
                        const tagSpan = makeElement('span')
                        tagSpan.innerText = tagText
                        tagsContainer.append(tagSpan)
                    }

                    cell.append(tagsContainer)
                    */

                    return cell
                }

                if (col.dataKey !== SPECIAL_TAGS_COLUMN_ID) {
                    return original_renderCell.apply(this, arguments)
                }

                const cell = SPAN()
                cell.className = `cell ${col.className}`

                let specialTags = getSpecialTags(item)
                for (const tagSpec of (specialTags || [])) {
                    const text = SPAN()
                    text.className = 'special-tags-cell cell-text'
                    if (typeof tagSpec === 'string') {
                        text.innerText = tagSpec
                    } else if (typeof tagSpec === 'object' && tagSpec.innerText) {
                        text.innerText = tagSpec.innerText
                        for (const styleName of Object.keys(tagSpec.style)) {
                            text.style[styleName] = tagSpec.style[styleName]
                        }
                    }
                    cell.append(text)
                }

                return cell
            }
        } else {  // version 5
            var original_getCellText = Zotero.ItemTreeView.prototype.getCellText;
            Zotero.ItemTreeView.prototype.getCellText = function (row, col) {
                // row: number
                // col: object
                if (col.id !== 'zotero-items-column-special-tags') {
                    return original_getCellText.apply(this, arguments)
                }

                let specialTags = getSpecialTags(this.getRow(row).ref).filter(x => typeof x === 'string')
                return specialTags == null ? '' : specialTags.sort().join(", ")
            }
        }

        return Zotero.Schema.schemaUpdatePromise;
    };
};
