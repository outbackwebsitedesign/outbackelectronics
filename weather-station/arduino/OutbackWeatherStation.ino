/*
 * Outback Electronics Weather Station — Arduino / ESP8266 / ESP32
 *
 * Works with any WiFi-capable board: ESP8266 (NodeMCU, Wemos D1),
 * ESP32, Arduino Uno WiFi Rev2, Arduino MKR WiFi 1010, Nano 33 IoT, etc.
 *
 * Fill in your credentials below, add your sensor reads in readSensors(),
 * and the board will POST to the weather dashboard every 30 seconds.
 *
 * The server accepts ANY numeric key — you are not limited to the examples
 * shown. Add as many keys as your sensors produce.
 *
 * ── Dependencies (install via Arduino Library Manager) ───────────────────────
 *   Board-specific WiFi:
 *     ESP8266:  "ESP8266 by ESP8266 Community" (board package)
 *     ESP32:    "esp32 by Espressif Systems" (board package)
 *     MKR/Nano: "WiFiNINA by Arduino"
 *     Uno WiFi: "WiFi by Arduino"
 *
 *   Example sensor libraries (install what you have):
 *     DHT11/22:    "DHT sensor library by Adafruit"
 *     BMP280:      "Adafruit BMP280 Library"
 *     BME280:      "Adafruit BME280 Library"
 *     SHT31:       "Adafruit SHT31 Library"
 *     MQ sensors:  no library needed — raw analogRead()
 *
 * ── Quick start ───────────────────────────────────────────────────────────────
 *   1. Register a station at https://weather.outbackelectronics.com.au
 *      (click "Add Sensor") and copy your API key.
 *   2. Fill in WIFI_SSID, WIFI_PASSWORD, API_KEY, and STATION_NAME below.
 *   3. Wire up your sensors and uncomment the relevant sections.
 *   4. Flash and open Serial Monitor at 115200 baud to verify.
 */

// ── Configuration — edit these ────────────────────────────────────────────────

#define WIFI_SSID      "your-wifi-ssid"
#define WIFI_PASSWORD  "your-wifi-password"
#define API_KEY        "your-api-key-from-add-sensor"
#define STATION_NAME   "your-station-name"          // must match your registered name
#define SERVER_URL     "https://weather.outbackelectronics.com.au"
#define POST_INTERVAL  30000                         // milliseconds between readings

// ── Board-specific WiFi + HTTP includes ───────────────────────────────────────

#if defined(ESP8266)
  #include <ESP8266WiFi.h>
  #include <ESP8266HTTPClient.h>
  #include <WiFiClientSecureBearSSL.h>
  #define USE_ESP8266
#elif defined(ESP32)
  #include <WiFi.h>
  #include <HTTPClient.h>
  #define USE_ESP32
#else
  // Arduino MKR WiFi 1010, Nano 33 IoT, Uno WiFi Rev2
  #include <WiFiNINA.h>
  // Note: use WiFiSSLClient for HTTPS on NINA boards
  #define USE_NINA
#endif

// ── Optional: uncomment sensor libraries you have ────────────────────────────

// #include <DHT.h>
// #define DHT_PIN 4
// #define DHT_TYPE DHT22
// DHT dht(DHT_PIN, DHT_TYPE);

// #include <Wire.h>
// #include <Adafruit_BMP280.h>
// Adafruit_BMP280 bmp;

// #include <Wire.h>
// #include <Adafruit_BME280.h>
// Adafruit_BME280 bme;

// #include <Wire.h>
// #include <Adafruit_SHT31.h>
// Adafruit_SHT31 sht31;

// ── JSON builder — no library needed ─────────────────────────────────────────

class JsonDoc {
  String buf;
  bool first = true;
public:
  JsonDoc() { buf = "{"; }
  void addStr(const char* key, const char* val) {
    if (!first) buf += ",";
    buf += "\""; buf += key; buf += "\":\""; buf += val; buf += "\"";
    first = false;
  }
  void addFloat(const char* key, float val, int dp = 2) {
    if (!first) buf += ",";
    buf += "\""; buf += key; buf += "\":";
    buf += String(val, dp);
    first = false;
  }
  void addInt(const char* key, long val) {
    if (!first) buf += ",";
    buf += "\""; buf += key; buf += "\":";
    buf += String(val);
    first = false;
  }
  String finish() { return buf + "}"; }
};

// ── Sensor reads — add your sensors here ─────────────────────────────────────

String buildPayload() {
  // Outer document
  JsonDoc outer;
  outer.addStr("station_id", STATION_NAME);

  // Data object — add any numeric keys you like
  String dataJson = "{";
  bool firstData = true;

  auto addDataField = [&](const char* key, float val, int dp = 2) {
    if (!firstData) dataJson += ",";
    dataJson += "\""; dataJson += key; dataJson += "\":";
    dataJson += String(val, dp);
    firstData = false;
  };

  // Sensors metadata array — list what you have
  String sensorsJson = "[";
  bool firstSensor = true;
  auto addSensor = [&](const char* name) {
    if (!firstSensor) sensorsJson += ",";
    sensorsJson += "\""; sensorsJson += name; sensorsJson += "\"";
    firstSensor = false;
  };

  // ── DHT22 example ──────────────────────────────────────────────────────────
  // Uncomment this block if you have a DHT22 (or change DHT_TYPE to DHT11)
  /*
  float h = dht.readHumidity();
  float t = dht.readTemperature();
  if (!isnan(h) && !isnan(t)) {
    addDataField("temperature", t);
    addDataField("humidity",    h);
    addSensor("DHT22");
  }
  */

  // ── BMP280 example ─────────────────────────────────────────────────────────
  /*
  addDataField("pressure",    bmp.readPressure() / 100.0F);  // hPa
  addDataField("temperature", bmp.readTemperature());
  addSensor("BMP280");
  */

  // ── BME280 example ─────────────────────────────────────────────────────────
  /*
  addDataField("temperature", bme.readTemperature());
  addDataField("humidity",    bme.readHumidity());
  addDataField("pressure",    bme.readPressure() / 100.0F);
  addSensor("BME280");
  */

  // ── SHT31 example ──────────────────────────────────────────────────────────
  /*
  addDataField("temperature", sht31.readTemperature());
  addDataField("humidity",    sht31.readHumidity());
  addSensor("SHT31");
  */

  // ── MQ-2 / MQ-135 analog example (ESP8266: A0, ESP32: GPIO 34) ───────────
  /*
  int raw = analogRead(A0);
  float voltage = raw * (3.3 / 1023.0);
  addDataField("mq2_raw_voltage", voltage);
  addSensor("MQ-2");
  */

  // ── Add your own sensors below ────────────────────────────────────────────
  // addDataField("my_sensor_key", myValue);
  // addSensor("MySensorModel");

  sensorsJson += "]";
  dataJson    += "}";

  // Assemble final payload manually (avoids double-escaping)
  String payload = "{";
  payload += "\"station_id\":\"" + String(STATION_NAME) + "\",";
  payload += "\"sensors\":" + sensorsJson + ",";
  payload += "\"data\":"    + dataJson;
  payload += "}";
  return payload;
}

// ── WiFi connect ──────────────────────────────────────────────────────────────

void connectWifi() {
  Serial.print("Connecting to WiFi");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println(" connected. IP: " + WiFi.localIP().toString());
  } else {
    Serial.println(" FAILED — will retry");
  }
}

// ── POST reading ──────────────────────────────────────────────────────────────

void postReading() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWifi();
    if (WiFi.status() != WL_CONNECTED) return;
  }

  String payload = buildPayload();
  String url     = String(SERVER_URL) + "/api/weather/readings";

  Serial.println("Posting: " + payload);

  int httpCode = -1;

#if defined(USE_ESP8266)
  BearSSL::WiFiClientSecure client;
  client.setInsecure();            // skip cert check — fine for sensor data
  HTTPClient http;
  if (http.begin(client, url)) {
    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-Api-Key", API_KEY);
    httpCode = http.POST(payload);
    http.end();
  }

#elif defined(USE_ESP32)
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Api-Key", API_KEY);
  httpCode = http.POST(payload);
  http.end();

#else  // NINA (MKR, Nano 33)
  WiFiSSLClient client;
  if (client.connect(SERVER_URL + 8, 443)) {
    // Simple raw HTTPS POST for NINA boards
    String body = payload;
    client.println("POST /api/weather/readings HTTP/1.1");
    client.println("Host: " SERVER_URL + 8);
    client.println("Content-Type: application/json");
    client.println("X-Api-Key: " API_KEY);
    client.print("Content-Length: "); client.println(body.length());
    client.println("Connection: close");
    client.println();
    client.print(body);
    delay(500);
    while (client.available()) client.read();
    httpCode = 200;  // assume ok for simplicity
    client.stop();
  }
#endif

  if (httpCode == 200) {
    Serial.println("OK");
  } else {
    Serial.println("POST failed, code: " + String(httpCode));
  }
}

// ── Setup & loop ──────────────────────────────────────────────────────────────

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\nOutback Electronics Weather Station");

  // Uncomment sensor init below as needed:
  // dht.begin();
  // Wire.begin(); bmp.begin(0x76);
  // Wire.begin(); bme.begin(0x76);
  // Wire.begin(); sht31.begin(0x44);

  connectWifi();
}

unsigned long lastPost = 0;

void loop() {
  unsigned long now = millis();
  if (now - lastPost >= POST_INTERVAL) {
    lastPost = now;
    postReading();
  }
}
