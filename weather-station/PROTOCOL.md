# Outback Electronics Weather Station — API Protocol

This document describes exactly what to send to push sensor data to the
weather dashboard. You can write your own client in any language — Python,
C/C++ (Arduino), MicroPython, Rust, Node.js, curl, anything that can make
an HTTP POST request.

---

## Step 1 — Register a station

Before you can push data you need an API key. Register at:

**https://weather.outbackelectronics.com.au**

Click **+ Add Sensor**, enter a station name (e.g. `My Back Yard`), and copy
your API key. The key is a 64-character hex string and is shown only once.

Your station name is locked to that key — every reading you push will appear
on the dashboard under that name regardless of what your code sends in
`station_id`.

---

## Step 2 — Push a reading

### Endpoint

```
POST https://weather.outbackelectronics.com.au/api/weather/readings
```

### Required headers

| Header | Value |
|--------|-------|
| `Content-Type` | `application/json` |
| `X-Api-Key` | your 64-char API key |

### Request body (JSON)

```json
{
  "station_id": "My Back Yard",
  "sensors":   ["BME280", "DHT22"],
  "rtc_time":  "2025-06-09T14:32:00",
  "data": {
    "temperature":  22.4,
    "humidity":     61.0,
    "pressure":    1013.2,
    "wind_speed":   4.7
  }
}
```

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `station_id` | string | no | Ignored for registered stations (name is fixed by your API key). Useful for the built-in server station. Max 64 chars. |
| `sensors` | array of strings | no | List of sensor model names present on your hardware, e.g. `["BME280", "SCD41"]`. Shown in the dashboard station status. Max 32 entries, 64 chars each. |
| `rtc_time` | string | no | ISO-8601 local timestamp from a hardware RTC if you have one, e.g. `"2025-06-09T14:32:00"`. Max 32 chars. Omit if you don't have an RTC. |
| `data` | object | yes | Key/value pairs of sensor readings. Values must be numbers. See below. |

### `data` key rules

- Keys must match: **letters, digits, underscores, and dots only** — `/^[a-zA-Z0-9_.]{1,64}$/`
- Values must be **finite numbers** (integers or floats). Strings, booleans, null, and NaN are silently ignored.
- Maximum **64 keys** per reading. Additional keys are dropped.
- Key names are used as labels on the dashboard: underscores become spaces and each word is capitalised. `wind_speed` → **Wind Speed**, `soil_moisture` → **Soil Moisture**.

### Well-known keys (displayed with units)

These keys get special treatment — the dashboard knows their unit and groups them:

| Key | Label | Unit | Group |
|-----|-------|------|-------|
| `temperature` | Temperature | °C | Environment |
| `humidity` | Humidity | % | Environment |
| `pressure` | Pressure | hPa | Environment |
| `voc` | Air Quality (VOC) | kΩ | Environment |
| `co2` | CO₂ | ppm | Environment |
| `o2` | Oxygen | %Vol | Gas Detection |
| `nh3` | Ammonia | ppm | Gas Detection |
| `h2` | Hydrogen | ppm | Gas Detection |
| `ch4` | Methane | ppm | Gas Detection |
| `co` | Carbon Monoxide | ppm | Gas Detection |
| `h2s` | Hydrogen Sulfide | ppm | Gas Detection |
| `combustible` | Combustible Gas | ppm | Gas Detection |
| `compass` | Compass Heading | ° | Other |
| `mag_x` | Magnetic Field X | µT | Other |
| `mag_y` | Magnetic Field Y | µT | Other |
| `mag_z` | Magnetic Field Z | µT | Other |
| `battery_voltage` | Battery Voltage | V | Power |
| `battery_percent` | Battery Charge | % | Power |

Any key **not** in the table above appears in a **Custom Sensors** group with
the key name humanised as the label. You can send any key you like — there is
no restriction beyond the character and length rules above.

### Response

**Success:**
```json
HTTP 200
{ "ok": true }
```

**Errors:**

| Status | `error` value | Meaning |
|--------|---------------|---------|
| 401 | `invalid_api_key` | Key missing or wrong |
| 400 | `bad_request` | Body is not valid JSON or not an object |
| 429 | `rate_limited` | Too many requests from this IP |

---

## Examples

### curl

```bash
curl -X POST https://weather.outbackelectronics.com.au/api/weather/readings \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: YOUR_API_KEY" \
  -d '{
    "sensors": ["BME280"],
    "data": {
      "temperature": 24.1,
      "humidity": 58.3,
      "pressure": 1009.7
    }
  }'
```

### Python (requests)

```python
import requests

API_KEY = "your-api-key"
URL     = "https://weather.outbackelectronics.com.au/api/weather/readings"

payload = {
    "sensors": ["DHT22", "BMP280"],
    "data": {
        "temperature": 21.6,
        "humidity":    65.0,
        "pressure":    1012.4,
        "wind_speed":  3.2,
    }
}

r = requests.post(URL, json=payload, headers={"X-Api-Key": API_KEY}, timeout=10)
print(r.status_code, r.json())
```

### MicroPython (ESP8266 / ESP32 / Raspberry Pi Pico W)

```python
import urequests, ujson, network

# Connect WiFi first
wlan = network.WLAN(network.STA_IF)
wlan.active(True)
wlan.connect("ssid", "password")

API_KEY = "your-api-key"
URL     = "https://weather.outbackelectronics.com.au/api/weather/readings"

payload = ujson.dumps({
    "sensors": ["DHT22"],
    "data": {
        "temperature": 22.5,
        "humidity":    60.1,
    }
})

r = urequests.post(URL,
    data=payload,
    headers={"Content-Type": "application/json", "X-Api-Key": API_KEY}
)
print(r.status_code, r.text)
r.close()
```

### Arduino / ESP32 / ESP8266

See `arduino/OutbackWeatherStation.ino` in this folder for a full,
commented sketch. The minimal POST is:

```cpp
HTTPClient http;
http.begin(client, "https://weather.outbackelectronics.com.au/api/weather/readings");
http.addHeader("Content-Type", "application/json");
http.addHeader("X-Api-Key", "your-api-key");
int code = http.POST("{\"sensors\":[\"DHT22\"],\"data\":{\"temperature\":22.5,\"humidity\":60.1}}");
http.end();
```

### Node.js (fetch)

```js
await fetch('https://weather.outbackelectronics.com.au/api/weather/readings', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Api-Key': 'your-api-key',
  },
  body: JSON.stringify({
    sensors: ['SHT31'],
    data: { temperature: 23.1, humidity: 55.8 },
  }),
});
```

### Home Assistant REST sensor (push via automation)

```yaml
rest_command:
  push_weather:
    url: https://weather.outbackelectronics.com.au/api/weather/readings
    method: POST
    content_type: application/json
    headers:
      X-Api-Key: your-api-key
    payload: >
      {
        "sensors": ["Home Assistant"],
        "data": {
          "temperature": {{ states('sensor.outdoor_temp') | float }},
          "humidity":    {{ states('sensor.outdoor_humidity') | float }}
        }
      }
```

---

## Rate limits

The POST endpoint is not publicly documented but is rate-limited per IP.
Pushing once every 10–60 seconds is fine. Pushing faster than once per second
will trigger the rate limiter (HTTP 429).

## Notes

- The server timestamp (`ts`) is set server-side at time of receipt — you
  cannot override it. Use `rtc_time` if you want to record the device's local
  clock time alongside it.
- All readings are stored indefinitely. There is no rolling delete.
- Data is live on the dashboard within 1 second of receipt via Server-Sent
  Events — no polling needed on the browser side.
