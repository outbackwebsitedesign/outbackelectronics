#!/usr/bin/env python3
"""
Outback Electronics Weather Station — Raspberry Pi sensor reader.

Reads whatever sensors are available and POSTs to the weather API every 30s.
Gracefully skips any sensor that isn't connected or whose library is missing.

I2C devices:
  BME680       0x76  — temp, humidity, pressure, VOC gas resistance
  SCD41        0x62  — CO2, temp, humidity
  SEN0322      0x73  — electrochemical O2 (DFRobot Gravity I2C)
  MMC5603      0x30  — 3-axis magnetometer
  DS3231       0x68  — real-time clock

Analog via 2x ADS1115:
  ADS1115 #1   0x48  (ADDR pin → GND)
    A0: SEN0567 (NH3)    1–300 ppm
    A1: SEN0572 (H2)     0.1–1000 ppm
    A2: SEN0565 (CH4)    1–10000 ppm
    A3: SEN0564 (CO)     5–5000 ppm
  ADS1115 #2   0x49  (ADDR pin → VDD)
    A0: SEN0568 (H2S)    0.5–50 ppm
    A1: MQ-4             combustible gas

Wiring: all I2C on SDA (GPIO2) / SCL (GPIO3), 3.3V for digital sensors,
5V for MQ-4 heater. ADS1115 analog inputs wired to sensor AOUT pins.

Install (only install libraries for sensors you have):
  sudo apt install -y python3-pip i2c-tools
  pip3 install requests
  pip3 install adafruit-circuitpython-bme680       # if BME680 connected
  pip3 install adafruit-circuitpython-scd4x         # if SCD41 connected
  pip3 install adafruit-circuitpython-ads1x15       # if ADS1115 connected
  pip3 install adafruit-circuitpython-ds3231        # if DS3231 connected
  pip3 install adafruit-circuitpython-mmc56x3       # if MMC5603 connected

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

# ── I2C bus init ──────────────────────────────────────────────────────────────

i2c = None
try:
    import board
    import busio
    i2c = busio.I2C(board.SCL, board.SDA)
    log.info('I2C bus initialised')
except Exception as e:
    log.warning('I2C bus not available: %s — I2C sensors will be skipped', e)

# ── Sensor init ───────────────────────────────────────────────────────────────

bme680 = None
if i2c:
    try:
        import adafruit_bme680
        bme680 = adafruit_bme680.Adafruit_BME680_I2C(i2c, address=0x76)
        bme680.sea_level_pressure = 1013.25
        log.info('BME680 ready at 0x76')
    except Exception as e:
        log.warning('BME680 init failed: %s', e)

scd4x = None
if i2c:
    try:
        import adafruit_scd4x
        scd4x = adafruit_scd4x.SCD4X(i2c, address=0x62)
        scd4x.start_periodic_measurement()
        log.info('SCD41 ready at 0x62 — first reading in ~5s')
    except Exception as e:
        log.warning('SCD41 init failed: %s', e)

rtc = None
if i2c:
    try:
        import adafruit_ds3231
        rtc = adafruit_ds3231.DS3231(i2c)
        log.info('DS3231 ready at 0x68')
    except Exception as e:
        log.warning('DS3231 init failed: %s', e)

mag = None
if i2c:
    try:
        import adafruit_mmc56x3
        mag = adafruit_mmc56x3.MMC5603(i2c)
        log.info('MMC5603 ready at 0x30')
    except Exception as e:
        log.warning('MMC5603 init failed: %s', e)

SEN0322_ADDR = 0x73
sen0322_ok = False
if i2c:
    try:
        while not i2c.try_lock():
            pass
        i2c.writeto(SEN0322_ADDR, bytes([0x03]))
        buf = bytearray(3)
        i2c.readfrom_into(SEN0322_ADDR, buf)
        i2c.unlock()
        sen0322_ok = True
        log.info('SEN0322 O2 ready at 0x73')
    except Exception as e:
        try:
            i2c.unlock()
        except:
            pass
        log.warning('SEN0322 init failed: %s', e)


def read_sen0322():
    if not i2c:
        return None
    try:
        while not i2c.try_lock():
            pass
        i2c.writeto(SEN0322_ADDR, bytes([0x03]))
        buf = bytearray(3)
        i2c.readfrom_into(SEN0322_ADDR, buf)
        i2c.unlock()
        return ((buf[0] << 8) | buf[1]) / 10.0
    except Exception as e:
        try:
            i2c.unlock()
        except:
            pass
        log.warning('SEN0322 read error: %s', e)
        return None


# ADS1115 x2 for analog sensors
ADS = None
AnalogIn = None
try:
    import adafruit_ads1x15.ads1115 as _ADS
    from adafruit_ads1x15.analog_in import AnalogIn as _AnalogIn
    ADS = _ADS
    AnalogIn = _AnalogIn
except ImportError:
    log.warning('adafruit_ads1x15 not installed — analog sensors will be skipped')

ads1 = None
ads2 = None
analog_channels = {}

if ADS and i2c:
    try:
        ads1 = ADS.ADS1115(i2c, address=0x48, gain=1)
        analog_channels['sen0567_nh3'] = AnalogIn(ads1, ADS.P0)
        analog_channels['sen0572_h2']  = AnalogIn(ads1, ADS.P1)
        analog_channels['sen0565_ch4'] = AnalogIn(ads1, ADS.P2)
        analog_channels['sen0564_co']  = AnalogIn(ads1, ADS.P3)
        log.info('ADS1115 #1 ready at 0x48 (NH3, H2, CH4, CO)')
    except Exception as e:
        log.warning('ADS1115 #1 init failed: %s', e)

    try:
        ads2 = ADS.ADS1115(i2c, address=0x49, gain=1)
        analog_channels['sen0568_h2s']    = AnalogIn(ads2, ADS.P0)
        analog_channels['mq4_combustible'] = AnalogIn(ads2, ADS.P1)
        log.info('ADS1115 #2 ready at 0x49 (H2S, MQ-4)')
    except Exception as e:
        log.warning('ADS1115 #2 init failed: %s', e)


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
    data = {}

    if bme680:
        try:
            data['bme680_temp'] = round(bme680.temperature, 2)
            data['bme680_humidity'] = round(bme680.relative_humidity, 2)
            data['bme680_pressure'] = round(bme680.pressure, 2)
            data['bme680_gas'] = round(bme680.gas / 1000.0, 2)
        except Exception as e:
            log.warning('BME680 read error: %s', e)

    if scd4x:
        try:
            if scd4x.data_ready:
                data['scd41_co2'] = scd4x.CO2
                data['scd41_temp'] = round(scd4x.temperature, 2)
                data['scd41_humidity'] = round(scd4x.relative_humidity, 2)
        except Exception as e:
            log.warning('SCD41 read error: %s', e)

    if sen0322_ok:
        o2 = read_sen0322()
        if o2 is not None:
            data['sen0322_o2'] = round(o2, 2)

    if mag:
        try:
            x, y, z = mag.magnetic
            data['mmc5603_x'] = round(x, 2)
            data['mmc5603_y'] = round(y, 2)
            data['mmc5603_z'] = round(z, 2)
            heading = math.degrees(math.atan2(y, x))
            if heading < 0:
                heading += 360
            data['mmc5603_heading'] = round(heading, 1)
        except Exception as e:
            log.warning('MMC5603 read error: %s', e)

    for key, chan in analog_channels.items():
        try:
            voltage = chan.voltage
            ppm = voltage_to_ppm(key, voltage)
            if ppm is not None:
                data[key] = ppm
        except Exception as e:
            log.warning('%s read error: %s', key, e)

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
