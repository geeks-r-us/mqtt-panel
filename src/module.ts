import { MetricsPanelCtrl } from 'grafana/app/plugins/sdk';
import defaultsDeep from 'lodash/defaultsDeep';
import { DataFrame } from '@grafana/data';
import $ from 'jquery';
import mqtt, { MqttClient, IClientOptions } from 'mqtt';
import jsonata from 'jsonata';
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
    mqttProtocol: (window.location.protocol === 'https:') ? 'wss' : 'ws',
    mqttServer: '127.0.0.1', //TODO: get base url from website
    mqttServerPort: 9001,
    mqttTopicSubscribe: 'grafana/mqtt-panel',
    mqttTopicPublish: 'grafana/mqtt-panel/set',
    mqttAuth: 'None',
    mqttUser: '',
    mqttPassword: '',
    mqttTopicQuery: '',
    // GUI
    mode: 'Text',

    model: {
      // Text
      text: 'Send',
      // Slider
      minValue: 0,
      maxValue: 100,
      step: 1,
      // Switch
      offValue: 'false',
      onValue: 'true',
    },
    viewModel: {
      // Text
      text: 'Send',
      // Slider
      minValue: 0,
      maxValue: 100,
      step: 1,
    },
  };

  client: mqtt.MqttClient;
  input: any = null;
  value: any = null;

  // Simple example showing the last value of all data
  firstValues: KeyValue[] = [];

  /** @ngInject */
  constructor($scope, $injector, public templateSrv) {
    super($scope, $injector);
    defaultsDeep(this.panel, this.panelDefaults);

    // Get results directly as DataFrames
    (this as any).dataFormat = 'series';

    this.events.on('init-edit-mode', this.onInitEditMode.bind(this));
    this.events.on('render', this.onRender.bind(this));
    this.events.on('data-error', this.onDataError.bind(this));
    this.events.on('refresh', this.onRefresh.bind(this));

    // Create a client instance: Broker, Port, Websocket Path, Client ID
    this.client = this.mqttConnect();

    angluar.module('grafana.directives').directive('stringToNumber', this.stringToNumber);
  }

  onInitEditMode() {
    this.addEditorTab('Display', `public/plugins/${this.pluginId}/partials/options.display.html`, 2);
    this.addEditorTab('Server', `public/plugins/${this.pluginId}/partials/options.server.html`, 3);
  }

  onRefresh() {
    this.panel.viewModel.text = this.templateSrv.replace(String(this.panel.model.text));
    this.panel.viewModel.minValue = this.templateSrv.replace(String(this.panel.model.minValue));
    this.panel.viewModel.maxValue = this.templateSrv.replace(String(this.panel.model.maxValue));
    this.panel.viewModel.step = this.templateSrv.replace(String(this.panel.model.step));
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

  mqttConnect(): MqttClient {
    var url =
      this.panel.mqttProtocol +
      '://' +
      this.templateSrv.replace(String(this.panel.mqttServer)) +
      ':' +
      this.templateSrv.replace(String(this.panel.mqttServerPort));
    console.log(url);

    var options: IClientOptions = {};
    if (this.panel.mqttAuth === 'BasicAuth') {
      options.username = this.templateSrv.replace(String(this.panel.mqttUser));
      options.password = this.templateSrv.replace(String(this.panel.mqttPassword));
      console.log('connection with: ' + options.username + ' : ' + options.password);
    }

    let client = mqtt.connect(url, options);
    client.on('connectionLost', this.onConnectionLost.bind(this));
    client.on('connect', this.onConnect.bind(this));
    client.on('message', this.onMessage.bind(this));
    client.subscribe(this.templateSrv.replace(String(this.panel.mqttTopicSubscribe)));
    console.log('subscribing: ' + this.templateSrv.replace(String(this.panel.mqttTopicSubscribe)));

    return client;
  }

  getProtocols() {
    return [
      { text: 'ws', value: 'ws' },
      { text: 'wss', value: 'wss' },
    ];
  }

  getModes() {
    return [
      { text: 'Text', value: 'Text' },
      { text: 'Slider', value: 'Slider' },
      { text: 'Switch', value: 'Switch' },
      { text: 'Button', value: 'Button' },
    ];
  }

  getMqttAuths() {
    return [
      { text: 'None', value: 'None' },
      { text: 'Basic Auth', value: 'BasicAuth' },
    ];
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
    this.panel.refresh();
  }

  onConnectionLost() {
    console.log('onConnectionLost');
    this.panel.refresh();
  }

  onMessage(topic, message) {
    let value;

    // execute query if set
    if (this.panel.mqttTopicQuery.length > 0) {
      try {
        let jsonmesssage = JSON.parse(message);
        let expression = jsonata(this.panel.mqttTopicQuery);
        let result = expression.evaluate(jsonmesssage);

        console.log(
          'JSONata query: ' + this.panel.mqttTopicQuery + ' on message: ' + message + ' results in: ' + result
        );
        if (result) {
          message = result;
        } else {
          message = '';
        }
      } catch (e) {
        console.log(e.message);
      }
    }

    switch (this.panel.mode) {
      case 'Switch':
        value = this.templateSrv.replace(String(this.panel.model.onValue)) === message.toString();
        break;
      case 'Text':
      case 'Slider':
        value = message;
        break;
      case 'Button':
        //value = message;
        break;
    }

    console.log('Received : ' + topic + ' : ' + value.toString());
    this.panel.value = value;
    this.panel.refresh();
  }

  connect() {
    this.client.end(true);
    this.client = this.mqttConnect();
  }

  publish() {
    let value;
    switch (this.panel.mode) {
      case 'Switch':
        value = this.panel.value
          ? this.templateSrv.replace(String(this.panel.model.onValue))
          : this.templateSrv.replace(String(this.panel.model.offValue));
        break;
      case 'Button':
      case 'Text':
      case 'Slider':
        value = this.templateSrv.replace(this.panel.value.toString(), this.templateSrv.getVariables());
        break;
    }
    console.log('Published : ' + this.templateSrv.replace(String(this.panel.mqttTopicPublish)) + ' : ' + value);
    this.client.publish(this.templateSrv.replace(String(this.panel.mqttTopicPublish)), value);
  }

  connected() {
    return this.client != null && this.client.connected ? 'successful' : 'failed';
  }
}

export { MqttCtrl as PanelCtrl };
