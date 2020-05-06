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
        console.log("websocket.onmessage: ", jsonObj);

        if (jsonObj.event === 'didReceiveSettings') {
            const settings = jsonObj.payload.settings;
            console.log("websocket.onmessage didReceiveSettings: settings = ", payload);

            document.getElementById('eventID').value = settings.eventID;

            if(document.getElementById('eventID').value == "undefined") {
                document.getElementById('eventID').value = "";
            }
        }
        if (jsonObj.event === 'didReceiveGlobalSettings') {
            const settings = jsonObj.payload.settings;
            console.log("websocket.onmessage didReceiveGlobalSettings: settings = ", payload);

            document.getElementById('indigoAddress').value = settings.indigoAddress;

            if(document.getElementById('indigoAddress').value == "undefined") {
                document.getElementById('indigoAddress').value = "";
            }

            const el = document.querySelector('.sdpi-wrapper');
            el && el.classList.remove('hidden');
        }
    };
}

function updateEventID() 
{
    if (websocket && (websocket.readyState === 1)) {
        let payload = {};
        payload.eventID = document.getElementById('eventID').value;
        const json = {
            "event": "setSettings",
            "context": uuid,
            "payload": payload
        };
        websocket.send(JSON.stringify(json));
        console.log("updateEventID: ", json);
    }    
}

function updateIndigoAddress() 
{
    if (websocket && (websocket.readyState === 1)) {
        let payload = {};
        payload.indigoAddress = document.getElementById('indigoAddress').value;
        const json = {
            "event": "setGlobalSettings",
            "context": uuid,
            "payload": payload
        };
        websocket.send(JSON.stringify(json));
        console.log("updateIndigoAddress: ", json);
    }    
}
