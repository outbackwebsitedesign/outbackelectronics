#!/usr/bin/env python3
"""
Standalone I2C bus scanner.

Usage:
    python3 weather-station/i2c_scan.py

Scans the I2C bus and prints a labelled table of every device found,
with known device names where recognised. Run this independently to
diagnose wiring without disturbing the weather-station service.
"""

# Well-known addresses used by sensors in this project (and common extras)
KNOWN = {
    0x28: 'BNO055 (alt)',
    0x29: 'BNO055 / VL53L0X / TCS34725',
    0x30: 'MMC5603 magnetometer',
    0x3c: 'SSD1306/SH1106 OLED display',
    0x3d: 'SSD1306 OLED (alt)',
    0x40: 'INA219 / HTU21D / PCA9685',
    0x44: 'SHT31',
    0x48: 'ADS1115 (ADDR=GND)',
    0x49: 'ADS1115 (ADDR=VDD)',
    0x4a: 'ADS1115 (ADDR=SDA)',
    0x4b: 'ADS1115 (ADDR=SCL)',
    0x57: 'DS3231 EEPROM / AT24C32',
    0x60: 'MPL3115A2',
    0x62: 'SCD41 CO₂',
    0x68: 'DS3231 RTC / MPU-6050',
    0x69: 'MPU-6050 (alt)',
    0x70: 'SEN0322 O₂ (ADDRESS_0)',
    0x71: 'SEN0322 O₂ (ADDRESS_1)',
    0x72: 'SEN0322 O₂ (ADDRESS_2)',
    0x73: 'SEN0322 O₂ (ADDRESS_3)',
    0x76: 'BME280 / BMP280 (alt)',
    0x77: 'BME680 / BME280 / BMP280',
}

try:
    import board, busio
except ImportError:
    print('ERROR: adafruit-blinka not installed.')
    print('       pip3 install --break-system-packages adafruit-blinka')
    raise SystemExit(1)

try:
    i2c = busio.I2C(board.SCL, board.SDA)
except Exception as e:
    print(f'ERROR: Could not open I2C bus: {e}')
    print('       Enable I2C with: sudo raspi-config → Interface Options → I2C')
    raise SystemExit(1)

while not i2c.try_lock():
    pass
try:
    found = sorted(i2c.scan())
finally:
    i2c.unlock()

if not found:
    print('No I2C devices found. Check wiring and that I2C is enabled.')
    raise SystemExit(0)

print(f'\nI2C devices found: {len(found)}\n')
print(f'  {"Address":<10} {"Hex":<8} Label')
print(f'  {"-"*7:<10} {"-"*5:<8} {"-"*30}')
for addr in found:
    label = KNOWN.get(addr, '(unknown)')
    print(f'  {addr:<10} 0x{addr:02x}     {label}')
print()
