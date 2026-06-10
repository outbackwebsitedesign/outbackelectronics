# Gas Sensor Monitor for Arduino Uno R4 WiFi

Real-time environmental gas monitoring with WiFi data push to weather.outbackelectronics.com.au

## Hardware

- **Arduino Uno R4 WiFi**
- **Nokia 5110 LCD Display** (84x48 pixels)
- **SEN0565** (DFRobot Gravity Analog Methane Sensor)
- **MQ-4** (MQ-Series Methane Sensor) - **ONLY MQ-series sensor**
- **DFRobot Fermion H2** (Hydrogen Sensor)
- **DFRobot Fermion CO** (Carbon Monoxide Sensor)
- **DFRobot Fermion NH3** (Ammonia Sensor)
- **DFRobot Fermion H2S** (Hydrogen Sulfide Sensor)
- **Resistor**: One 10kΩ pull-up resistor (for MQ-4 only)

## Wiring

### LCD (Nokia 5110)
| LCD Pin | Arduino Pin |
|---------|------------|
| CLK | D7 |
| DIN | D6 |
| DC | D5 |
| CE | D4 |
| RST | D3 |
| VCC | 5V |
| GND | GND |

### Gas Sensors
| Sensor | Arduino Pin | Type | Notes |
|--------|------------|------|-------|
| SEN0565 (0-100% LEL) | A0 | DFRobot Gravity | Direct analog output, no calibration needed |
| MQ-4 | A1 | MQ-Series | Requires 10kΩ load resistor, needs calibration |
| H2 | A2 | DFRobot Fermion | Direct analog output, pre-calibrated |
| CO | A3 | DFRobot Fermion | Direct analog output, pre-calibrated |
| NH3 | A4 | DFRobot Fermion | Direct analog output, pre-calibrated |
| H2S | A5 | DFRobot Fermion | Direct analog output, pre-calibrated |

**MQ-4 only**: Connect 10kΩ load resistor between sensor output and GND
**All sensors**: VCC → 5V, GND → GND

**DFRobot Fermion sensors** come pre-calibrated with factory voltage-to-PPM curves. Adjust multipliers in `readFermion()` based on your specific sensor datasheets.

## Installation

1. Install required Arduino libraries:
   - **Adafruit PCD8544 Nokia 5110 LCD library**
   - **WiFiS3** (built-in for Uno R4)
   - **ArduinoHttpClient**

2. In Arduino IDE:
   - `Sketch > Include Library > Manage Libraries`
   - Search and install "Adafruit PCD8544"
   - Search and install "ArduinoHttpClient"

3. Edit WiFi credentials and API settings at the top of the sketch:
   ```cpp
   const char* ssid = "YOUR_SSID";
   const char* password = "YOUR_PASSWORD";
   const char* api_key = "YOUR_API_KEY";       // Register via /api/weather/register to get key
   const char* station_id = "UNO_R4_WIFI_001"; // Unique ID (e.g., location: garden, shed, etc.)
   ```

### Getting an API Key

If you don't have an API key yet, you can register one:

```bash
curl -X POST http://weather.outbackelectronics.com.au:8089/api/weather/register \
  -H "Content-Type: application/json" \
  -d '{"name": "My Arduino Sensor"}'
```

The response will include your `apiKey` and `weatherUrl`.

## Configuration

### Weather Service Details
- **Server**: `weather.outbackelectronics.com.au:8089`
- **Endpoint**: `/api/weather/readings` (POST)
- **Authentication**: API key sent via `x-api-key` header

### API Key & Station ID
- **api_key**: Authentication key from weather service (sent in `x-api-key` header)
  - Get by registering at `/api/weather/register`
- **station_id**: Unique identifier for this sensor/location
  - Examples: `UNO_R4_WIFI_001`, `backyard`, `workshop`, `greenhouse`
  - Identifies which station the readings come from

### Sensor Notes

**SEN0565 (DFRobot Gravity Methane)**
- Outputs 0-5V for 0-100% LEL (Lower Explosive Limit)
- LEL ≈ 5% methane in air (flammability threshold)
- Pre-calibrated, no setup needed

**MQ-4 (MQ-Series Methane)**
- Resistive sensor requiring calibration
- Independent from SEN0565
- Measures absolute PPM (parts per million)
- Requires 10kΩ load resistor

**DFRobot Fermion Sensors (H2, CO, NH3, H2S)**
- Pre-calibrated with factory voltage-to-PPM curves
- Direct analog output (0-5V)
- No calibration needed
- Adjust multipliers in `readFermion()` if needed based on datasheets

### MQ-4 Calibration
On first run, uncomment the calibration line in `setup()`:
```cpp
// calibrateMQ4();
```

Keep **MQ-4 only** in clean air for 60 seconds while calibration runs. This measures the R0 baseline resistance for accurate PPM calculations.

After calibration completes, comment it back out. DFRobot Fermion sensors and SEN0565 do not require calibration.

### Push Interval
Edit the push interval (default 30 seconds):
```cpp
const unsigned long PUSH_INTERVAL = 30000; // milliseconds
```

### API Endpoint
Modify the endpoint if needed:
```cpp
const char* endpoint = "/api/sensors";
```

## Features

- **Real-time monitoring**: Reads all 5 gas sensors every 1 second
- **WiFi connectivity**: Auto-reconnect on disconnection
- **Data pushing**: Sends readings to weather service every 30 seconds
- **LCD display**: Scrolls through sensor readings, WiFi status
- **Serial output**: Real-time data to Serial Monitor for debugging
- **Calibration**: One-time sensor calibration in clean air

## Data Sent to Server

**Endpoint:** POST to `http://weather.outbackelectronics.com.au:8089/api/weather/readings`

**Headers:**
- `Content-Type: application/json`
- `x-api-key: YOUR_API_KEY`

**JSON payload:**
```json
{
  "station_id": "UNO_R4_WIFI_001",
  "sensors": ["SEN0565", "MQ4", "H2", "CO", "NH3", "H2S"],
  "data": {
    "sen0565_lel": 25.5,
    "mq4_ppm": 45.23,
    "h2_ppm": 120.45,
    "co_ppm": 8.67,
    "nh3_ppm": 12.34,
    "h2s_ppm": 5.67
  }
}
```

**Fields:**
- `station_id`: Unique identifier for this sensor/location
- `sensors`: Array of sensor names being reported
- `data`: Object containing sensor readings with their values

## Troubleshooting

**WiFi not connecting:**
- Verify SSID and password
- Check WiFi signal strength near Arduino
- Restart the Arduino

**LCD not displaying:**
- Check contrast value (default 50, range 0-127)
- Verify pin connections
- Reset Arduino

**Sensor readings are 0 or unrealistic:**
- For **MQ-4**: Calibrate in clean air
- For **DFRobot Fermion**: Verify voltage-to-PPM multipliers in `readFermion()` match datasheets
- For **SEN0565**: Check voltage output with multimeter
- Check all sensor wiring
- Verify 10kΩ load resistor on MQ-4 is properly connected

**DFRobot Fermion sensors showing wrong PPM values:**
- The default multipliers in `readFermion()` are estimates
- Check your sensor datasheets for exact voltage-to-PPM curves
- Adjust the multipliers accordingly:
  ```cpp
  ppm = voltage * YOUR_MULTIPLIER;  // e.g., voltage * 1000 for H2
  ```

**HTTP push failing:**
- Check WiFi connection
- Verify endpoint URL
- Check server is responding

## Serial Monitor Output

```
=== Gas Sensor Monitor for Uno R4 WiFi ===
Sensors: SEN0565, MQ-4, DFRobot Fermion (H2/CO/NH3/H2S)
Connecting to WiFi: YOUR_SSID
WiFi connected!
IP address: 192.168.1.100

SEN0565(%LEL) | MQ4(ppm) | H2(ppm) | CO(ppm) | NH3(ppm) | H2S(ppm)
25.5 | 45.23 | 120.45 | 8.67 | 12.34 | 5.67
25.6 | 45.18 | 120.52 | 8.65 | 12.35 | 5.68

Pushing data to weather service...
POST /api/sensors
Status: 200
Data pushed successfully!
```

## License

Part of Outback Electronics weather monitoring system.
