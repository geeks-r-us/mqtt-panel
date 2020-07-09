## MQTT Panel

![controls](https://github.com/geeks-r-us/mqtt-panel/raw/master/src/img/logo.svg?sanitize=true "controls")
[![CircleCI](https://circleci.com/gh/geeks-r-us/mqtt-panel.svg?style=svg)](https://circleci.com/gh/geeks-r-us/mqtt-panel)

A panel to enable grafana to fulfil simple control tasks via MQTT. 

Currently it contains 3 types of control:

![controls](https://github.com/geeks-r-us/mqtt-panel/raw/master/src/img/controls.png "controls")

Each type can connect to a mqtt server and subscribe and publish to a topic. 

![server](https://github.com/geeks-r-us/mqtt-panel/raw/master/src/img/server.png "server")

### Limitations

Due to the MQTT client runs in the browser it can only establish mqtt connection over websockets and can only connect
to servers reachable by your browser. 

### Testing

If you like to test this plugin the easies way is to load it into a grafana docker container. 

```
docker run -d -p 3000:3000 -e "GF_INSTALL_PLUGINS=https://github.com/geeks-r-us/mqtt-panel/releases/download/v1.0.3/geeksrus-mqtt-panel-1.0.3.zip;mqtt-panel" --name=grafana grafana/grafana
```
Open http://localhost:3000 in your browser

This is my first attempt to write a grafana panel so every issue report, comment or PR are welcome.

### Support

If you find this module useful please support me with a cup of [coffee](https://ko-fi.com/geeks_r_us)
