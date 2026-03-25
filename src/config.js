// ═══════════════════════════════════════════════════════════
//  GODS EYE — CONFIG
//  Central configuration for all modules
// ═══════════════════════════════════════════════════════════

const CONFIG = {
  version: '4.0.0',
  name: 'GODS EYE',
  subtitle: 'WORLDVIEW OPERATIONS CENTER',

  // ── API & DATA SOURCES ──────────────────────────────────
  proxy: 'https://corsproxy.io/?',
  opensky: 'https://opensky-network.org/api/states/all',

  // NASA Earth textures (public domain, CDN-hosted)
  textures: {
    day:    'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg',
    night:  'https://unpkg.com/three-globe/example/img/earth-night.jpg',
    topo:   'https://unpkg.com/three-globe/example/img/earth-topology.png',
    clouds: 'https://unpkg.com/three-globe/example/img/earth-clouds.png',
  },

  // ── TLE GROUPS ──────────────────────────────────────────
  tleGroups: [
    { label: 'STATIONS', cat: 'iss',      url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=tle' },
    { label: 'STARLINK', cat: 'starlink',  url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=tle' },
    { label: 'WEATHER',  cat: 'weather',   url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=weather&FORMAT=tle' },
    { label: 'GPS',      cat: 'nav',       url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=gps-ops&FORMAT=tle' },
    { label: 'GALILEO',  cat: 'nav',       url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=galileo&FORMAT=tle' },
    { label: 'GLONASS',  cat: 'nav',       url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=glonass-operational&FORMAT=tle' },
    { label: 'SCIENCE',  cat: 'science',   url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=science&FORMAT=tle' },
    { label: 'IRIDIUM',  cat: 'iridium',   url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=iridium-NEXT&FORMAT=tle' },
    { label: 'ACTIVE',   cat: 'other',     url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle' },
    { label: 'DEBRIS',   cat: 'debris',    url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=cosmos-1408-debris&FORMAT=tle' },
  ],

  // ── SATELLITE CATEGORY COLORS ───────────────────────────
  catColors: {
    normal: { iss:0xffaa00, starlink:0x00ccff, weather:0x88ffaa, nav:0xffccaa, science:0xff88ff, iridium:0xaaaaff, aircraft:0x00bbff, debris:0x666666, other:0x00ff41 },
    godview: { iss:0xff4400, starlink:0xff2200, weather:0xff6622, nav:0xff8844, science:0xff3311, iridium:0xff5500, aircraft:0xff0044, debris:0xff1111, other:0xff2020 },
  },

  // ── PERFORMANCE ─────────────────────────────────────────
  maxAircraft: 1000,
  maxTrailPoints: 80,
  satUpdateFrames: 45,    // update every N frames
  listRenderCap: 500,     // max list items rendered

  // ── RADAR ───────────────────────────────────────────────
  radar: {
    radiusKm: 50,
    sweepDuration: 4000,  // ms per full rotation
    maxBlips: 200,
  },

  // ── TIMEZONES (GOD CLOCK) ──────────────────────────────
  timezones: [
    { city: 'TORONTO',     tz: 'America/Toronto',     flag: '🇨🇦', personal: true },
    { city: 'TBILISI',     tz: 'Asia/Tbilisi',        flag: '🇬🇪', personal: true },
    { city: 'TALLINN',     tz: 'Europe/Tallinn',       flag: '🇪🇪', personal: true },
    { city: 'NEW YORK',    tz: 'America/New_York',     flag: '🇺🇸' },
    { city: 'LOS ANGELES', tz: 'America/Los_Angeles', flag: '🇺🇸' },
    { city: 'CHICAGO',     tz: 'America/Chicago',      flag: '🇺🇸' },
    { city: 'LONDON',      tz: 'Europe/London',        flag: '🇬🇧' },
    { city: 'PARIS',       tz: 'Europe/Paris',         flag: '🇫🇷' },
    { city: 'ISTANBUL',    tz: 'Europe/Istanbul',      flag: '🇹🇷' },
    { city: 'CAIRO',       tz: 'Africa/Cairo',         flag: '🇪🇬' },
    { city: 'NAIROBI',     tz: 'Africa/Nairobi',       flag: '🇰🇪' },
    { city: 'MOSCOW',      tz: 'Europe/Moscow',        flag: '🇷🇺' },
    { city: 'DUBAI',       tz: 'Asia/Dubai',           flag: '🇦🇪' },
    { city: 'KARACHI',     tz: 'Asia/Karachi',         flag: '🇵🇰' },
    { city: 'DELHI',       tz: 'Asia/Kolkata',         flag: '🇮🇳' },
    { city: 'DHAKA',       tz: 'Asia/Dhaka',           flag: '🇧🇩' },
    { city: 'BANGKOK',     tz: 'Asia/Bangkok',         flag: '🇹🇭' },
    { city: 'BEIJING',     tz: 'Asia/Shanghai',        flag: '🇨🇳' },
    { city: 'TOKYO',       tz: 'Asia/Tokyo',           flag: '🇯🇵' },
    { city: 'SYDNEY',      tz: 'Australia/Sydney',     flag: '🇦🇺' },
    { city: 'AUCKLAND',    tz: 'Pacific/Auckland',     flag: '🇳🇿' },
    { city: 'SAO PAULO',   tz: 'America/Sao_Paulo',   flag: '🇧🇷' },
  ],

  // ── AUTH ────────────────────────────────────────────────
  // Credentials are SHA-256 hashed for client-side auth
  // You will set these later. For now, default demo access.
  // To generate: run in console:
  //   crypto.subtle.digest('SHA-256', new TextEncoder().encode('yourpassword'))
  //     .then(h => Array.from(new Uint8Array(h)).map(b=>b.toString(16).padStart(2,'0')).join(''))
  auth: {
    enabled: true,
    sessionKey: 'godseye_session',
    sessionDuration: 24 * 60 * 60 * 1000, // 24 hours
    // Username: Benzpaws / Password: Benzpaws9
    credentials: {
      usernameHash: '0d07289b67c604a19878cfb8076cbdb7247dd3528b0aa9e509069a83192fd492',
      passwordHash: 'cfdf73abb0dfecd12f5aac088e1bcc382ce4e38323ac54b50742478f77a8ee64',
    }
  },

  // ── FALLBACK TLE DATA ──────────────────────────────────
  fallbackTLE: `ISS (ZARYA)
1 25544U 98067A   24300.52559028  .00020148  00000+0  35858-3 0  9994
2 25544  51.6382  18.8388 0005831 325.3867  34.6862 15.50286906477050
STARLINK-1007
1 44713U 19074A   24300.66977102  .00001500  00000+0  11802-3 0  9994
2 44713  53.0522  44.6891 0001310  90.6440 269.4703 15.06387657261830
STARLINK-1008
1 44714U 19074B   24300.59234015  .00001342  00000+0  10600-3 0  9990
2 44714  53.0527  44.5923 0001240  95.3001 264.8141 15.06415741261831
GPS BIIR-2 (PRN 13)
1 24876U 97035A   24300.53674005 -.00000066  00000+0  00000+0 0  9992
2 24876  55.6031 206.7063 0097540  88.7401 272.2720  2.00561244199876
NOAA 18
1 28654U 05018A   24300.61042765  .00000178  00000+0  13025-3 0  9995
2 28654  98.7374 333.0621 0013920 160.2427 199.9337 14.12618065995014
HST
1 20580U 90037B   24300.52543782  .00001578  00000+0  76344-4 0  9991
2 20580  28.4713 283.3521 0002756 220.5069 139.5625 15.09490673367890
GOES-16
1 41866U 16071A   24300.45512477 -.00000113  00000+0  00000+0 0  9997
2 41866   0.0560  36.1580 0001246 295.8895  97.7574  1.00270680 29154
TERRA
1 25994U 99068A   24300.50015313  .00000308  00000+0  68039-4 0  9997
2 25994  98.1895 311.1015 0001328  82.0516 278.0749 14.57145736309062
SENTINEL-2A
1 40697U 15028A   24300.55028395  .00000124  00000+0  64213-4 0  9997
2 40697  98.5702 330.6694 0001061  88.6073 271.5256 14.30806437479011
IRIDIUM 100
1 42804U 17039E   24300.55879862  .00000116  00000+0  27455-4 0  9992
2 42804  86.3953 257.4025 0002017 102.9948 257.1465 14.34216785 38121
METOP-B
1 38771U 12049A   24300.46892688 -.00000024  00000+0  42193-4 0  9997
2 38771  98.6997  32.4813 0001200  93.7399 266.3943 14.21479703630091
GLONASS M 730
1 41554U 16032A   24300.53888889  .00000039  00000+0  00000+0 0  9997
2 41554  64.4052 105.5381 0016350 256.7041 103.0971  2.13104203 62038
LANDSAT 8
1 39084U 13008A   24300.52543782  .00000208  00000+0  49371-4 0  9995
2 39084  98.2214 330.0712 0001463 108.1234 251.9987 14.57109498505431
AQUA
1 27424U 02022A   24300.54305600  .00000308  00000+0  67513-4 0  9994
2 27424  98.2107 321.7028 0001640  79.4034 280.7299 14.57100019196649`,
};
