#! /usr/bin/env python
# -*- coding: utf-8 -*-
####################

import logging
import json
from websocket_server import WebsocketServer

kCurDevVersCount = 1        # current version of plugin devices

# Indigo really doesn't like dicts with keys that start with a number...
def safeKey(key):
    if key[0].isdigit():
        return 'sk' + key
    else:
        return key
        
class Plugin(indigo.PluginBase):

    ########################################
    # Main Plugin methods
    ########################################
    def __init__(self, pluginId, pluginDisplayName, pluginVersion, pluginPrefs):
        indigo.PluginBase.__init__(self, pluginId, pluginDisplayName, pluginVersion, pluginPrefs)

        pfmt = logging.Formatter('%(asctime)s.%(msecs)03d\t[%(levelname)8s] %(name)20s.%(funcName)-25s%(msg)s', datefmt='%Y-%m-%d %H:%M:%S')
        self.plugin_file_handler.setFormatter(pfmt)

        try:
            self.logLevel = int(self.pluginPrefs[u"logLevel"])
        except:
            self.logLevel = logging.INFO
        self.indigo_log_handler.setLevel(self.logLevel)

    def validatePrefsConfigUi(self, valuesDict):
        errorDict = indigo.Dict()

        try:
            self.logLevel = int(valuesDict[u"logLevel"])
        except:
            self.logLevel = logging.INFO
        self.indigo_log_handler.setLevel(self.logLevel)

        try:
            port = int(valuesDict[u"socketPort"])
        except:
            errorDict[u"socketPort"] =  "Non-integer port number"
        else:
            if port < 1024:
                errorDict[u"socketPort"] =  "Priviledged port number"
                
        if len(errorDict) > 0:
            return (False, valuesDict, errorDict)
        return (True, valuesDict)

    def closedPrefsConfigUi(self, valuesDict, userCancelled):
        if userCancelled:
            return
            
        self.logLevel = int(valuesDict[u"logLevel"])
        self.indigo_log_handler.setLevel(self.logLevel)

        if valuesDict[u"socketPort"] != self.socketPort:
            self.socketPort = valuesDict[u"socketPort"]
            self.start_websocket(int(self.socketPort))


    def startup(self):
        self.logger.info(u"Starting StreamDeck")
        self.triggers = { }
        self.activeConnections = {}
        
        # these are the Streamdeck devices and buttons that have Indigo devices to match
        self.activeDecks = {}
        self.activeButtons = {}

        # these are the known Streamdeck devices and buttons, may not have a matching Indigo device 
        self.known_devices = indigo.activePlugin.pluginPrefs.get(u"known_devices", indigo.Dict())
        self.known_buttons = indigo.activePlugin.pluginPrefs.get(u"known_buttons", indigo.Dict())

        self.wsServer = None
        self.socketPort = self.pluginPrefs.get(u'socketPort', 9001)
        self.start_websocket(int(self.socketPort))

                
    def shutdown(self):
        self.logger.info(u"Stopping StreamDeck")
        indigo.activePlugin.pluginPrefs[u"known_devices"] = self.known_devices
        indigo.activePlugin.pluginPrefs[u"known_buttons"] = self.known_buttons

        if self.wsServer:
            self.wsServer.server_close()
            self.wsServer = None

    def start_websocket(self, port):
        if self.wsServer:
            self.logger.debug("Closing existing Websocket Server")
            self.wsServer.server_close()
            self.wsServer = None
        try:
            self.wsServer = WebsocketServer(port, '127.0.0.1')
            self.wsServer.set_fn_new_client(self.onConnect)
            self.wsServer.set_fn_client_left(self.onClose)
            self.wsServer.set_fn_message_received(self.onMessage)
            self.wsServer.timeout = 1.0
            self.logger.debug(u"Started Websocket Server on port {}".format(port))
        except Error as e:
            self.logger.warning(u"Error starting Websocket Server: {}".format(e))
                    
    def runConcurrentThread(self):
        try:
            while True:
                if self.wsServer:        
                    self.wsServer.handle_request()
                    self.sleep(0.1)
                else:
                    self.sleep(1)
        except self.StopThread:
            pass        

    ####################

    def onConnect(self, client, server):
        self.logger.debug(u"onConnect client: {}".format(client['id']))
        self.activeConnections[client['id']] = client
        
        reply = { "event": "connected", "clientID": client['id']}
        self.wsServer.send_message(client, json.dumps(reply))

    def onClose(self, client, server):
        self.logger.debug(u"onClose client: {}".format(client['id']))
        del self.activeConnections[client['id']]
        
    def onMessage(self, client, server, received):
    
        try:
            message = json.loads(received)
        except:
            self.logger.warning(u"onMessage received invalid JSON:\n{}".format(received))
            return

        self.logger.threaddebug(u"onMessage from client: {}, message: {}".format(client['id'], message))
            
        if not 'message-type' in message:
            self.logger.warning("onMessage no message-type, message: {}".format(message))
            return 
    
        if message['message-type'] == 'applicationInfo':                
            self.applicationInfo(message, client)
                
        elif message['message-type'] in ['deviceDidConnect']:
            self.deviceDidConnect(message, client)
            
        elif message['message-type'] in ['deviceDidDisconnect']:
            self.deviceDidDisconnect(message, client)
            
        elif message['message-type'] in ['willAppear']:
            self.buttonWillAppear(message, client)
            
        elif message['message-type'] in ['willDisappear']:
            self.buttonWillDisappear(message, client)
            
        elif message['message-type'] in ['keyUp', 'keyDown']:
            self.keyPress(message, client)
                    
        
    ####################        
        
    def applicationInfo(self, message, client):            
        for dev in message[u'payload'][u'devices']:
            self.logger.debug(u"onMessage applicationInfo Adding/Updating device: {}".format(dev))

            deck = {}
            deck[u'id']       = dev[u'id']
            deck[u'name']     = dev[u'name']
            deck[u'columns']  = dev[u'size'][u'columns']
            deck[u'rows']     = dev[u'size'][u'rows']
            deck[u'type']     = dev.get(u'type', -1)            
            deck[u'client']   = client['id']            
            self.registerDeck(deck)

    def deviceDidConnect(self, message, client):            
        self.logger.debug(u"onMessage deviceDidConnect Adding/Updating device: {}".format(message))

        deck = {}
        deck[u'id']       = message[u'payload'][u'device']
        deck[u'name']     = message[u'payload'][u'deviceInfo'][u'name']
        deck[u'columns']  = message[u'payload'][u'deviceInfo'][u'size'][u'columns']
        deck[u'rows']     = message[u'payload'][u'deviceInfo'][u'size'][u'rows']
        deck[u'type']     = message[u'payload'][u'deviceInfo'].get(u'type', -1)            
        deck[u'client']   = client['id']            
        self.registerDeck(deck)
        
    def registerDeck(self, deckDict):
        deckKey = safeKey(deckDict[u'id'])
        self.known_devices[deckKey] = deckDict

        if deckKey in self.activeDecks:   # If there's an active Indigo device, update the active state
            deckDevice = indigo.devices.get(int(self.activeDecks[deckKey]))
            if not deckDevice:
                self.logger.warning("registerDeck invalid Deck DeviceID: {}".format(deckDict))
            else:            
                states_list = []
                states_list.append({'key': 'active',  'value': True})
                states_list.append({'key': 'name',    'value': deckDict[u'name']})
                states_list.append({'key': 'columns', 'value': deckDict[u'columns']})
                states_list.append({'key': 'rows',    'value': deckDict[u'rows']})
                states_list.append({'key': 'type',    'value': deckDict[u'type']})
                states_list.append({'key': 'clientID','value': deckDict['client']})
                deckDevice.updateStatesOnServer(states_list)


    def deviceDidDisconnect(self, message, client):            
        self.logger.debug(u"onMessage deviceDidDisconnect: {}".format(message))
        deckKey = safeKey(message[u'payload'][u'device'])
        if deckKey in self.activeDecks:   # If there's an active Indigo device, update the active state
            deckDevice = indigo.devices.get(int(self.activeDecks[deckKey]))
            if not deckDevice:
                self.logger.warning("deviceDidDisconnect invalid Deck DeviceID: {}".format(message))
            else:            
                deckDevice.updateStateOnServer(key="active", value=False)


    def buttonWillAppear(self, message, client):            
        self.logger.debug(u"onMessage buttonWillAppear: {}".format(message))
        buttonKey = safeKey(message[u'payload'][u'context'])
        button = {}
        button[u'id']       = message[u'payload'][u'context']
        button[u'device']   = message[u'payload'][u'device']
        button[u'column']   = message[u'payload'][u'payload'][u'coordinates'][u'column']
        button[u'row']      = message[u'payload'][u'payload'][u'coordinates'][u'row']
        button[u'settings'] = message[u'payload'][u'payload'][u'settings']
        button[u'name']     = "{}-{}-{}".format(self.known_devices[button[u'device']][u'name'], button[u'column'],  button[u'row'])
        button[u'client']   = client['id']            

        self.known_buttons[buttonKey] = button

        if buttonKey in self.activeButtons:   # If there's an active Indigo device, update the visible state
            buttonDevice = indigo.devices.get(int(self.activeButtons[buttonKey]))
            if not buttonDevice:
                self.logger.warning("buttonWillAppear invalid button DeviceID: {}".format(message))
            else:            
                states_list = []
                states_list.append({'key': 'visible', 'value': True})
                states_list.append({'key': 'name',    'value': button[u'name']})
                states_list.append({'key': 'column',  'value': button[u'column']})
                states_list.append({'key': 'row',     'value': button[u'row']})
                states_list.append({'key': 'clientID','value': client['id']})
                buttonDevice.updateStatesOnServer(states_list)

    def buttonWillDisappear(self, message, client):            
        self.logger.debug(u"onMessage buttonWillDisappear: {}".format(message))
        buttonKey = safeKey(message[u'payload'][u'context'])
        if buttonKey in self.activeButtons:   # If there's an active Indigo device, update the visible state
            buttonDevice = indigo.devices.get(int(self.activeButtons[buttonKey]))
            if not buttonDevice:
                self.logger.warning("buttonWillDisappear invalid button DeviceID: {}".format(message))
            else:            
                deckDevice.updateStateOnServer(key="visible", value=False)


    def keyPress(self, message, client):
        self.logger.debug(u"onMessage keyPress: {}".format(message)) 
        
        messageType = message['message-type']
        if messageType not in ['keyDown', 'keyUp']:
            self.logger.warning("keyPress unexpected message-type: {}".format(message['message-type']))
            return
        
        eventID       = message[u'payload'][u'payload'][u'settings'][u'eventID']
        actionRequest = message[u'payload'][u'payload'][u'settings'][u'actionRequest']
        
        if actionRequest == u'action-group' and messageType == 'keyDown':
        
            indigo.actionGroup.execute(int(eventID))

        elif actionRequest == u'indigo-device-momentary' and messageType == 'keyDown':

            indigo.device.turnOn(int(eventID))    
        
        elif actionRequest == u'indigo-device-momentary' and messageType == 'keyUp':

            indigo.device.turnOff(int(eventID))    
        
        elif actionRequest == u'indigo-device-toggle' and messageType == 'keyDown':

            indigo.device.toggle(int(eventID))    
        
        elif actionRequest == u'indigo-variable':

            indigo.variable.updateValue(int(eventID), value=messageType)
                
                    
    ########################################
    
    def validateDeviceConfigUi(self, valuesDict, typeId, devId):
        errorsDict = indigo.Dict()
        if len(errorsDict) > 0:
            return (False, valuesDict, errorsDict)
        return (True, valuesDict)

            
                
    ########################################
    # Called for each enabled Device belonging to plugin
    ########################################

    def deviceStartComm(self, device):
        self.logger.info(u"{}: Starting Device".format(device.name))

        instanceVers = int(device.pluginProps.get('devVersCount', 0))
        if instanceVers == kCurDevVersCount:
            self.logger.threaddebug(u"{}: Device is current version: {}".format(device.name ,instanceVers))
        elif instanceVers < kCurDevVersCount:
            newProps = device.pluginProps
            newProps["devVersCount"] = kCurDevVersCount
            device.replacePluginPropsOnServer(newProps)
            self.logger.debug(u"{}: Updated device version: {} -> {}".format(device.name,  instanceVers, kCurDevVersCount))
        else:
            self.logger.warning(u"{}: Invalid device version: {}".format(device.name, instanceVers))

        if device.deviceTypeId == "sdDevice":
            self.activeDecks[device.address] = device.id
        elif device.deviceTypeId == "sdButton":
            self.activeButtons[device.address] = device.id
                                 
                                 
    def deviceStopComm(self, device):
        self.logger.info(u"{}: Stopping Device".format(device.name))
        if device.deviceTypeId == "sdDevice":
            del self.activeDecks[device.id]
        elif device.deviceTypeId == "sdButton":
            del self.activeButtons[device.id]



    ########################################
    # Plugin Actions object callbacks
    ########################################

#     def setProfileAction(self, pluginAction, deckDevice, callerWaitingForResult):
#         self.logger.debug("setProfileAction: pluginAction = {}".format(pluginAction))
#         self.logger.debug("setProfileAction: deckDevice = {} ({})".format(deckDevice, type(deckDevice)))
#         
#         profile = indigo.activePlugin.substitute(pluginAction.props["profile"])
#         deckDeviceID = pluginAction.props["device"]
#         deckDevice = indigo.devices[]
#         socketClient = self.activeConnections[]
#     
#         message = {
#             "event": "switchToProfile",
#             "profile": profile
#         }
#         self.wsServer.send_message(socketClient, json.dumps(message))
        

    def availableDeckList(self, filter="", valuesDict=None, typeId="", targetId=0):

        retList =[]
        for key in self.known_devices:
            device = self.known_devices[key]
            retList.append((device['id'], device['name']))

        self.logger.debug("availableDeckList: retList = {}".format(retList))
        return retList


    def availableButtonList(self, filter="", valuesDict=None, typeId="", targetId=0):

        in_use =[]
        for dev in indigo.devices.iter(filter="self.sdButton"):
            in_use.append(dev.pluginProps[u'context'])

        retList =[]
        for key in self.known_buttons:
            button = self.known_buttons[key]
            if button['id'] not in in_use:
                retList.append((button['id'], button['name']))

        self.logger.debug("availableButtonList: retList = {}".format(retList))
        return retList

    # doesn't do anything, just needed to force other menus to dynamically refresh
    def menuChanged(self, valuesDict = None, typeId = None, devId = None):
        return valuesDict

    def validateActionConfigUi(self, valuesDict, typeId, devId):
        errorsDict = indigo.Dict()
        try:
            pass
        except:
            pass
        if len(errorsDict) > 0:
            return (False, valuesDict, errorsDict)
        return (True, valuesDict)

    
    ########################################
    # Menu Command Methods
    ########################################

    def dumpKnownDevices(self):
        self.logger.info(u"Known decks:\n{}".format(self.known_devices))
        self.logger.info(u"Known buttons:\n{}".format(self.known_buttons))

    def dumpActiveDevices(self):
        self.logger.info(u"Active decks:\n{}".format(self.activeDecks))
        self.logger.info(u"Active buttons:\n{}".format(self.activeButtons))

    def purgeKnownDevices(self):
        self.known_devices = {}
        self.known_buttons = {}


    ########################################
    # Event/Trigger Methods
    ########################################

    def triggerStartProcessing(self, trigger):
        self.logger.debug("Adding Trigger %s (%d) - %s" % (trigger.name, trigger.id, trigger.pluginTypeId))
        assert trigger.id not in self.triggers
        self.triggers[trigger.id] = trigger

    def triggerStopProcessing(self, trigger):
        self.logger.debug("Removing Trigger %s (%d)" % (trigger.name, trigger.id))
        assert trigger.id in self.triggers
        del self.triggers[trigger.id]

    def triggerCheck(self, device):

        for triggerId, trigger in sorted(self.triggers.iteritems()):
            self.logger.debug("Checking Trigger %s (%s), Type: %s" % (trigger.name, trigger.id, trigger.pluginTypeId))


