# GODS EYE // WORLDVIEW OPERATIONS CENTER

A military-grade tactical globe web app that tracks live satellites, aircraft, and renders a 3D Earth with real-time day/night cycle. Built with vanilla JS, Three.js, and satellite.js.

![GODS EYE](https://img.shields.io/badge/STATUS-OPERATIONAL-00ff41?style=flat-square&labelColor=000)
![Version](https://img.shields.io/badge/VERSION-4.0.0-ffaa00?style=flat-square&labelColor=000)

## FEATURES

### Core Systems
- **10,000+ satellites** tracked live from CelesTrak (10 TLE groups)
- **SGP4 orbital propagation** via satellite.js
- **OpenSky aircraft integration** (1,000 object cap, 60s refresh)
- **Day/Night Earth shader** — real NASA Blue Marble + City Lights textures
- **Cloud layer** with slow rotational drift
- **Atmospheric glow** — blue limb Fresnel shader
- **Click-to-select** with full telemetry panel
- **Orbital trail history** (80 points per satellite)
- **Mini 2D ground track map**
- **Search by designation**

### GOD VIEW — War Mode
- Full red war theme transition
- Earth disappears, replaced by red wireframe void
- Targeting canvas overlay with animated rings
- Red sweep line animation
- Threat counter panel (LEO/MEO/GEO classification)
- All objects reclassified as threats

### GOD CLOCK
- 22 world timezones in a 2-column grid
- Live updating every second
- Day/night indicator per timezone
- Personal zones highlighted (Toronto, Tbilisi, Tallinn)

### PROXIMITY RADAR
- 50km radius scan around your location
- Uses browser geolocation API
- Animated sweep with blip detection
- Detects both satellites overhead and aircraft nearby
- Contact list with distance, bearing, altitude
- Click contacts to select them on the globe

### Visual Modes
- **NVG** — Night vision green filter
- **FLIR** — Thermal imaging filter
- **CRT scanlines** + vignette overlay

### Authentication
- SHA-256 hashed client-side login
- 24-hour session persistence
- Configurable credentials

## DEPLOYMENT (GitHub Pages)

```bash
# 1. Create repo on GitHub
git init
git remote add origin https://github.com/YOUR_USERNAME/godseye.git

# 2. Push
git add .
git commit -m "GODS EYE v4.0"
git push -u origin main

# 3. Enable GitHub Pages
# Settings → Pages → Branch: main → / (root) → Save

# 4. Access at: https://YOUR_USERNAME.github.io/godseye/
```

## CHANGING LOGIN CREDENTIALS

1. Open browser console
2. Generate hashes:

```javascript
async function hash(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Generate your hashes:
hash('your_username').then(console.log);  // Copy this
hash('your_password').then(console.log);  // Copy this
```

3. Edit `src/config.js` → `auth.credentials`:
```javascript
credentials: {
  usernameHash: 'YOUR_USERNAME_HASH_HERE',
  passwordHash: 'YOUR_PASSWORD_HASH_HERE',
}
```

### Default Credentials
- **Username:** `Benzpaws`
- **Password:** `Benzpaws9`

## REPO STRUCTURE

```
godseye/
├── index.html          ← Login page (entry point)
├── app.html            ← Main dashboard (auth-gated)
├── css/
│   ├── login.css       ← Login page styles
│   └── app.css         ← Dashboard styles
├── src/
│   ├── config.js       ← API keys, constants, TLE groups
│   ├── auth.js         ← SHA-256 authentication module
│   ├── utils.js        ← Shared utility functions
│   ├── globe.js        ← Three.js earth, day/night, atmosphere
│   ├── satellites.js   ← TLE fetch, SGP4 propagation
│   ├── aircraft.js     ← OpenSky Network integration
│   ├── godclock.js     ← World timezone panel
│   ├── radar.js        ← 50km proximity radar
│   └── ui.js           ← UI management, raycasting, panels
└── README.md
```

## DATA SOURCES

| Source | Data | Cost | Auth |
|--------|------|------|------|
| CelesTrak | Satellite TLEs | Free | None |
| OpenSky Network | Live aircraft | Free | None (public API) |
| NASA | Earth textures | Free | Public domain |

## TECH STACK

- **Three.js** r128 — 3D globe rendering
- **satellite.js** 4.1.4 — SGP4 orbital propagation
- **Vanilla JS** — No frameworks, no build step
- **GitHub Pages** — Static hosting, zero cost

## LICENSE

Public data only. Not affiliated with any military or government organization.
Satellite and aircraft data sourced from public APIs.
NASA textures are public domain.
