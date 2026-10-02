# Third-Party Notices

RingoOS includes or uses the following third-party components. They remain the
property of their respective owners and are used under their own licenses and
terms. The copyright notice in `LICENSE` does not apply to them.

## qrcode-generator

- Used for: generating QR codes for calendar events
- Source: https://github.com/kazuhikoarase/qrcode-generator
- License: MIT

```
Copyright (c) 2009 Kazuhiko Arase

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

The word "QR Code" is a registered trademark of DENSO WAVE INCORPORATED.

## HarmonyOS Sans

- Used for: the interface typeface (`public/fonts/`)
- Owner: Huawei Device Co., Ltd.
- License: HarmonyOS Sans Fonts License Agreement

This software uses HarmonyOS Sans Fonts. The font files are distributed
unmodified in their glyph design; they were only converted from TTF to WOFF2
for web delivery. The fonts are not distributed separately from this software.

## Geist Mono

- Used for: numerals and monospaced labels (`@fontsource-variable/geist-mono`)
- Copyright 2024 The Geist Project Authors (https://github.com/vercel/geist-font)
- License: SIL Open Font License, Version 1.1 (https://openfontlicense.org)

The font is bundled unmodified. The full license text ships with the package
in `node_modules/@fontsource-variable/geist-mono/LICENSE`.

## EmoteLab character animations

- Used for: the desktop companion character (`public/characters/`)
- Created with: EmoteLab, https://emotelab.app
- Terms: EmoteLab End User License Agreement, https://emotelab.app/eula/

These animations were exported from EmoteLab using its built-in character
model. The character design belongs to its original creator and is not claimed
by the owner of this repository.

## Open-Meteo

- Used for: worldwide weather forecasts in RingoOS 2.0, fetched at runtime from
  the free, non-commercial API; no weather data is stored in this repository
- Source: https://open-meteo.com
- Weather data by Open-Meteo.com, licensed under Creative Commons Attribution
  4.0 International (CC BY 4.0), https://creativecommons.org/licenses/by/4.0/
- The Open-Meteo geocoding API is also used for place search; it is based on
  GeoNames (https://www.geonames.org), CC BY 4.0

## Photon and OpenStreetMap

- Used for: place search in RingoOS 2.0, fetched at runtime from
  https://photon.komoot.io
- Map data © OpenStreetMap contributors, available under the Open Database
  License (ODbL), https://www.openstreetmap.org/copyright

## Central Weather Administration open data

- Used for: weather forecasts and alerts in RingoOS 1.0; in RingoOS 2.0, for
  places in Taiwan when the user supplies their own authorization key:
  township forecasts, weather station observations (O-A0001-001, O-A0003-001)
  and weather alerts; fetched at runtime; no key is stored in this repository.
  The test fixtures in `tests/fixtures/cwa-*.json` are trimmed copies of public
  responses from this open data
- Provider: 交通部中央氣象署 (Central Weather Administration, Ministry of
  Transportation and Communications, Taiwan)
- License: 政府資料開放授權條款－第1版 (Open Government Data License, Taiwan,
  version 1.0), https://data.gov.tw/license

交通部中央氣象署 開放資料（鄉鎮天氣預報 F-D0047 系列、天氣特報 W-C0033-001）
此開放資料依政府資料開放授權條款（Open Government Data License）進行公眾釋出，
使用者於遵守本條款各項規定之前提下，得利用之。
政府資料開放授權條款：https://data.gov.tw/license
