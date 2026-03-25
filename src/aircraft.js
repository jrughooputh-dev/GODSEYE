// ═══════════════════════════════════════════════════════════
//  GODS EYE — AIRCRAFT MODULE v5
//  OpenSky positions + AviationStack route enrichment
//  Plane emoji sprites oriented by heading
// ═══════════════════════════════════════════════════════════

const Aircraft = (() => {
  let aircraft = [];
  let airMeshes = [];

  // Route cache — keyed by callsign, avoids hammering API (500/month limit)
  const routeCache = {};

  // ── Sprite texture ──────────────────────────────────────
  let _planeTex = null;
  function getPlaneTexture() {
    if (_planeTex) return _planeTex;
    const canvas = document.createElement('canvas');
    canvas.width = 32; canvas.height = 32;
    const ctx = canvas.getContext('2d');
    ctx.font = '26px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.clearRect(0, 0, 32, 32);
    ctx.fillText('✈️', 16, 16);
    _planeTex = new THREE.CanvasTexture(canvas);
    return _planeTex;
  }

  // ── OpenSky Fetch ───────────────────────────────────────
  async function fetch_data() {
    try {
      const res = await fetch(CONFIG.opensky);
      if (!res.ok) throw new Error('OpenSky ' + res.status);
      const data = await res.json();
      aircraft = (data.states || [])
        .filter(s => s[6] != null && s[5] != null)
        .slice(0, CONFIG.maxAircraft)
        .map(s => ({
          icao24: s[0], callsign: s[1]?.trim(), origin_country: s[2],
          lon: s[5], lat: s[6], baro_altitude: s[7], on_ground: s[8],
          velocity: s[9], true_track: s[10], vertical_rate: s[11],
          geo_altitude: s[13], squawk: s[14],
          // route data — populated on click via fetchRoute
          route: routeCache[s[1]?.trim()] || null,
        }));
      return true;
    } catch (e) {
      return false;
    }
  }

  // ── AviationStack Route Fetch ───────────────────────────
  async function fetchRoute(callsign) {
    if (!callsign) return null;
    const cs = callsign.trim();
    if (routeCache[cs]) return routeCache[cs];
    if (!CONFIG.aviationstack.apiKey) return null;

    try {
      const url = `${CONFIG.aviationstack.base}?access_key=${CONFIG.aviationstack.apiKey}&flight_iata=${cs}&limit=1`;
      const res = await fetch(CONFIG.proxy + encodeURIComponent(url));
      if (!res.ok) throw new Error('AviationStack ' + res.status);
      const data = await res.json();
      const flight = data.data && data.data[0];
      if (!flight) return null;

      const route = {
        flightNumber:  flight.flight?.iata || cs,
        airline:       flight.airline?.name || '---',
        aircraftType:  flight.aircraft?.iata || '---',
        registration:  flight.aircraft?.registration || '---',
        dep: {
          iata:       flight.departure?.iata || '???',
          airport:    flight.departure?.airport || '---',
          timezone:   flight.departure?.timezone || '---',
          scheduled:  flight.departure?.scheduled || null,
          actual:     flight.departure?.actual || null,
        },
        arr: {
          iata:       flight.arrival?.iata || '???',
          airport:    flight.arrival?.airport || '---',
          timezone:   flight.arrival?.timezone || '---',
          scheduled:  flight.arrival?.scheduled || null,
          estimated:  flight.arrival?.estimated || null,
        },
        status: flight.flight_status || 'unknown',
      };

      routeCache[cs] = route;
      // Update in live array too
      const idx = aircraft.findIndex(a => a.callsign === cs);
      if (idx >= 0) aircraft[idx].route = route;

      return route;
    } catch (e) {
      return null;
    }
  }

  // ── Mesh Building ───────────────────────────────────────
  function buildMeshes(godMode) {
    Globe.airGroup.clear();
    airMeshes = [];
    const tex = getPlaneTexture();

    aircraft.forEach((ac, idx) => {
      const mat = new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        opacity: godMode ? 0.75 : 0.9,
        depthTest: false,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.setScalar(0.018);
      sprite.userData = { idx, type: 'air', obj: ac };
      Globe.airGroup.add(sprite);
      airMeshes.push(sprite);
    });
  }

  function place() {
    aircraft.forEach((ac, idx) => {
      if (ac.lat == null || ac.lon == null) return;
      const alt = (ac.geo_altitude || ac.baro_altitude || 10000) / 1000;
      const r = 1 + (alt / 6371) * 1.4 + 0.005;
      const pos = Utils.ll2v3(ac.lat, ac.lon, r);
      if (airMeshes[idx]) airMeshes[idx].position.copy(pos);
    });
  }

  function recolor(godMode) {
    const godTex = (() => {
      const canvas = document.createElement('canvas');
      canvas.width = 32; canvas.height = 32;
      const ctx = canvas.getContext('2d');
      ctx.font = '26px serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.clearRect(0, 0, 32, 32);
      ctx.fillText('⚠️', 16, 16);
      return new THREE.CanvasTexture(canvas);
    })();

    const normalTex = getPlaneTexture();
    airMeshes.forEach(m => {
      m.material.map = godMode ? godTex : normalTex;
      m.material.opacity = godMode ? 0.75 : 0.9;
      m.material.needsUpdate = true;
    });
  }

  return {
    get list() { return aircraft; },
    get meshes() { return airMeshes; },
    fetch: fetch_data, fetchRoute, buildMeshes, place, recolor,
  };
})();
