if (typeof dump == "undefined") {  // xul interop hack
    dump = function (x) {
        console.log(x)
    }
}

// script globals
let prefManager = null
const CHAR_PREF_PATH = "extensions.zotero.special-tags-column.tags-string"

function mylog(s) {
    if (typeof Zotero == "undefined") {  // Zotero interop hack
        dump(s)
    } else {
        Zotero.log(s)
    }
}


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
 * TODO: move to typescript and stop using a comment for the spec
 * 
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
 * 4. JSON array of...
 * @returns Record<string, string | Record<string, string>>
 */
function parseSpecialTagsConfig(configString) {  // configString is unescaped
    let parsed = {}  // as of now, this is Array | Object

    let maybeVersionMatch = configString.match(/^v(\d+)\./)
    let configStringVersion
    let payloadSectionString

    if (maybeVersionMatch == null) {
        configStringVersion = 0
        payloadSectionString = configString
    } else {
        configStringVersion = parseInt(maybeVersionMatch[1])
        payloadSectionString = configString.substring(maybeVersionMatch[0].length)
    }

    try {
        switch (configStringVersion) {
            case 1:
                break;

            default:
            case 0:
                if (configString.startsWith("{") && configString.endsWith("}")) {
                    mylog("parsing settings as JSON object")
                    parsed = JSON.parse(configString)
                    // } else if (configString.startsWith("[") && configString.endsWith("]")) {
                    //     // TODO: investigate if this is worthwhile
                    //     mylog("parsing settings as JSON array")
                    //     parsed = JSON.parse(configString)
                } else {
                    mylog("parsing settings as comma-delimited string")
                    parsed = {}
                    var tagFilterStringSplit = configString.split(",")
                    for (var i = 0; i < tagFilterStringSplit.length; ++i) {
                        let tagFilterString = trim(tagFilterStringSplit[i])
                        if (tagFilterString.length == 0) {
                            continue;
                        }
                        parsed[tagFilterString] = tagFilterString;
                    }
                }
                break;
        }
    } catch (e) {
        mylog("FAILED TO PARSE SETTINGS")
        mylog(e)
    }

    return parsed
}

function isComplexTagSpec(maybeTagSpec) {
    return typeof maybeTagSpec === 'object'
}

function applyTagSpecToElement(element, tagSpec) {
    if (tagSpec.innerText != null) {
        element.innerText = tagSpec.innerText
    }
    if (tagSpec.style == null) {
        return
    }
    let keys = Object.keys(tagSpec.style)
    for (let i = 0; i < keys.length; ++i) {
        let styleName = keys[i]
        element.style[styleName] = tagSpec.style[styleName]
    }
}

function handleSettingsStringChange(sender) {
    let currentValue = (sender.value || "").replace(/^\s*/, "").replace(/\s*$/, "")
    if (currentValue.length == 0) {
        dump("blank!")
    }
    var settings = parseSpecialTagsConfig(currentValue)

    let debugSerializedTextElement = document.getElementById("serialized-settings")  // for debug
    if (debugSerializedTextElement != null) {
        debugSerializedTextElement.value = escape(JSON.stringify(settings))
    }
    if (prefManager == null) {
        mylog("WARN: prefManager is not available. Nothing will be saved")
    } else {
        prefManager.setCharPref(CHAR_PREF_PATH, escape(JSON.stringify(settings)))
    }

    let entryList = objectToKeyValueList(settings)
    renderList(entryList)
}

function makeXulElement(tagName) {
    return document.createElementNS(
        "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul", tagName)
}

function newCell(content) {
    let cell = makeXulElement("listcell")
    cell.innerHTML = content
    return cell
}

function renderItem(key, value) {
    let listItem = makeXulElement("listitem")
    listItem.setAttribute("style", "height: 20px;max-height:24px;")
    listItem.setAttribute("height", 20)
    listItem.setAttribute("maxheight", 30)
    let keyCell = newCell(key)
    let valueCell
    if (isComplexTagSpec(value)) {
        valueCell = newCell(value.innerText || key)
        applyTagSpecToElement(valueCell, value)
    } else {
        valueCell = newCell(value)
    }
    listItem.appendChild(keyCell)
    listItem.appendChild(valueCell)
    return listItem
}

/* for typescript
interface SpecialTagSpec {
    innerText?: string
    style: any
}
interface Entry {
    key: string
    value: string | SpecialTagSpec
}
*/

function renderList(entryList) {  // Array<Entry>
    let listBox = document.getElementById("tag-entries")
    if (listBox == null) {
        mylog("WARN: could not get tag entries component")
        return
    }
    for (let i = listBox.childNodes.length; i-- > 0;) {
        let child = listBox.childNodes[i]
        if (child.tagName == "listitem") {
            listBox.removeChild(child)
        }
    }
    for (var i = 0; i < entryList.length; ++i) {
        let entry = entryList[i]
        let row = renderItem(entry.key, entry.value)
        listBox.appendChild(row)
    }
}

function objectToKeyValueList(obj) {
    return Object.keys(obj).map((key) => {
        return {
            key: key,
            value: obj[key],
        }
    })
}

function initializeForm() {
    let currentConfigString = unescape(prefManager.getCharPref(CHAR_PREF_PATH) || "")
    if (currentConfigString.length > 0) {
        let currentConfig = parseSpecialTagsConfig(currentConfigString)
        renderList(Object.keys(currentConfig).map((key) => {
            return {
                key: key,
                value: currentConfig[key]
            }
        }))
        document.getElementById("deserialized-settings").value = currentConfigString
    }
}

function applyChanges() {
    Zotero.specialTagsColumn.importSpecialTagsString(prefManager.getCharPref(CHAR_PREF_PATH))
}

function runTests() {

    function assertEqual(expected, received) {
        if (typeof expected != typeof received) {
            return false
        }
        var expectedKeys = Object.keys(expected)
        for (var i = 0; i < expectedKeys.length; ++i) {
            requiredKey = expectedKeys[i]
            if (received[requiredKey] == null) {
                return false
            }
            if (!assertEqual(expected[requiredKey], received[requiredKey])) {
                return false
            }
        }
        return true
    }

    // test
    if (true) {

        var tests = [
            ["version 0 settings, empty string", "", []],
            // TODO
            // ["version 0 settings", "🐶🐶🐶🐶🐶,🐶🐶🐶🐶,🐶🐶🐶,🐶🐶,🐶,⛄⛄⛄⛄⛄,⛄⛄⛄⛄,⛄⛄⛄,⛄⛄,⛄", ],
            ["version 1 settings, empty string", "v1.", []],
        ];

        for (var i = 0; i < tests.length; ++i) {
            var testPair = tests[i];
            var description = testPair[0];
            var settingsString = testPair[1];
            var expectedResult = testPair[2];
            var parsedResult = parseSpecialTagsConfig(settingsString);
            if (assertEqual(expectedResult, parsedResult)) {
                dump("\n" + description + ":    PASS    ")
            } else {
                dump("\n" + description + "  !!! FAIL !!!")
            }
        }
    }

}

if (typeof require != "undefined" && typeof module != "undefined" && require.main == module) {
    runTests()
}

if (prefManager == null) {  // for first load
    prefManager = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
}
