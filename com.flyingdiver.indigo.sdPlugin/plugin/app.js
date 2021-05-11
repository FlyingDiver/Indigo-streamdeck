let sdWebsocket = null,
    indigoWebsocket = null,
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
        console.log("sdWebsocket.onopen, uuid:", pluginUUID, ". Sending registration and global settings request");
        json = {
            "event": inRegisterEvent,
            "uuid": pluginUUID
        };
        sdWebsocket.send(JSON.stringify(json));        
 
        json = { 
            "event": "getSettings", 
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
            // if the settings has the address, we can start the connection process
        
            if(jsonObj.payload.settings != null && jsonObj.payload.settings.hasOwnProperty('indigoAddress'))
            {
                indigoAddress = jsonObj.payload.settings["indigoAddress"];
                connectIndigo();
            };
            break;
            
        case "didReceiveGlobalSettings":
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

    if (indigoWebsocket) {       // connection started
        console.log('connectIndigo: socket created, readyState = ', indigoWebsocket.readyState );
        return;
    }
    
    console.log('connectIndigo: starting connection, indigoAddress = ', indigoAddress);
    indigoWebsocket = new ReconnectingWebSocket('ws://' + indigoAddress);

    indigoWebsocket.onopen = function (evt) {
        console.log('indigoWebsocket.onopen: readyState = ', indigoWebsocket.readyState, evt);
        msg = { 
            'message-type': 'applicationInfo', 
            'payload':  applicationInfo
        }
        indigoWebsocket.send(JSON.stringify(msg)); 
        console.log('indigoWebsocket.onopen sent: ', msg);
        sendToIndigo(null);     // kick the queue
    };

    indigoWebsocket.onerror = function (evt) {
        console.log('indigoWebsocket.onerror: ', evt);
    };

    indigoWebsocket.onclose = function (evt) {
        console.log('indigoWebsocket.onclose: ', evt);
    };

    indigoWebsocket.onmessage = function (evt) {
        handleIndigoMessage(JSON.parse(evt.data))
    };
};

function sendToIndigo(jsn) {
    if (jsn)
    {
        console.log('sendToIndigo, queueing: ', jsn);
        wsQueue.enqueue(jsn);
    }
      
    while (indigoWebsocket && (indigoWebsocket.readyState == WebSocket.OPEN) && !wsQueue.isEmpty()) {
        msg = wsQueue.dequeue();
        console.log('sendToIndigo, sending: ', msg);
        indigoWebsocket.send(JSON.stringify(msg)); 
    }
}

function handleIndigoMessage(jsonObj)
{
    console.log('handleIndigoMessage: ', jsonObj);
    
    if (jsonObj.event == 'setState')
    {
        var json = {
            "event": "setState",
            "context": jsonObj.context,
            "payload": {
                "state": jsonObj.state
            }
        };
        sdWebsocket.send(JSON.stringify(json));
    }
    else if (jsonObj.event == 'switchToProfile')
    {
        var json = {
            "event": "switchToProfile",
            "context": pluginUUID,
            "device": jsonObj.device,
            "payload": {
                "profile": jsonObj.profile
            }
        };        
        console.log('switchToProfile, sending: ', json);
        sdWebsocket.send(JSON.stringify(json));
    }
}


//code.iamkate.com - Queue class
function Queue(){var a=[],b=0;this.getLength=function(){return a.length-b};this.isEmpty=function(){return 0==a.length};this.enqueue=function(b){a.push(b)};this.dequeue=function(){if(0!=a.length){var c=a[b];2*++b>=a.length&&(a=a.slice(b),b=0);return c}};this.peek=function(){return 0<a.length?a[b]:void 0}};
