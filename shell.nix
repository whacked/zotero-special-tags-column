{ pkgs ? import <nixpkgs> {} }:

let
  name = "zotero-special-tags-column";
  author = "whacked";
in pkgs.mkShell {

  buildInputs = [
    pkgs.pastel
    pkgs.nodejs
  ] ++ (if (pkgs.stdenv.isLinux) then [ pkgs.zotero ] else []);

  shellHook = (if (pkgs.stdenv.isDarwin) then ''
    export PATH=$PATH:/Applications/Zotero.app/Contents/MacOS
  '' else ''
  '') + ''
    shopt -s direxpand

    # WARNING: zotero, even with a profile override, will still save stuff in $HOME/Zotero
    _zotero_profile_path_var=ZOTERO_PROFILE_PATH
    ZOTERO_PROFILE_PATH="''${!_zotero_profile_path_var}"

    info() {
        pastel paint -n "lightblue" "[INFO]  "
        echo $*
    }
    warn() {
        pastel paint -n "yellow" "[WARN]  "
        echo $*
    }
    error() {
        pastel paint -n "red" "[ERROR]  "
        echo $*
    }
    info "checking for $_zotero_profile_path_var..."
    if [ "x$ZOTERO_PROFILE_PATH" == "x" ]; then
        export ZOTERO_PROFILE_PATH=''${TMPDIR}/zotero
        info "using default profile path at $ZOTERO_PROFILE_PATH"
        if [ -e $ZOTERO_PROFILE_PATH ]; then
            warn "$ZOTERO_PROFILE_PATH exists; please make sure there is no critical information already there"
        else
            info "$ZOTERO_PROFILE_PATH does not exist; creating it..."
            mkdir $ZOTERO_PROFILE_PATH
        fi
    else
        info "using zotero profile path at $ZOTERO_PROFILE_PATH"
    fi

    pack() {
        target=''${1-ZoteroSpecialTagsColumn.xpi}
        zip -r $target chrome chrome.manifest defaults external install.rdf
        info "saved: $target"
    }

    initialize-zotero-plugin() {
        if [ ! -e $ZOTERO_PROFILE_PATH/extensions ]; then
            warn "zotero extensions directory does not exist; creating one..."
            mkdir $ZOTERO_PROFILE_PATH/extensions
        fi

        # see https://www.zotero.org/support/dev/client_coding/plugin_development
        # although some parts seem out of date

        # Create a text file in the 'extensions' directory of your Zotero profile
        # directory named after the extension id (e.g., myplugin@mydomain.org). The
        # file contents should be the absolute path to the root of your plugin
        # source code directory, where your install.rdf file is located.
        echo "$PWD" | tee $ZOTERO_PROFILE_PATH/extensions/${name}@${author}.github.io

        # Open prefs.js in the Zotero profile directory in a text editor and
        # delete the lines containing extensions.lastAppBuildId and
        # extensions.lastAppVersion. Save the file and restart Zotero. This
        # will force Zotero to read the 'extensions' directory and install your
        # plugin from source, after which you should see it listed in Tools
        # --> Add-ons. This is only necessary once.
        PREFS_JS_PATH=$ZOTERO_PROFILE_PATH/prefs.js
        PREFS_JS_ORIG=$PREFS_JS_PATH.orig
        if [ ! -e $PREFS_JS_ORIG ]; then
            cp $PREFS_JS_PATH $PREFS_JS_ORIG
        fi
        cat $PREFS_JS_ORIG |
            grep -v extensions.lastAppBuildId |
            grep -v extensions.lastAppVersion |
            tee $PREFS_JS_PATH

        # Whenever you start up Zotero after making a change to your extension
        # code, start it from the command line and pass the -purgecaches flag
        # to force Zotero to re-read any cached files. (You'll likely want to
        # make an alias or shell script that also includes the -ZoteroDebugText
        # and -jsconsole flags and perhaps -p <Profile>, where <Profile> is the
        # name of a development profile.)

        # stores some cache state of the current extension;
        # wiping it ensures zotero attempts to reload the extension on start
        rm $ZOTERO_PROFILE_PATH/addonStartup.json.lz4
    }

    alias zt='zotero --profile $ZOTERO_PROFILE_PATH --jconsole -purgecaches -jsconsole'
    alias ztd='zt -ZoteroDebugText'
    alias rzt='initialize-zotero-plugin; zt'

    cat ${__curPos.file} | grep -v __curPos | grep "alias .\+=.\+$\|[[:space:]]\+[a-z]\+().\+"
  '';
}
