# Gas Sensor Monitor for Arduino Uno R4 WiFi

Real-time environmental gas monitoring with WiFi data push to weather.outbackelectronics.com.au

## Hardware

- **Arduino Uno R4 WiFi**
- **Nokia 5110 LCD Display** (84x48 pixels)
- **SEN0565** (DFRobot Gravity Analog Methane Sensor)
- **MQ-4 Sensor** (CH4 Methane)
- **H2 Sensor** (Hydrogen)
- **CO Sensor** (Carbon Monoxide)
- **NH3 Sensor** (Ammonia)
- **H2S Sensor** (Hydrogen Sulfide)
- **Resistors**: Five 10kΩ pull-up resistors (one per MQ-series gas sensor)

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
| Sensor | Arduino Pin | Notes |
|--------|------------|-------|
| SEN0565 (Methane 0-100% LEL) | A0 | DFRobot Gravity - Direct analog output |
| MQ-4 (CH4) | A1 | MQ-series - Requires 10kΩ load resistor |
| H2 | A2 | MQ-series - Requires 10kΩ load resistor |
| CO | A3 | MQ-series - Requires 10kΩ load resistor |
| NH3 | A4 | MQ-series - Requires 10kΩ load resistor |
| H2S | A5 | MQ-series - Requires 10kΩ load resistor |

**MQ-series sensors**: Connect 10kΩ load resistor between sensor output and GND
**All sensors**: VCC → 5V, GND → GND

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

### SEN0565 Notes
The **SEN0565 (DFRobot Gravity Analog Methane Sensor)** outputs 0-5V for 0-100% LEL (Lower Explosive Limit). LEL is the concentration at which a gas mixture becomes flammable. For methane in air, LEL is approximately 5%, so:
- 50% sensor output = 50% LEL ≈ 2.5% methane in air
- 100% sensor output = 100% LEL ≈ 5% methane in air

This sensor is **independent** from the **MQ-4**, which measures absolute PPM concentrations.

### Sensor Calibration
On first run, uncomment the calibration line in `setup()` **for MQ-series sensors only** (SEN0565 doesn't require calibration):
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
  "sen0565_lel": 25.5,
  "mq4_ppm": 45.23,
  "h2": 120.45,
  "co": 8.67,
  "nh3": 12.34,
  "h2s": 5.67,
  "timestamp": 1234567890
}
```

**Sensor Units:**
- `sen0565_lel`: 0-100% LEL (Lower Explosive Limit)
- `mq4_ppm`: Parts Per Million
- All others: Parts Per Million

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
SEN0565(%LEL) | MQ4(ppm) | H2 | CO | NH3 | H2S (ppm)
25.5 | 45.23 | 120.45 | 8.67 | 12.34 | 5.67
POST /api/sensors
Status: 200
Data pushed successfully!
```

## License

Part of Outback Electronics weather monitoring system.
