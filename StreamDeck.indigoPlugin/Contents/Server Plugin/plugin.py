#! /usr/bin/env python
# -*- coding: utf-8 -*-
####################

import logging
import json
from websocket_server import WebsocketServer

kCurDevVersCount = 1        # current version of plugin devices

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
        if not userCancelled:
            self.logLevel = int(valuesDict[u"logLevel"])
            self.indigo_log_handler.setLevel(self.logLevel)

            self.start_websocket(int(valuesDict[u"socketPort"]))

    def startup(self):
        self.logger.info(u"Starting StreamDeck")
        self.triggers = { }
        self.activeButtons = {}
        self.known_devices = indigo.activePlugin.pluginPrefs.get(u"known_devices", indigo.Dict())
        self.known_buttons = indigo.activePlugin.pluginPrefs.get(u"known_buttons", indigo.Dict())
        self.wsServer = None
        self.start_websocket(int(self.pluginPrefs.get(u'socketPort', 9001)))

                
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

    def onMessage(self, client, server, received):
        self.logger.threaddebug("onMessage from client: {}, message: {}".format(client['id'], received))
        try:
            message = json.loads(received)
        except:
            self.logger.debug("onMessage received invalid JSON message")
            return
            
        event = message.get('event', None)
        if not event:
            self.logger.warning("onMessage no event, message: {}".format(jsonMessage))
            return

        if event in ['willAppear', 'deviceDidConnect']:
            self.collectData(message)            
 
        action = message.get('action', None)
        if not action:
            self.logger.warning("onMessage no action, message: {}".format(jsonMessage))
            return
        
        if action == 'com.flyingdiver.indigo.keypress':
            self.doActionKeypress(event, message)
           
        elif action == 'com.flyingdiver.indigo.actiongroup':
            self.doActionGroup(event, message)
           
        else:
            self.logger.warning("onMessage unknown action: {}, message: {}".format(action, jsonMessage))
        
        
    def onConnect(self, client, server):
        self.logger.debug("onConnect client: {}".format(client['id']))

    def onClose(self, client, server):
        self.logger.debug("onClose client: {}".format(client['id']))
        
        
    def collectData(self, message):
        if safeKey(message[u'device']) not in self.known_devices:
            name = "StreamDeck-{}".format(len(self.known_devices))
            self.known_devices[safeKey(message[u'device'])] = { 'name': name, 'device': message[u'device']}
            
        if safeKey(message[u'context']) not in self.known_buttons:
            button = {}
            button[u'context'] = message[u'context']
            button[u'device']  = message[u'device']
            button[u'column']  = message[u'payload'][u'coordinates'][u'column']
            button[u'row']     = message[u'payload'][u'coordinates'][u'row']
            self.known_buttons[safeKey(message[u'context'])] = button

    def doActionKeypress(self, event, message):
        context = message.get('context', None)
        
        if not context in self.activeButtons:
            self.logger.debug("Unknown button context: {}".format(context))
            return
            
        buttonDevice = indigo.devices[self.activeButtons[context]]
        self.logger.debug("{}: Processing Keypress event {}".format(buttonDevice.name, event))
        if event == "keyDown":
            buttonDevice.updateStateOnServer(key='onOffState', value = True)        
        elif event == "keyUp":
            buttonDevice.updateStateOnServer(key='onOffState', value = False)
        else:
            self.logger.debug("Unknown button event: {}".format(event))
        
        
        
    def doActionGroup(self, event, message):
        self.logger.debug("doActionGroup: {}, {}".format(event, message))
                                    
    ####################

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




    ########################################
    # Called for each enabled Device belonging to plugin
    #
    def deviceStartComm(self, device):
        self.logger.info(u"{}: Starting Device".format(device.name))

        # new buttons need context and device info filled in
        if not device.pluginProps.get('context', None) or not device.pluginProps.get('device', None):
            self.logger.debug(u"{}: Adding Context and Device".format(device.name))
            newProps = device.pluginProps
            for key in self.known_buttons:
                button = self.known_buttons[key]
                deck_name = self.known_devices[safeKey(button[u'device'])]['name']
                temp = "{}.{}.{}".format(deck_name, button[u'column'], button[u'row'])
                self.logger.debug(u"{}: Looking at {}".format(device.name, temp))
                if temp == device.pluginProps['address']:
                    newProps["context"] = button[u'context']
                    newProps["device"] = button[u'device']                    
                    break
            device.replacePluginPropsOnServer(newProps)
            context = newProps["context"]
        else:
            context = device.pluginProps.get('context', None)
        self.activeButtons[context] = device.id
        self.logger.debug(u"{}: activeButtons =\n{}".format(device.name, self.activeButtons))
                                
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

        device.stateListOrDisplayStateIdChanged()
 

    ########################################
    # Terminate communication with servers
    #
    def deviceStopComm(self, device):
        self.logger.info(u"{}: Stopping Device".format(device.name))


    ########################################
    def validateDeviceConfigUi(self, valuesDict, typeId, devId):
        errorsDict = indigo.Dict()
        if len(errorsDict) > 0:
            return (False, valuesDict, errorsDict)
        return (True, valuesDict)

    ########################################
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
    # Plugin Actions object callbacks
    ########################################

    def availableButtonList(self, filter="", valuesDict=None, typeId="", targetId=0):

        in_use =[]
        for dev in indigo.devices.iter(filter="self.sdButton"):
            in_use.append(dev.pluginProps[u'context'])

        retList =[]
        for key in self.known_buttons:
            button = self.known_buttons[key]
            if button['context'] not in in_use:
                deck_device = button[u'device']
                deck_name = self.known_devices[safeKey(deck_device)]['name']
                address = "{}.{}.{}".format(deck_name, button[u'column'], button[u'row'])
                name = "[{}, {}]".format(button[u'column'], button[u'row'])
                retList.append((address, name))

        self.logger.debug("availableButtonList: retList = {}".format(retList))
        return retList

    ########################################
    # Menu Methods
    ########################################

    def dumpKnownDevices(self):
        self.logger.info(u"Known devices:\n{}".format(self.known_devices))
        self.logger.info(u"Known buttons:\n{}".format(self.known_buttons))

    def purgeKnownDevices(self):
        self.known_devices = {}
        self.known_buttons = {}
