let sdWebsocket = null,
    indigoWebSocket = null,
    pluginUUID = null,
    applicationInfo = null,
    indigoAddress = null,
    buttonTitles = {},
    wsQueue = new Queue();


function connectElgatoStreamDeckSocket(inPort, inPluginUUID, inRegisterEvent, inApplicationInfo)
{
    pluginUUID = inPluginUUID;
    applicationInfo = JSON.parse(inApplicationInfo);

    console.log('connectElgatoStreamDeckSocket: applicationInfo = ', applicationInfo);

    // Open the web socket
    sdWebsocket = new WebSocket("ws://localhost:" + inPort);

    sdWebsocket.onopen = function()           // WebSocket is connected, register the plugin
    {
        console.log("sdWebsocket.onopen, Sending registration and global settings request");
        json = {
            "event": inRegisterEvent,
            "uuid": inPluginUUID
        };
        sdWebsocket.send(JSON.stringify(json));        
 
        json = { 
            "event": "getGlobalSettings", 
            "context": pluginUUID
        };
        sdWebsocket.send(JSON.stringify(json));
   };

    sdWebsocket.onmessage = function(evt)     // Received message from Stream Deck
    {
        const jsonObj = JSON.parse(evt.data);
        const event = jsonObj.event;
        console.log('sdWebsocket.onmessage', event, jsonObj);
        
        switch (event) {
        
        case 'deviceDidConnect':
        case 'deviceDidDisconnect':
                sendToIndigo({ 'message-type': event, 'title': null, 'payload': jsonObj});            
                break;
                        
        case 'willAppear':
        case 'willDisappear':
        case 'keyUp':
        case 'keyDown':
            if (jsonObj.context in buttonTitles)
            {
                sendToIndigo({ 'message-type': event, 'title': buttonTitles[jsonObj.context], 'payload': jsonObj});
            }
            else
            {
                sendToIndigo({ 'message-type': event, 'title': null, 'payload': jsonObj});            
            }
            break;
                
        case "titleParametersDidChange":
            buttonTitles[jsonObj.context] = jsonObj.payload.title;
            break;
            
        case "systemDidWakeUp":
            break;
            
        case "didReceiveSettings":
            break;
            
        case "didReceiveGlobalSettings":
            // if the settings has the address, we can start the connection process
        
            if(jsonObj.payload.settings != null && jsonObj.payload.settings.hasOwnProperty('indigoAddress'))
            {
                indigoAddress = jsonObj.payload.settings["indigoAddress"];
                connectIndigo();
            };
            break;

        case "sendToPlugin":
            console.log('sdWebsocket.onmessage sendToPlugin payload = ', jsonObj.payload);
            break;
            
        case "propertyInspectorDidAppear":
            break;
            
        case "propertyInspectorDidDisappear":
            break;
            
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

    indigoWebSocket.onopen = function (evt) {
        console.log('indigoWebSocket.onopen: readyState = ', indigoWebSocket.readyState, evt);
        msg = { 
            'message-type': 'applicationInfo', 
            'payload':  applicationInfo
        }
        indigoWebSocket.send(JSON.stringify(msg)); 
        console.log('indigoWebSocket.onopen sent: ', msg);
        sendToIndigo(null);     // kick the queue
    };

    indigoWebSocket.onerror = function (evt) {
        console.log('indigoWebSocket.onerror: ', evt);
    };

    indigoWebSocket.onclose = function (evt) {
        console.log('indigoWebSocket.onclose: ', evt);
    };

    indigoWebSocket.onmessage = function (evt) {
        handleIndigoMessage(JSON.parse(evt.data))
    };
};

function sendToIndigo(jsn) {
    if (jsn)
    {
        console.log('sendToIndigo, queueing: ', jsn);
        wsQueue.enqueue(jsn);
    }
      
    while (indigoWebSocket && (indigoWebSocket.readyState == WebSocket.OPEN) && !wsQueue.isEmpty()) {
        msg = wsQueue.dequeue();
        console.log('sendToIndigo, sending: ', msg);
        indigoWebSocket.send(JSON.stringify(msg)); 
    }
}

function handleIndigoMessage(jsonObj)
{
    console.log('handleIndigoMessage: ', jsonObj);
}


//code.iamkate.com - Queue class
function Queue(){var a=[],b=0;this.getLength=function(){return a.length-b};this.isEmpty=function(){return 0==a.length};this.enqueue=function(b){a.push(b)};this.dequeue=function(){if(0!=a.length){var c=a[b];2*++b>=a.length&&(a=a.slice(b),b=0);return c}};this.peek=function(){return 0<a.length?a[b]:void 0}};
