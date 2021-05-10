let websocket = null,
    uuid = null,
    actionInfo = {};

function connectElgatoStreamDeckSocket(inPort, inPropertyInspectorUUID, inRegisterEvent, inInfo, inActionInfo) {

    uuid = inPropertyInspectorUUID;
    actionInfo = JSON.parse(inActionInfo);

    websocket = new WebSocket('ws://localhost:' + inPort);

    websocket.onopen = function()                   // WebSocket is connected, register the Property Inspector
    {
        console.log("websocket.onopen: ");

        let json = {
            "event": inRegisterEvent,
            "uuid": inPropertyInspectorUUID
        };
        websocket.send(JSON.stringify(json));

        json = {
            "event": "getSettings",
            "context": uuid,
        };
        websocket.send(JSON.stringify(json));

        json = {
            "event": "getGlobalSettings",
            "context": uuid,
        };
        websocket.send(JSON.stringify(json));
    };

    websocket.onmessage = function(evt)            // Received message from Stream Deck
    {
        const jsonObj = JSON.parse(evt.data);
        console.log("websocket.onmessage:", jsonObj.event, jsonObj);

        if (jsonObj.event === 'didReceiveSettings') 
        {
            const settings = jsonObj.payload.settings;
            console.log("websocket.onmessage: didReceiveSettings, settings = ", settings);

            document.getElementById('indigoAddress').value = settings.indigoAddress;
            if(document.getElementById('indigoAddress').value == "undefined") {
                document.getElementById('indigoAddress').value = "";
            }

            document.getElementById('actionRequest').value = settings.actionRequest;
            if(document.getElementById('actionRequest').value == "undefined") {
                document.getElementById('actionRequest').value = "";
            }
            
            document.getElementById('eventID').value = settings.eventID;
            if(document.getElementById('eventID').value == "undefined") {
                document.getElementById('eventID').value = "";
            }
        }
        else if (jsonObj.event === 'didReceiveGlobalSettings') 
        {
            const settings = jsonObj.payload.settings;
            console.log("websocket.onmessage: didReceiveGlobalSettings, settings = ", settings);

        }
        else if (jsonObj.event === 'sendToPlugin') 
        {
            console.log('websocket.onmessage sendToPlugin: payload = ', jsonObj.payload);
        }
    };
}

function updateIndigoAddress() 
{
    if (websocket && (websocket.readyState === 1)) {
        let payload = {};
        payload.indigoAddress = document.getElementById('indigoAddress').value;
        const json = {
            "event": "setSettings",
            "context": uuid,
            "payload": payload
        };
        websocket.send(JSON.stringify(json));
        console.log("updateIndigoAddress: ", json);
    }    
}

function updateAction() 
{
    if (websocket && (websocket.readyState === 1)) {
        let payload = {};
        payload.actionRequest = document.getElementById('actionRequest').value;
        payload.eventID = document.getElementById('eventID').value;
        const json = {
            "event": "setSettings",
            "context": uuid,
            "payload": payload
        };
        websocket.send(JSON.stringify(json));
        console.log("updateAction: ", json);
    }    
}

