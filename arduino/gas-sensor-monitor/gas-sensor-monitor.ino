#include <Adafruit_PCD8544.h>
#include <SPI.h>
#include <WiFiS3.h>
#include <ArduinoHttpClient.h>

// ====== LCD Configuration (Nokia 5110 - 84x48) ======
#define LCD_CLK   7    // Clock
#define LCD_DIN   6    // Data In (MOSI)
#define LCD_DC    5    // Data/Command
#define LCD_CE    4    // Chip Enable
#define LCD_RST   3    // Reset

// ====== Gas Sensor Analog Pins ======
#define SEN0565_PIN   A0   // SEN0565 Gravity CH4 Sensor (0-100% LEL)
#define MQ4_PIN       A1   // MQ-4 CH4 Methane (ppm)
#define H2_PIN        A2   // H2 Hydrogen
#define CO_PIN        A3   // CO Carbon Monoxide
#define NH3_PIN       A4   // NH3 Ammonia
#define H2S_PIN       A5   // H2S Hydrogen Sulfide

// ====== WiFi Configuration ======
const char* ssid = "YOUR_SSID";              // WiFi network name
const char* password = "YOUR_PASSWORD";      // WiFi password
const char* server = "weather.outbackelectronics.com.au";
const int port = 80;
const char* endpoint = "/api/sensors";       // API endpoint

// ====== Sensor Calibration Values ======
float mq4_ro = 10000.0;   // R0 for MQ-4 (measured in clean air)
float h2_ro = 10000.0;    // R0 for H2
float co_ro = 10000.0;    // R0 for CO
float nh3_ro = 10000.0;   // R0 for NH3
float h2s_ro = 10000.0;   // R0 for H2S

// ====== Current Sensor Readings ======
float sen0565_lel = 0;    // SEN0565: 0-100% LEL (Lower Explosive Limit)
float mq4_ppm = 0;        // MQ-4: ppm
float h2_ppm = 0;
float co_ppm = 0;
float nh3_ppm = 0;
float h2s_ppm = 0;

// ====== Status Variables ======
Adafruit_PCD8544 display(LCD_CLK, LCD_DIN, LCD_DC, LCD_CE, LCD_RST);
WiFiClient wifiClient;
HttpClient client(wifiClient, server, port);

unsigned long lastSensorRead = 0;
unsigned long lastDataPush = 0;
unsigned long lastWiFiCheck = 0;
const unsigned long SENSOR_INTERVAL = 1000;      // Read sensors every 1 second
const unsigned long PUSH_INTERVAL = 30000;       // Push data every 30 seconds
const unsigned long WIFI_CHECK_INTERVAL = 60000; // Check WiFi every 60 seconds
bool wifiConnected = false;
int displayMode = 0;

void setup() {
  Serial.begin(9600);
  delay(1000);

  // Initialize LCD
  display.begin();
  display.setContrast(50);
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(BLACK);
  display.setCursor(0, 0);
  display.println("Gas Sensor");
  display.println("Monitor");
  display.println("Starting...");
  display.display();

  Serial.println("\n=== Gas Sensor Monitor for Uno R4 WiFi ===");
  Serial.println("Initializing sensors and WiFi...");

  // Initialize WiFi
  connectToWiFi();

  // Optional: Uncomment to calibrate sensors on first run
  // Make sure sensors are in clean air for 60 seconds
  // calibrateSensors();

  Serial.println("Setup complete. Monitoring gases and pushing to weather service.");
  Serial.println("SEN0565(%LEL) | MQ4(ppm) | H2 | CO | NH3 | H2S (ppm)");
}

void loop() {
  unsigned long now = millis();

  // Check WiFi connection periodically
  if (now - lastWiFiCheck >= WIFI_CHECK_INTERVAL) {
    lastWiFiCheck = now;
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("WiFi disconnected, reconnecting...");
      connectToWiFi();
    }
  }

  // Read sensors every SENSOR_INTERVAL
  if (now - lastSensorRead >= SENSOR_INTERVAL) {
    lastSensorRead = now;

    sen0565_lel = readSEN0565(SEN0565_PIN);
    mq4_ppm = readSensor(MQ4_PIN, mq4_ro, 4.4, -0.635);
    h2_ppm = readSensor(H2_PIN, h2_ro, 87.4, -1.58);
    co_ppm = readSensor(CO_PIN, co_ro, 605.18, -3.937);
    nh3_ppm = readSensor(NH3_PIN, nh3_ro, 102.2, -2.473);
    h2s_ppm = readSensor(H2S_PIN, h2s_ro, 34.46, -3.421);

    updateDisplay();
    printSerialData();
  }

  // Push data to weather service every PUSH_INTERVAL
  if (now - lastDataPush >= PUSH_INTERVAL) {
    lastDataPush = now;
    if (wifiConnected) {
      pushDataToWeatherService();
    } else {
      Serial.println("WiFi not connected, skipping data push");
    }
  }
}

// ====== WiFi Functions ======

void connectToWiFi() {
  display.clearDisplay();
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.println("Connecting to");
  display.println("WiFi...");
  display.display();

  Serial.print("Connecting to WiFi: ");
  Serial.println(ssid);

  WiFi.begin(ssid, password);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    wifiConnected = true;
    Serial.println("\nWiFi connected!");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());

    display.clearDisplay();
    display.setTextSize(1);
    display.setCursor(0, 0);
    display.println("WiFi OK");
    display.println(WiFi.localIP());
    display.display();
    delay(2000);
  } else {
    wifiConnected = false;
    Serial.println("\nFailed to connect to WiFi");

    display.clearDisplay();
    display.setTextSize(1);
    display.setCursor(0, 0);
    display.println("WiFi FAILED");
    display.println("Check SSID/Pass");
    display.display();
    delay(2000);
  }
}

void pushDataToWeatherService() {
  if (!wifiConnected || WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi not connected");
    return;
  }

  Serial.println("Pushing data to weather service...");

  // Build request body as JSON
  String jsonData = "{";
  jsonData += "\"sen0565_lel\":" + String(sen0565_lel, 2) + ",";
  jsonData += "\"mq4_ppm\":" + String(mq4_ppm, 2) + ",";
  jsonData += "\"h2\":" + String(h2_ppm, 2) + ",";
  jsonData += "\"co\":" + String(co_ppm, 2) + ",";
  jsonData += "\"nh3\":" + String(nh3_ppm, 2) + ",";
  jsonData += "\"h2s\":" + String(h2s_ppm, 2) + ",";
  jsonData += "\"timestamp\":" + String(millis());
  jsonData += "}";

  // Make HTTP POST request
  Serial.println("POST " + String(endpoint));
  Serial.println("Host: " + String(server));
  Serial.println("Content-Type: application/json");
  Serial.println(jsonData);

  client.beginRequest();
  client.post(endpoint);
  client.sendHeader("Content-Type", "application/json");
  client.sendHeader("Content-Length", jsonData.length());
  client.endRequest();
  client.print(jsonData);

  // Read response
  int statusCode = client.responseStatusCode();
  String response = client.responseBody();

  Serial.print("Status: ");
  Serial.println(statusCode);
  Serial.println("Response: " + response);

  if (statusCode == 200 || statusCode == 201) {
    Serial.println("Data pushed successfully!");
  } else {
    Serial.println("Failed to push data");
  }
}

// ====== Sensor Reading Functions ======

float readSEN0565(int pin) {
  // DFRobot Gravity Analog Methane Sensor (SEN0565)
  // Output: 0-5V for 0-100% LEL
  // LEL (Lower Explosive Limit) for methane is ~5% in air
  int raw = analogRead(pin);
  float voltage = (raw / 1023.0) * 5.0;

  // Linear conversion: 5V = 100% LEL
  float lel = (voltage / 5.0) * 100.0;

  if (lel < 0) lel = 0;
  if (lel > 100) lel = 100;

  return lel;
}

float readSensor(int pin, float ro, float a, float b) {
  int raw = analogRead(pin);
  float voltage = (raw / 1023.0) * 5.0;

  float rl = 10000.0;  // Load resistor (typically 10k)
  float rs = (rl * (5.0 - voltage)) / voltage;
  float ratio = rs / ro;
  float ppm = a * pow(ratio, b);

  if (ppm < 0) ppm = 0;

  return ppm;
}

float getSensorResistance(int pin) {
  int raw = analogRead(pin);
  float voltage = (raw / 1023.0) * 5.0;
  float rl = 10000.0;
  return (rl * (5.0 - voltage)) / voltage;
}

// ====== Calibration Function ======

void calibrateSensors() {
  display.clearDisplay();
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.println("Calibrating...");
  display.println("Keep in clean");
  display.println("air for 60s");
  display.display();

  Serial.println("Calibration: Reading in clean air (60s)...");

  float sum_mq4 = 0, sum_h2 = 0, sum_co = 0, sum_nh3 = 0, sum_h2s = 0;
  int samples = 60;

  for (int i = 0; i < samples; i++) {
    sum_mq4 += getSensorResistance(MQ4_PIN);
    sum_h2 += getSensorResistance(H2_PIN);
    sum_co += getSensorResistance(CO_PIN);
    sum_nh3 += getSensorResistance(NH3_PIN);
    sum_h2s += getSensorResistance(H2S_PIN);

    delay(1000);
    Serial.print(".");
  }

  mq4_ro = sum_mq4 / samples;
  h2_ro = sum_h2 / samples;
  co_ro = sum_co / samples;
  nh3_ro = sum_nh3 / samples;
  h2s_ro = sum_h2s / samples;

  Serial.println("\nCalibration complete!");
  Serial.print("MQ4_RO: "); Serial.println(mq4_ro);
  Serial.print("H2_RO: "); Serial.println(h2_ro);
  Serial.print("CO_RO: "); Serial.println(co_ro);
  Serial.print("NH3_RO: "); Serial.println(nh3_ro);
  Serial.print("H2S_RO: "); Serial.println(h2s_ro);
}

// ====== Display Functions ======

void updateDisplay() {
  static unsigned long lastModeChange = 0;
  unsigned long now = millis();

  if (now - lastModeChange > 2000) {
    lastModeChange = now;
    displayMode = (displayMode + 1) % 3;
  }

  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(BLACK);
  display.setCursor(0, 0);

  // Display WiFi status indicator
  if (wifiConnected) {
    display.println("WiFi:[OK]");
  } else {
    display.println("WiFi:[NO]");
  }

  if (displayMode == 0) {
    // Page 1: Both CH4 sensors
    display.println("SEN0565:");
    display.print(sen0565_lel, 1);
    display.println("% LEL");

    display.println("MQ4:");
    display.print(mq4_ppm, 1);
    display.println("ppm");
  }
  else if (displayMode == 1) {
    // Page 2: H2, CO, NH3
    display.println("H2:");
    display.print(h2_ppm, 1);
    display.println("ppm");

    display.println("CO:");
    display.print(co_ppm, 1);
    display.println("ppm");

    display.println("NH3:");
    display.print(nh3_ppm, 1);
    display.println("ppm");
  }
  else {
    // Page 3: H2S & Summary
    display.println("H2S:");
    display.print(h2s_ppm, 1);
    display.println("ppm");

    display.println("");
    display.println("Pushing data...");
  }

  display.display();
}

void printSerialData() {
  Serial.print(sen0565_lel, 1);
  Serial.print(" | ");
  Serial.print(mq4_ppm, 1);
  Serial.print(" | ");
  Serial.print(h2_ppm, 1);
  Serial.print(" | ");
  Serial.print(co_ppm, 1);
  Serial.print(" | ");
  Serial.print(nh3_ppm, 1);
  Serial.print(" | ");
  Serial.println(h2s_ppm, 1);
}
