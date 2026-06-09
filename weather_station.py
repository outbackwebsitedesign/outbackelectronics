#!/usr/bin/env python3
"""
Outback Electronics Weather Station — Raspberry Pi sensor reader.

Reads whatever sensors are available and POSTs to the weather API every 30s.
Auto-scans the I2C bus to find sensors at any address. Supports both
Pimoroni and Adafruit libraries. Gracefully skips anything missing.

Install (only install libraries for sensors you have):
  sudo apt install -y python3-pip i2c-tools
  pip3 install --break-system-packages requests adafruit-blinka

  # SEN0322 O2 sensor:
  sudo apt install -y python3-smbus
  git clone https://github.com/DFRobot/DFRobot_OxygenSensor.git ~/DFRobot_OxygenSensor
  pip3 install --break-system-packages adafruit-circuitpython-bme680       # BME680
  pip3 install --break-system-packages adafruit-circuitpython-scd4x         # SCD41
  pip3 install --break-system-packages adafruit-circuitpython-ads1x15       # ADS1115
  pip3 install --break-system-packages adafruit-circuitpython-ds3231        # DS3231 RTC
  pip3 install --break-system-packages adafruit-circuitpython-mmc56x3       # MMC5603

Enable I2C:
  sudo raspi-config → Interface Options → I2C → Enable
  sudo reboot

Main server usage (auto-detects, reads .env):
  python3 weather_station.py

Remote station usage:
  export WEATHER_API_KEY="your-secret-key"
  export WEATHER_URL="https://weather.outbackelectronics.com.au"
  export STATION_ID="station-01"
  python3 weather_station.py
"""

import os
import sys
import time
import math
import logging
import requests

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
)
log = logging.getLogger('weather')

APP_DIR = os.path.dirname(os.path.abspath(__file__))

# ── Config ────────────────────────────────────────────────────────────────────

def read_env_file(path):
    vals = {}
    try:
        with open(path, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    k, v = line.split('=', 1)
                    vals[k.strip()] = v.strip()
    except FileNotFoundError:
        pass
    return vals


IS_MAIN_SERVER = os.path.exists(os.path.join(APP_DIR, 'server.js'))

if IS_MAIN_SERVER:
    env = read_env_file(os.path.join(APP_DIR, '.env'))
    API_URL = 'http://localhost:' + env.get('WEATHER_PORT', os.environ.get('WEATHER_PORT', '8089'))
    API_KEY = env.get('WEATHER_API_KEY', os.environ.get('WEATHER_API_KEY', ''))
    STATION_ID = 'hq'
    if not API_KEY:
        log.error('WEATHER_API_KEY not found in .env — run deploy.sh to generate it')
        sys.exit(1)
else:
    API_URL = os.environ.get('WEATHER_URL', 'https://weather.outbackelectronics.com.au')
    API_KEY = os.environ.get('WEATHER_API_KEY', '')
    STATION_ID = os.environ.get('STATION_ID', '')
    if not STATION_ID:
        log.error('STATION_ID env var is required on remote stations')
        sys.exit(1)
    if not API_KEY:
        log.error('WEATHER_API_KEY env var is required on remote stations')
        sys.exit(1)

INTERVAL = int(os.environ.get('WEATHER_INTERVAL', '30'))

# ── I2C bus init & scan ───────────────────────────────────────────────────────

i2c = None
detected_addresses = set()

try:
    import board
    import busio
    i2c = busio.I2C(board.SCL, board.SDA)
    log.info('I2C bus initialised')
except Exception as e:
    log.warning('I2C bus not available: %s — I2C sensors will be skipped', e)

def scan_i2c():
    addrs = set()
    if i2c:
        try:
            while not i2c.try_lock():
                pass
            addrs = set(i2c.scan())
            i2c.unlock()
        except Exception:
            try:
                i2c.unlock()
            except:
                pass
    return addrs


detected_addresses = scan_i2c()
if detected_addresses:
    log.info('I2C devices found at: %s', ', '.join(f'0x{a:02x}' for a in sorted(detected_addresses)))
else:
    log.warning('No I2C devices detected')


# ── Sensor init (auto-detect addresses) ──────────────────────────────────────

# BME680 can be at 0x76 or 0x77
BME680_ADDRESSES = [0x76, 0x77]
bme680_sensor = None

if i2c:
    for addr in BME680_ADDRESSES:
        if addr not in detected_addresses:
            continue
        try:
            import adafruit_bme680
            bme680_sensor = adafruit_bme680.Adafruit_BME680_I2C(i2c, address=addr)
            bme680_sensor.sea_level_pressure = 1013.25
            log.info('BME680 ready at 0x%02x', addr)
            break
        except Exception:
            pass

if not bme680_sensor:
    log.warning('BME680 not found at any address')

# SCD41 is always 0x62
scd4x = None
if i2c and 0x62 in detected_addresses:
    try:
        import adafruit_scd4x
        scd4x = adafruit_scd4x.SCD4X(i2c, address=0x62)
        scd4x.start_periodic_measurement()
        log.info('SCD41 ready at 0x62')
    except Exception as e:
        log.warning('SCD41 init failed: %s', e)
elif 0x62 not in detected_addresses:
    log.warning('SCD41 not detected on bus')

# DS3231 can be at 0x68 (also 0x57 for EEPROM on some boards)
DS3231_ADDRESSES = [0x68]
rtc = None
for addr in DS3231_ADDRESSES:
    if addr not in detected_addresses:
        continue
    if i2c:
        try:
            import adafruit_ds3231
            rtc = adafruit_ds3231.DS3231(i2c)
            log.info('DS3231 ready at 0x%02x', addr)
            break
        except Exception as e:
            log.warning('DS3231 init failed at 0x%02x: %s', addr, e)

if not rtc:
    log.warning('DS3231 not found')

# MMC5603 can be at 0x30
MMC5603_ADDRESSES = [0x30]
mag = None
if i2c:
    import time as _time
    _time.sleep(0.2)
    for addr in MMC5603_ADDRESSES:
        if addr not in detected_addresses:
            continue
        try:
            import adafruit_mmc56x3
            mag = adafruit_mmc56x3.MMC5603(i2c)
            _time.sleep(0.1)
            x, y, z = mag.magnetic
            if x == y == z:
                log.warning('MMC5603 at 0x%02x returned identical values (%.1f) — may need recalibration', addr, x)
            log.info('MMC5603 ready at 0x%02x (test: x=%.1f y=%.1f z=%.1f µT)', addr, x, y, z)
            break
        except Exception as e:
            mag = None
            log.warning('MMC5603 init failed at 0x%02x: %s', addr, e)

if not mag:
    log.warning('MMC5603 not found')

# SEN0322 O2 sensor — uses DFRobot's own library
# Install: git clone https://github.com/DFRobot/DFRobot_OxygenSensor.git ~/DFRobot_OxygenSensor
# Known I2C address constants: ADDRESS_0=0x70, ADDRESS_1=0x71, ADDRESS_2=0x72, ADDRESS_3=0x73
import glob as _glob
for _dfr_path in _glob.glob(os.path.expanduser('~/**/DFRobot_OxygenSensor/python/raspberrypi'), recursive=False):
    if _dfr_path not in sys.path:
        sys.path.insert(0, _dfr_path)
for _home in ['/home/daniel', '/home/pi', '/root', os.path.expanduser('~')]:
    _p = os.path.join(_home, 'DFRobot_OxygenSensor/python/raspberrypi')
    if os.path.isdir(_p) and _p not in sys.path:
        sys.path.insert(0, _p)
SEN0322_ADDRESSES = [0x73, 0x72, 0x71, 0x70]
o2_sensor = None
sen0322_ok = False

try:
    from DFRobot_Oxygen import DFRobot_Oxygen_IIC
    for addr_idx, addr in enumerate(SEN0322_ADDRESSES):
        if addr not in detected_addresses:
            continue
        try:
            o2_sensor = DFRobot_Oxygen_IIC(1, addr_idx)
            val = o2_sensor.get_oxygen_data(10)
            if val > 0:
                sen0322_ok = True
                log.info('SEN0322 O2 ready at 0x%02x (%.1f%%Vol)', addr, val)
                break
            else:
                o2_sensor = None
        except Exception as e:
            o2_sensor = None
            log.warning('SEN0322 probe failed at 0x%02x: %s', addr, e)
except ImportError:
    log.warning('DFRobot_Oxygen not installed — SEN0322 O2 sensor will be skipped')

if not sen0322_ok:
    log.warning('SEN0322 O2 not found')


def read_sen0322():
    if not o2_sensor:
        return None
    try:
        return round(o2_sensor.get_oxygen_data(10), 1)
    except Exception as e:
        log.warning('SEN0322 read error: %s', e)
        return None


# ADS1115 — can be at 0x48, 0x49, 0x4A, 0x4B depending on ADDR pin
ADS = None
AnalogIn = None
try:
    import adafruit_ads1x15.ads1115 as _ADS
    from adafruit_ads1x15.analog_in import AnalogIn as _AnalogIn
    ADS = _ADS
    AnalogIn = _AnalogIn
except ImportError:
    log.warning('adafruit_ads1x15 not installed — analog sensors will be skipped')

ADS1115_ADDRESSES = [0x48, 0x49, 0x4A, 0x4B]
ads_devices = []
analog_channels = {}

if ADS and i2c:
    for addr in ADS1115_ADDRESSES:
        if addr not in detected_addresses:
            continue
        try:
            dev = ADS.ADS1115(i2c, address=addr, gain=1)
            ads_devices.append((addr, dev))
            log.info('ADS1115 ready at 0x%02x', addr)
        except Exception as e:
            log.warning('ADS1115 init failed at 0x%02x: %s', addr, e)

    # Map channels across found ADS1115 devices
    # First ADS: NH3, H2, CH4, CO on channels 0-3
    # Second ADS: H2S, MQ-4 on channels 0-1
    CHANNEL_MAP_1 = [
        ('sen0567_nh3', 0), ('sen0572_h2', 1),
        ('sen0565_ch4', 2), ('sen0564_co', 3),
    ]
    CHANNEL_MAP_2 = [
        ('sen0568_h2s', 0), ('mq4_combustible', 1),
    ]

    if len(ads_devices) >= 1:
        _, dev = ads_devices[0]
        pins = [ADS.P0, ADS.P1, ADS.P2, ADS.P3]
        for key, ch in CHANNEL_MAP_1:
            try:
                analog_channels[key] = AnalogIn(dev, pins[ch])
            except Exception:
                pass
        log.info('ADS1115 #1 channels: %s', ', '.join(k for k, _ in CHANNEL_MAP_1 if k in analog_channels))

    if len(ads_devices) >= 2:
        _, dev = ads_devices[1]
        pins = [ADS.P0, ADS.P1, ADS.P2, ADS.P3]
        for key, ch in CHANNEL_MAP_2:
            try:
                analog_channels[key] = AnalogIn(dev, pins[ch])
            except Exception:
                pass
        log.info('ADS1115 #2 channels: %s', ', '.join(k for k, _ in CHANNEL_MAP_2 if k in analog_channels))


# ── Analog → ppm conversion ──────────────────────────────────────────────────

ANALOG_RANGES = {
    'sen0567_nh3': (0.4, 2.0, 1, 300),
    'sen0572_h2':  (0.4, 2.0, 0.1, 1000),
    'sen0565_ch4': (0.4, 2.0, 1, 10000),
    'sen0564_co':  (0.4, 2.0, 5, 5000),
    'sen0568_h2s': (0.4, 2.0, 0.5, 50),
}


def voltage_to_ppm(key, voltage):
    if key == 'mq4_combustible':
        if voltage < 0.1:
            return None
        return round(max(0, (5.0 - voltage) / max(voltage, 0.01) * 200), 1)

    if key not in ANALOG_RANGES:
        return None
    v_min, v_max, ppm_min, ppm_max = ANALOG_RANGES[key]
    if voltage < v_min:
        return ppm_min
    if voltage > v_max:
        return ppm_max
    frac = (voltage - v_min) / (v_max - v_min)
    return round(ppm_min + frac * (ppm_max - ppm_min), 2)


# ── Main read cycle ───────────────────────────────────────────────────────────

def read_all():
    raw = {}

    if bme680_sensor:
        try:
            raw['bme680_temp'] = round(bme680_sensor.temperature, 2)
            raw['bme680_humidity'] = round(bme680_sensor.relative_humidity, 2)
            raw['bme680_pressure'] = round(bme680_sensor.pressure, 2)
            raw['bme680_gas'] = round(bme680_sensor.gas / 1000.0, 2)
        except Exception as e:
            log.warning('BME680 read error: %s', e)

    if scd4x:
        try:
            if scd4x.data_ready:
                raw['scd41_co2'] = scd4x.CO2
                raw['scd41_temp'] = round(scd4x.temperature, 2)
                raw['scd41_humidity'] = round(scd4x.relative_humidity, 2)
        except Exception as e:
            log.warning('SCD41 read error: %s', e)

    if sen0322_ok:
        o2 = read_sen0322()
        if o2 is not None:
            raw['sen0322_o2'] = round(o2, 2)

    if mag:
        try:
            x, y, z = mag.magnetic
            raw['mmc5603_x'] = round(x, 2)
            raw['mmc5603_y'] = round(y, 2)
            raw['mmc5603_z'] = round(z, 2)
            heading = math.degrees(math.atan2(y, x))
            if heading < 0:
                heading += 360
            raw['mmc5603_heading'] = round(heading, 1)
        except Exception as e:
            log.warning('MMC5603 read error: %s', e)

    for key, chan in analog_channels.items():
        try:
            voltage = chan.voltage
            ppm = voltage_to_ppm(key, voltage)
            if ppm is not None:
                raw[key] = ppm
        except Exception as e:
            log.warning('%s read error: %s', key, e)

    # Fuse into clean readings — average where multiple sensors measure the same thing
    data = {}

    temps = [v for k, v in raw.items() if k in ('bme680_temp', 'scd41_temp')]
    if temps:
        data['temperature'] = round(sum(temps) / len(temps), 1)

    humids = [v for k, v in raw.items() if k in ('bme680_humidity', 'scd41_humidity')]
    if humids:
        data['humidity'] = round(sum(humids) / len(humids), 1)

    if 'bme680_pressure' in raw:
        data['pressure'] = raw['bme680_pressure']

    if 'bme680_gas' in raw:
        data['voc'] = raw['bme680_gas']

    if 'scd41_co2' in raw:
        data['co2'] = raw['scd41_co2']

    if 'sen0322_o2' in raw:
        data['o2'] = raw['sen0322_o2']

    if 'sen0567_nh3' in raw:
        data['nh3'] = raw['sen0567_nh3']
    if 'sen0572_h2' in raw:
        data['h2'] = raw['sen0572_h2']
    if 'sen0565_ch4' in raw:
        data['ch4'] = raw['sen0565_ch4']
    if 'sen0564_co' in raw:
        data['co'] = raw['sen0564_co']
    if 'sen0568_h2s' in raw:
        data['h2s'] = raw['sen0568_h2s']
    if 'mq4_combustible' in raw:
        data['combustible'] = raw['mq4_combustible']

    if 'mmc5603_heading' in raw:
        data['compass'] = raw['mmc5603_heading']
    if 'mmc5603_x' in raw:
        data['mag_x'] = raw['mmc5603_x']
    if 'mmc5603_y' in raw:
        data['mag_y'] = raw['mmc5603_y']
    if 'mmc5603_z' in raw:
        data['mag_z'] = raw['mmc5603_z']

    rtc_time = None
    if rtc:
        try:
            t = rtc.datetime
            rtc_time = '{:04d}-{:02d}-{:02d}T{:02d}:{:02d}:{:02d}'.format(
                t.tm_year, t.tm_mon, t.tm_mday, t.tm_hour, t.tm_min, t.tm_sec
            )
        except Exception as e:
            log.warning('DS3231 read error: %s', e)

    return data, rtc_time


def post_reading(data, rtc_time):
    payload = {
        'station_id': STATION_ID,
        'rtc_time': rtc_time,
        'data': data,
    }
    try:
        r = requests.post(
            f'{API_URL}/api/weather/readings',
            json=payload,
            headers={'X-Api-Key': API_KEY},
            timeout=10,
        )
        if r.status_code == 200:
            log.info('[%s] Posted %d sensor values', STATION_ID, len(data))
        else:
            log.warning('POST returned %d: %s', r.status_code, r.text[:200])
    except Exception as e:
        log.warning('POST failed: %s', e)


def main():
    log.info('Station "%s" starting — posting to %s every %ds', STATION_ID, API_URL, INTERVAL)

    if scd4x:
        log.info('Waiting 5s for SCD41 first measurement...')
        time.sleep(5)

    while True:
        try:
            data, rtc_time = read_all()
            post_reading(data, rtc_time)
            if not data:
                log.warning('No sensor data collected — posted empty reading')
        except Exception as e:
            log.error('Unexpected error: %s', e)
        time.sleep(INTERVAL)


if __name__ == '__main__':
    main()
