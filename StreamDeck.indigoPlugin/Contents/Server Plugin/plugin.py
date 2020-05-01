#! /usr/bin/env python
# -*- coding: utf-8 -*-
####################

import logging
import json
from websocket_server import WebsocketServer

kCurDevVersCount = 1        # current version of plugin devices

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

        self.triggers = { }
        self.wsServer = None

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
        self.start_websocket(int(self.pluginPrefs.get(u'socketPort', 9001)))
        
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
        
    def shutdown(self):
        self.logger.info(u"Stopping StreamDeck")
        if self.wsServer:
            self.wsServer.server_close()
            self.wsServer = None
            
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

    def onMessage(self, client, server, message):
        self.logger.debug("onMessage from client: {}, message: {}".format(client['id'], message))
#        self.wsServer.send_message(client, message)
        self.wsServer.send_message_to_all(message)

    def onConnect(self, client, server):
        self.logger.debug("onConnect client: {}".format(client['id']))

    def onClose(self, client, server):
        self.logger.debug("onClose client: {}".format(client['id']))
        
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


    ########################################
    # Menu Methods
    ########################################

