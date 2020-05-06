/* global $CC, Utils, $SD */

 /**
  * The 'connected' event is sent to your plugin, after the plugin's instance
  * is registered with Stream Deck software. It carries the current websocket
  * and other information about the current environmet in a JSON object
  * You can use it to subscribe to events you want to use in your plugin.
  */

$SD.on('connected', (jsonObj) => connected(jsonObj));

function connected(jsn) {

    $SD.on('com.flyingdiver.indigo.keypress.didReceiveSettings', (jsonObj) => action.didReceiveSettings(jsonObj));
    $SD.on('com.flyingdiver.indigo.keypress.didReceiveGlobalSettings', (jsonObj) => action.didReceiveGlobalSettings(jsonObj));

    $SD.on('com.flyingdiver.indigo.keypress.keyDown', (jsonObj) => action.keyDown(jsonObj));
    $SD.on('com.flyingdiver.indigo.keypress.keyUp', (jsonObj) => action.keyUp(jsonObj));

    $SD.on('com.flyingdiver.indigo.keypress.willAppear', (jsonObj) => action.willAppear(jsonObj));
    $SD.on('com.flyingdiver.indigo.keypress.willDisappear', (jsonObj) => action.willDisappear(jsonObj));
    
    $SD.on('com.flyingdiver.indigo.keypress.propertyInspectorDidAppear', (jsonObj) => action.propertyInspectorDidAppear(jsonObj));
    $SD.on('com.flyingdiver.indigo.keypress.propertyInspectorDidDisappear', (jsonObj) => action.propertyInspectorDidDisappear(jsonObj));

    $SD.on('com.flyingdiver.indigo.keypress.sendToPlugin', (jsonObj) => action.sendToPlugin(jsonObj));

    $SD.on('deviceDidConnect', (jsonObj) => action.deviceDidConnect(jsonObj));
    $SD.on('deviceDidDisconnect', (jsonObj) => action.deviceDidDisconnect(jsonObj));

};

var wsIndigo = null;
var wsConnections = 0;
var settings = {};

function connectIndigo() {

    wsConnections = wsConnections + 1;
    console.log('[app.js]connectIndigo: active connections = ', wsConnections);
    
    if (wsIndigo) {       // already connected
        return;
    }

    // Get the host and port from the settings
//    websocket = new ReconnectingWebSocket('ws://' + settings["indigo-host"] + ':' + settings["indigo-port"] );
    websocket = new ReconnectingWebSocket('ws://127.0.0.1:9001');
    wsIndigo = websocket;

    websocket.onopen = function (evt) {
        console.log('[app.js]websocket.onopen: ', evt);
    };

    websocket.onerror = function (evt) {
        console.log('[app.js]websocket.onerror: ', evt);
    };

    websocket.onclose = function (evt) {
        console.log('[app.js]websocket.onclose: ', evt);
    };

    websocket.onmessage = function (evt) {
        console.log('[Indigo] websocket.onmessage: ', evt);
        var jsonObj = Utils.parseJson(evt.data);
        console.log('[Indigo] websocket.onmessage: ', jsonObj.event, jsonObj);
    }
};

function disconnectIndigo() {
    wsConnections = wsConnections - 1;
    console.log('[app.js]disconnectIndigo: active connections = ', wsConnections);
    if (wsConnections < 1) {
        wsIndigo.close(1000, 'Disconnect requested');
        wsIndigo = null;
    }
};


/** ACTIONS */

const action = {
    
    didReceiveSettings: function(jsn) {
        console.log('[app.js]didReceiveSettings: ', jsn);
        settings = Utils.getProp(jsn, 'payload.settings', {});
    },

    didReceiveGlobalSettings: function(jsn) {
        console.log('[app.js]didReceiveGlobalSettings: ', jsn);
        settings = Utils.getProp(jsn, 'payload.settings', {});
    },

    keyDown: function (jsn) {
        console.log('[app.js]keyDown: ', jsn);
        wsIndigo.send(JSON.stringify(jsn));
    },

    keyUp: function (jsn) {
        console.log('[app.js]keyUp: ', jsn);
        wsIndigo.send(JSON.stringify(jsn));
    },

    willAppear: function (jsn) {
        console.log('[app.js]willAppear: ', jsn);
        settings = jsn.payload.settings;
        
        connectIndigo();
        // delay sending the message to be sure the socket is open
        setTimeout(() => { wsIndigo.send(JSON.stringify(jsn)); }, 500);
    },

    willDisappear: function (jsn) {
        console.log('[app.js]willDisappear: ', jsn);
        disconnectIndigo(wsIndigo);
    },

    deviceDidConnect: function (jsn) {
        console.log('[app.js]deviceDidConnect: ', jsn);
    },

    deviceDidDisconnect: function (jsn) {
        console.log('[app.js]deviceDidDisconnect: ', jsn);
    },

    propertyInspectorDidAppear: function (jsn) {
        console.log('[app.js]propertyInspectorDidAppear: ', jsn);
    },

    propertyInspectorDidDisappear: function (jsn) {
        console.log('[app.js]propertyInspectorDidDisappear: ', jsn);
    },

    sendToPlugin: function (jsn) {
        console.log('[app.js]sendToPlugin: ', jsn);
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
                settings[sdpi_collection.key] = sdpi_collection.value;
                console.log('setSettings....', settings);
                $SD.api.setSettings(jsn.context, settings);
            }
        }
    },

    /**
     * Finally here's a methood which gets called from various events above.
     * This is just an idea how you can act on receiving some interesting message
     * from Stream Deck.
     */

    doSomeThing: function(inJsonData, caller) {
        console.log(`[app.js]doSomeThing from: ${caller}`);
        console.log(inJsonData);
    }, 

};


