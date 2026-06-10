# Gas Sensor Monitor for Arduino Uno R4 WiFi

Real-time environmental gas monitoring with WiFi data push to weather.outbackelectronics.com.au

## Hardware

- **Arduino Uno R4 WiFi**
- **Nokia 5110 LCD Display** (84x48 pixels)
- **MQ-4 Sensor** (CH4 Methane)
- **H2 Sensor** (Hydrogen)
- **CO Sensor** (Carbon Monoxide)
- **NH3 Sensor** (Ammonia)
- **H2S Sensor** (Hydrogen Sulfide)
- **Resistors**: Five 10kΩ pull-up resistors (one per gas sensor)

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
| Sensor | Arduino Pin |
|--------|------------|
| MQ-4 (CH4) | A0 |
| H2 | A1 |
| CO | A2 |
| NH3 | A3 |
| H2S | A4 |

All sensors: VCC → 5V, GND → GND

Use 10kΩ load resistor between sensor output and GND for each sensor.

## Installation

1. Install required Arduino libraries:
   - **Adafruit PCD8544 Nokia 5110 LCD library**
   - **WiFiS3** (built-in for Uno R4)
   - **ArduinoHttpClient**

2. In Arduino IDE:
   - `Sketch > Include Library > Manage Libraries`
   - Search and install "Adafruit PCD8544"
   - Search and install "ArduinoHttpClient"

3. Edit WiFi credentials in the sketch:
   ```cpp
   const char* ssid = "YOUR_SSID";
   const char* password = "YOUR_PASSWORD";
   ```

## Configuration

### Sensor Calibration
On first run, uncomment the calibration line in `setup()`:
```cpp
// calibrateSensors();
```

Keep sensors in clean air for 60 seconds while calibration runs. This measures the R0 baseline resistance for accurate PPM calculations.

After calibration completes, comment it back out.

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

JSON payload with all sensor readings:
```json
{
  "mq4": 45.23,
  "ch4": 45.23,
  "h2": 120.45,
  "co": 8.67,
  "nh3": 12.34,
  "h2s": 5.67,
  "timestamp": 1234567890
}
```

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
- Calibrate sensors in clean air
- Check sensor wiring
- Verify 10kΩ load resistors are properly connected

**HTTP push failing:**
- Check WiFi connection
- Verify endpoint URL
- Check server is responding

## Serial Monitor Output

```
MQ4(CH4) | H2 | CO | NH3 | H2S (ppm)
45.23 | 120.45 | 8.67 | 12.34 | 5.67
POST /api/sensors
Status: 200
Data pushed successfully!
```

## License

Part of Outback Electronics weather monitoring system.
