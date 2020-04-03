import { MetricsPanelCtrl } from 'grafana/app/plugins/sdk';
import defaultsDeep from 'lodash/defaultsDeep';
import { DataFrame } from '@grafana/data';
import $ from 'jquery';
import mqtt from 'mqtt';
import './style.css';
import angluar from 'angular';

interface KeyValue {
  key: string;
  value: any;
}

export default class MqttCtrl extends MetricsPanelCtrl {
  static templateUrl = 'partials/module.html';

  panelDefaults = {
    // Value
    value: 10,
    //Server
    mqttProtocol: 'ws',
    mqttServer: '192.168.178.47', //TODO: get base url from website
    mqttServerPort: 9001,
    mqttTopicSubscribe: 'grafana/mqtt-panel',
    mqttTopicPublish: 'grafana/mqtt-panel/set',
    // GUI
    mode: 'Text',
    // Text
    text: 'Send',
    // Slider
    minValue: 0,
    maxValue: 100,
    step: 0,
    // Switch //TODO: Translate
    offValue: 'false',
    onValue: 'true',
  };

  client: mqtt.MqttClient;
  input: any = null;
  value: any = null;

  // Simple example showing the last value of all data
  firstValues: KeyValue[] = [];

  /** @ngInject */
  constructor($scope, $injector) {
    super($scope, $injector);
    defaultsDeep(this.panel, this.panelDefaults);

    // Get results directly as DataFrames
    (this as any).dataFormat = 'series';

    this.events.on('init-edit-mode', this.onInitEditMode.bind(this));
    this.events.on('render', this.onRender.bind(this));
    this.events.on('data-error', this.onDataError.bind(this));

    // Create a client instance: Broker, Port, Websocket Path, Client ID
    var url = this.panel.mqttProtocol + '://' + this.panel.mqttServer + ':' + this.panel.mqttServerPort;
    console.log(url);
    this.client = mqtt.connect(url);
    this.client.on('connectionLost', this.onConnectionLost.bind(this));
    this.client.on('connect', this.onConnect.bind(this));
    this.client.on('message', this.onMessage.bind(this));
    this.client.subscribe(this.panel.mqttTopicSubscribe);

    angluar.module('grafana.directives').directive('stringToNumber', this.stringToNumber);
  }

  onInitEditMode() {
    this.addEditorTab('Display', `public/plugins/${this.pluginId}/partials/options.display.html`, 2);
    this.addEditorTab('Server', `public/plugins/${this.pluginId}/partials/options.server.html`, 3);
  }

  onRender() {
    if (!this.firstValues || !this.firstValues.length) {
      return;
    }

    // Tells the screen capture system that you finished
    this.renderingCompleted();
  }

  onDataError(err: any) {
    console.log('onDataError', err);
  }

  // 6.3+ get typed DataFrame directly
  handleDataFrame(data: DataFrame[]) {
    const values: KeyValue[] = [];

    for (const frame of data) {
      for (let i = 0; i < frame.fields.length; i++) {
        values.push({
          key: frame.fields[i].name,
          value: frame.fields[i].values,
        });
      }
    }

    this.firstValues = values;
  }

  link(scope: any, elem: any, attrs: any, ctrl: any) {
    this.input = $(elem.find('#value')[0]);
    console.log('link');
  }

  stringToNumber() {
    return {
      require: 'ngModel',
      link: function(scope, element, attrs, ngModel) {
        ngModel.$parsers.push(function(value) {
          return '' + value;
        });
        ngModel.$formatters.push(function(value) {
          return parseFloat(value);
        });
      },
    };
  }

  // MQTT
  onConnect() {
    console.log('connected');
    this.panel.render();
  }

  onConnectionLost() {
    console.log('onConnectionLost');
    this.panel.render();
  }

  onMessage(topic, message) {
    let value;
    switch (this.panel.mode) {
      case 'Switch':
        value = this.panel.onValue === message.toString();
        break;
      case 'Text':
      case 'Slider':
        value = message;
        break;
    }

    console.log('Received : ' + topic + ' : ' + value.toString());
    this.panel.value = value;
    this.panel.render();
  }

  connect() {
    this.client.end(true);
    var url = this.panel.mqttProtocol + '://' + this.panel.mqttServer + ':' + this.panel.mqttServerPort;
    console.log(url);
    this.client = mqtt.connect(url);
  }

  publish() {
    let value;
    switch (this.panel.mode) {
      case 'Switch':
        value = this.panel.value ? this.panel.onValue : this.panel.offValue;
        break;
      case 'Text':
      case 'Slider':
        value = this.panel.value.toString();
        break;
    }
    console.log('Published : ' + this.panel.mqttTopicPublish + ' : ' + value);
    this.client.publish(this.panel.mqttTopicPublish, value);
  }

  connected() {
    return this.client.connected ? 'successful' : 'failed';
  }
}

export { MqttCtrl as PanelCtrl };
