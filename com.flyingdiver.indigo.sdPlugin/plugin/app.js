let websocket = null,
    indigoWebSocket = null,
    pluginUUID = null,
    applicationInfo = null,
    indigoAddress = null,
    wsQueue = new Queue();



function connectElgatoStreamDeckSocket(inPort, inPluginUUID, inRegisterEvent, inApplicationInfo)
{
    pluginUUID = inPluginUUID;
    applicationInfo = inApplicationInfo;

    console.log('connectElgatoStreamDeckSocket: applicationInfo = ', applicationInfo);

    // Open the web socket
    websocket = new WebSocket("ws://localhost:" + inPort);

    websocket.onopen = function()           // WebSocket is connected, register the plugin
    {
        console.log("websocket.onopen");
        const json = {
            "event": inRegisterEvent,
            "uuid": inPluginUUID
        };
    
        websocket.send(JSON.stringify(json));        
    };

    websocket.onmessage = function(evt)     // Received message from Stream Deck
    {
        const jsonObj = JSON.parse(evt.data);
        
        if(jsonObj['event'] == "keyUp") {
                    
            console.log('keyUp: ', jsonObj);
            sendToIndigo({ 'message-type': 'key-up', 'payload': jsonObj}); 

        } else if(jsonObj['event'] == "keyDown") {
        
            console.log('keyDown: ', jsonObj);
            sendToIndigo({ 'message-type': 'key-down', 'payload': jsonObj}); 
            
        } else if(jsonObj['event'] == "didReceiveGlobalSettings") {
        
            console.log("didReceiveGlobalSettings: ", jsonObj);
    
            if(jsonObj.payload.settings != null && jsonObj.payload.settings.hasOwnProperty('indigoAddress')){
                indigoAddress = jsonObj.payload.settings["indigoAddress"];
                connectIndigo();
            }
            
        } else if(jsonObj['event'] == "willAppear") {

//            const json = { "event": "getGlobalSettings", "context": pluginUUID};
//            websocket.send(JSON.stringify(json));
    
            console.log('willAppear: ', jsonObj);
            sendToIndigo({ 'message-type': 'will-appear', 'payload': jsonObj}); 

        } else if(jsonObj['event'] == "deviceDidConnect") {

            const json = { "event": "getGlobalSettings", "context": pluginUUID};
            websocket.send(JSON.stringify(json));
    
            console.log('deviceDidConnect: ', jsonObj);
            sendToIndigo({ 'message-type': 'device-connected', 'payload': jsonObj}); 

        } else if(jsonObj['event'] == "sendToPlugin") {

            console.log('sendToPlugin: ', jsonObj);

        }    
    };
};

function connectIndigo() {
    
    if (!indigoAddress) {       // can't connect yet
        console.log('connectIndigo: no address yet');
        return
    }

    if (indigoWebSocket) {       // connection started
        console.log('connectIndigo: socket created, readyState = ', indigoWebSocket.readyState );
        return;
    }
    
    console.log('connectIndigo: starting connection, indigoAddress = ', indigoAddress);
    indigoWebSocket = new ReconnectingWebSocket('ws://' + indigoAddress);
//    indigoWebSocket = new WebSocket('ws://' + indigoAddress);
    indigoWebSocket.debug = true;

    indigoWebSocket.onopen = function (evt) {
        console.log('indigoWebSocket.onopen: readyState = ', indigoWebSocket.readyState, evt);
        msg = { 
            'message-type': 'application-info', 
            'payload': applicationInfo
        }
        indigoWebSocket.send(JSON.stringify(msg)); 
        console.log('indigoWebSocket.onopen sent: ', msg);
    };

    indigoWebSocket.onerror = function (evt) {
        console.log('indigoWebSocket.onerror: ', evt);
    };

    indigoWebSocket.onclose = function (evt) {
        console.log('indigoWebSocket.onclose: ', evt);
    };

    indigoWebSocket.onmessage = function (evt) {
        const jsonObj = JSON.parse(evt.data);
        console.log('indigoWebSocket.onmessage: ', jsonObj);
    };
};

function sendToIndigo(jsn) {
    console.log('sendToIndigo, queueing: ', jsn);
    wsQueue.enqueue(jsn);    
    while (indigoWebSocket && (indigoWebSocket.readyState == WebSocket.OPEN) && !wsQueue.isEmpty()) {
        msg = wsQueue.dequeue();
        console.log('sendToIndigo, sending: ', msg);
        indigoWebSocket.send(JSON.stringify(msg)); 
    }
}

//code.iamkate.com - Queue class
function Queue(){var a=[],b=0;this.getLength=function(){return a.length-b};this.isEmpty=function(){return 0==a.length};this.enqueue=function(b){a.push(b)};this.dequeue=function(){if(0!=a.length){var c=a[b];2*++b>=a.length&&(a=a.slice(b),b=0);return c}};this.peek=function(){return 0<a.length?a[b]:void 0}};
