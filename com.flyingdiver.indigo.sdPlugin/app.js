/* global $CC, Utils, $SD */

/**
 * Here are a couple of wrappers we created to help ypu quickly setup
 * your plugin and subscribe to events sent by Stream Deck to your plugin.
 */

 /**
  * The 'connected' event is sent to your plugin, after the plugin's instance
  * is registered with Stream Deck software. It carries the current websocket
  * and other information about the current environmet in a JSON object
  * You can use it to subscribe to events you want to use in your plugin.
  */

$SD.on('connected', (jsonObj) => connected(jsonObj));

function connected(jsn) {

    $SD.on('com.flyingdiver.indigo.keypress.didReceiveSettings', (jsonObj) => action.onDidReceiveSettings(jsonObj));
    $SD.on('com.flyingdiver.indigo.keypress.didReceiveGlobalSettings', (jsonObj) => action.onDidReceiveGlobalSettings(jsonObj));

    $SD.on('com.flyingdiver.indigo.keypress.keyDown', (jsonObj) => action.onKeyDown(jsonObj));
    $SD.on('com.flyingdiver.indigo.keypress.keyUp', (jsonObj) => action.onKeyUp(jsonObj));

    $SD.on('com.flyingdiver.indigo.keypress.willAppear', (jsonObj) => action.onWillAppear(jsonObj));
    $SD.on('com.flyingdiver.indigo.keypress.willDisappear', (jsonObj) => action.onWillDisappear(jsonObj));
    
    $SD.on('com.flyingdiver.indigo.keypress.propertyInspectorDidAppear', (jsonObj) => action.propertyInspectorDidAppear(jsonObj));
    $SD.on('com.flyingdiver.indigo.keypress.propertyInspectorDidDisappear', (jsonObj) => action.propertyInspectorDidDisappear(jsonObj));

    $SD.on('com.flyingdiver.indigo.keypress.sendToPlugin', (jsonObj) => action.onSendToPlugin(jsonObj));

};

/** ACTIONS */

const action = {
    settings:{},
    
    onDidReceiveSettings: function(jsn) {
        console.log('%c%s', 'color: white; background: black; font-size: 13px;', '[app.js]onDidReceiveSettings:');

        this.settings = Utils.getProp(jsn, 'payload.settings', {});
        this.doSomeThing(this.settings, 'onDidReceiveSettings', 'orange');
    },

    onDidReceiveGlobalSettings: function(jsn) {
        console.log('%c%s', 'color: white; background: black; font-size: 13px;', '[app.js]onDidReceiveGlobalSettings:');

        this.settings = Utils.getProp(jsn, 'payload.settings', {});
        this.doSomeThing(this.settings, 'onDidReceiveGlobalSettings', 'orange');
    },

    onKeyDown: function (jsn) {
        console.log('%c%s', 'color: white; background: black; font-size: 13px;', '[app.js]onKeyDown:');
        this.doSomeThing(jsn, 'onKeyDown', 'green');
    },

    onKeyUp: function (jsn) {
        console.log('%c%s', 'color: white; background: black; font-size: 13px;', '[app.js]onKeyUp:');
        this.doSomeThing(jsn, 'onKeyUp', 'green');
    },

    /** 
     * The 'willAppear' event is the first event a key will receive, right before it gets
     * showed on your Stream Deck and/or in Stream Deck software.
     * This event is a good place to setup your plugin and look at current settings (if any),
     * which are embedded in the events payload.
     */

    onWillAppear: function (jsn) {
        console.log('%c%s', 'color: white; background: black; font-size: 13px;', '[app.js]onWillAppear:');
        /**
         * "The willAppear event carries your saved settings (if any). You can use these settings
         * to setup your plugin or save the settings for later use. 
         * If you want to request settings at a later time, you can do so using the
         * 'getSettings' event, which will tell Stream Deck to send your data 
         * (in the 'didReceiceSettings above)
         * 
         * $SD.api.getSettings(jsn.context);
        */
        this.settings = jsn.payload.settings;
        
        // Get the host and port from the settings, then connect.
        
        connectIndigo();
    },

    onWillDisappear: function (jsn) {
        console.log('%c%s', 'color: white; background: black; font-size: 13px;', '[app.js]onWillDisappear:');

        disconnectIndigo();

    },

    propertyInspectorDidAppear: function (jsn) {
        console.log('%c%s', 'color: white; background: black; font-size: 13px;', '[app.js]propertyInspectorDidAppear:');
    },

    propertyInspectorDidDisappear: function (jsn) {
        console.log('%c%s', 'color: white; background: black; font-size: 13px;', '[app.js]propertyInspectorDidDisappear:');
    },

    onSendToPlugin: function (jsn) {
        console.log('%c%s', 'color: white; background: black; font-size: 13px;', '[app.js]onSendToPlugin:');
        /**
         * this is a message sent directly from the Property Inspector 
         * (e.g. some value, which is not saved to settings) 
         * You can send this event from Property Inspector (see there for an example)
         */ 

        const sdpi_collection = Utils.getProp(jsn, 'payload.sdpi_collection', {});
        if (sdpi_collection.value && sdpi_collection.value !== undefined) {
            this.doSomeThing({ [sdpi_collection.key] : sdpi_collection.value }, 'onSendToPlugin', 'fuchsia');            
        }
    },

    /**
     * This snippet shows, how you could save settings persistantly to Stream Deck software
     * It is not used in this example plugin.
     */

    saveSettings: function (jsn, sdpi_collection) {
        console.log('saveSettings:', jsn);
        if (sdpi_collection.hasOwnProperty('key') && sdpi_collection.key != '') {
            if (sdpi_collection.value && sdpi_collection.value !== undefined) {
                this.settings[sdpi_collection.key] = sdpi_collection.value;
                console.log('setSettings....', this.settings);
                $SD.api.setSettings(jsn.context, this.settings);
            }
        }
    },

    /**
     * Here's a quick demo-wrapper to show how you could change a key's title based on what you
     * stored in settings.
     * If you enter something into Property Inspector's name field (in this demo),
     * it will get the title of your key.
     * 
     * @param {JSON} jsn // the JSON object passed from Stream Deck to the plugin, which contains the plugin's context
     * 
     */

    setTitle: function(jsn) {
        if (this.settings && this.settings.hasOwnProperty('mynameinput')) {
            console.log("watch the key on your StreamDeck - it got a new title...", this.settings.mynameinput);
            $SD.api.setTitle(jsn.context, this.settings.mynameinput);
        }
    },

    /**
     * Finally here's a methood which gets called from various events above.
     * This is just an idea how you can act on receiving some interesting message
     * from Stream Deck.
     */

    doSomeThing: function(inJsonData, caller, tagColor) {
        console.log('%c%s', 'color: white; background: black; font-size: 13px;', `[app.js]doSomeThing from: ${caller}`);
        // console.log(inJsonData);
    }, 


};


function connectIndigo() {

    websocket = new WebSocket('ws://127.0.0.1:9001');

    websocket.onopen = function () {
        var json = {
            event: "client-connect",
            uuid: "some-UUID"
        };
        websocket.sendJSON(json);
    };

    websocket.onerror = function (evt) {
        console.warn('WEBOCKET ERROR', evt, evt.data);
    };

    websocket.onclose = function (evt) {
        // Websocket is closed
        var reason = WEBSOCKETERROR(evt);
        console.warn(
            '[STREAMDECK]***** WEBOCKET CLOSED **** reason:',
            reason
        );
    };

    websocket.onmessage = function (evt) {
        var jsonObj = Utils.parseJson(evt.data), m;

        console.log('[STREAMDECK] websocket.onmessage ... ', jsonObj.event, jsonObj);

        if (!jsonObj.hasOwnProperty('action')) {
            m = jsonObj.event;
            // console.log('%c%s', 'color: white; background: red; font-size: 12px;', '[common.js]onmessage:', m);
        } else {
            switch (inMessageType) {
            case 'registerPlugin':
                m = jsonObj['action'] + '.' + jsonObj['event'];
                break;
            case 'registerPropertyInspector':
                m = 'sendToPropertyInspector';
                break;
            default:
                console.log('%c%s', 'color: white; background: red; font-size: 12px;', '[STREAMDECK] websocket.onmessage +++++++++  PROBLEM ++++++++');
                console.warn('UNREGISTERED MESSAGETYPE:', inMessageType);
            }
        }
    }
}


function disconnectIndigo() {
}