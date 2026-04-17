// âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
//  GODS EYE â AIRCRAFT MODULE v5.2
//  OpenSky positions + AviationStack route enrichment
//  ADS-B Exchange military feed
//  Floating callsign labels, bracket reticle on selection
// âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

const Aircraft = (() => {
  let aircraft      = [];
  let airMeshes     = [];
  let airLabels     = [];   // floating callsign labels
  let activeBracket = null; // bracket on selected aircraft

  const routeCache  = {};

  // ââ Label zoom threshold âââââââââââââââââââââââââââââââââ
  const LABEL_ZOOM_THRESHOLD = 2.3;

  // ââ Military callsign prefix detection ââââââââââââââââââ
  // Covers USAF, USN, Army, NATO allies, known mil prefixes
  const MIL_PREFIXES = (CONFIG.militaryPrefixes || [
    'RCH','RRR','DUKE','FORTE','TOPCT','JAKE','POLAR','SWORD','VIPER',
    'VALOR','REACH','ZEUS','ATLAS','TITAN','COBRA','EAGLE','FALCON',
    'DRAGON','HAWK','GHOST','SHADOW','REAPER','SENTRY','VENUS','MARS',
    'HOMER','MAGMA','BISON','IRON','STEEL','CHROME','BRONZE','COPPER',
    'GOLD','SILVER','DIAMOND','RUBY','SAPPH','TOPAZ','AMBER','JADE',
    'ROCKY','STONE','SLATE','IRON','STEEL','RANGER','SHIELD','LANCE',
    'SPEAR','ARROW','KNIFE','BLADE','DAGGER','SWORD','AXE','MACE',
    'STORM','THUNDER','LIGHTNING','CYCLONE','TYPHOON','TEMPEST',
    'WOLF','BEAR','LION','TIGER','PANTHER','JAGUAR','PUMA','LYNX',
    'RAF','NATO','USAF','USN','ARMY','NAVY','ANGEL','MERCY',
    'MEDIC','HOSP','EVAC','MEDEVAC','CASEVAC','LOGAIR','SEALIFT',
  ]);

  // Known military ICAO24 hex prefixes (first 2 chars of 6-char hex)
  const MIL_ICAO_PREFIXES = ['ae', 'a9', '3e', '43', '44', '45', '46', '47', '48'];

  function isMilitary(ac) {
    if (!ac) return false;
    const cs = (ac.callsign || '').trim().toUpperCase();
    const icao = (ac.icao24 || '').toLowerCase();
    if (MIL_PREFIXES.some(p => cs.startsWith(p))) return true;
    if (MIL_ICAO_PREFIXES.some(p => icao.startsWith(p))) return true;
    return false;
  }

  // ââ OpenSky Fetch ââââââââââââââââââââââââââââââââââââââââ
  async function fetch_data() {
    try {
      // Use CORS proxy â direct OpenSky fetch fails on GitHub Pages
      const url = CONFIG.proxy + encodeURIComponent(CONFIG.opensky);
      const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
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
          route: routeCache[s[1]?.trim()] || null,
          military: false,
          source: 'opensky',
        }));
      aircraft.forEach(ac => { ac.military = isMilitary(ac); });
      return true;
    } catch (e) { return false; }
  }

  async function fetchMilitary() {
    try {
      const url = 'https://adsbexchange.com/api/aircraft/v2/mil/';
      const res = await fetch(CONFIG.proxy + encodeURIComponent(url), {
        headers: { 'api-auth': CONFIG.adsbExchangeKey || '' },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error('ADS-B ' + res.status);
      const data = await res.json();
      const milAircraft = (data.ac || [])
        .filter(a => a.lat != null && a.lon != null)
        .map(a => ({
          icao24: a.hex || '',
          callsign: (a.flight || a.r || '').trim(),
          origin_country: a.cou || '---',
          lon: parseFloat(a.lon), lat: parseFloat(a.lat),
          baro_altitude: a.alt_baro ? parseFloat(a.alt_baro) * 0.3048 : null,
          geo_altitude:  a.alt_geom ? parseFloat(a.alt_geom) * 0.3048 : null,
          velocity: a.gs ? parseFloat(a.gs) * 0.514444 : null,
          true_track: a.track ? parseFloat(a.track) : null,
          vertical_rate: a.baro_rate ? parseFloat(a.baro_rate) * 0.00508 : null,
          squawk: a.squawk || '---',
          on_ground: a.alt_baro === 'ground',
          military: true, source: 'adsbx',
          aircraftType: a.t || '---', registration: a.r || '---',
          route: null,
        }));
      const existingIcaos = new Set(aircraft.map(a => a.icao24));
      milAircraft.forEach(ma => {
        if (!existingIcaos.has(ma.icao24)) { aircraft.push(ma); }
        else { const i = aircraft.findIndex(a => a.icao24 === ma.icao24); if (i >= 0) aircraft[i].military = true; }
      });
      return milAircraft.length;
    } catch (e) { return 0; }
  }

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
        flightNumber: flight.flight?.iata || cs,
        airline: flight.airline?.name || '---',
        aircraftType: flight.aircraft?.iata || '---',
        registration: flight.aircraft?.registration || '---',
        dep: { iata: flight.departure?.iata || '???', airport: flight.departure?.airport || '---', scheduled: flight.departure?.scheduled || null },
        arr: { iata: flight.arrival?.iata || '???', airport: flight.arrival?.airport || '---', estimated: flight.arrival?.estimated || null },
        status: flight.flight_status || 'unknown',
      };
      routeCache[cs] = route;
      const idx = aircraft.findIndex(a => a.callsign === cs);
      if (idx >= 0) aircraft[idx].route = route;
      return route;
    } catch (e) { return null; }
  }

  const acDotCache = {};
  function makeAcDot(color, sz = 24) {
    const key = color + sz;
    if (acDotCache[key]) return acDotCache[key];
    const cv = document.createElement('canvas');
    cv.width = cv.height = sz;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, sz, sz);
    const cx = sz / 2;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx, 2);
    ctx.lineTo(sz - 2, sz - 2);
    ctx.lineTo(cx, sz - 6);
    ctx.lineTo(2, sz - 2);
    ctx.closePath();
    ctx.fill();
    const tex = new THREE.CanvasTexture(cv);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    acDotCache[key] = tex;
    return tex;
  }

  function makeAcLabel(cs, lColor) {
    const cv = document.createElement('canvas');
    const ctx = cv.getContext('2d');
    const fs = 9;
    ctx.font = `${fs}px "Share Tech Mono", monospace`;
    const tw = ctx.measureText(cs).width;
    const pad = 3;
    cv.width = Math.ceil(tw + pad * 2);
    cv.height = fs + pad * 2;
    ctx.font = `${fs}px "Share Tech Mono", monospace`;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = lColor;
    ctx.textBaseline = 'middle';
    ctx.fillText(cs, pad, cv.height / 2 + 1);
    const tex = new THREE.CanvasTexture(cv);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const spr = new THREE.Sprite(mat);
    const h = 0.012;
    spr.scale.set((cv.width / cv.height) * h, h, 1);
    return spr;
  }

  function buildMeshes(godMode) {
    Globe.airGroup.clear();
    Globe.labelGroup.children.filter(c => c.userData.airLabel).forEach(c => Globe.labelGroup.remove(c));
    Globe.bracketGroup.children.filter(c => c.userData.airBracket).forEach(c => Globe.bracketGroup.remove(c));
    activeBracket = null; airMeshes = []; airLabels = [];
    aircraft.forEach((ac, idx) => {
      const lColor = godMode ? '#00ffcc' : ac.military ? '#ff9900' : '#00f5ff';
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeAcDot(lColor, 24), transparent: true, depthTest: false, opacity: 0.9 }));
      sprite.scale.setScalar(0.010);
      sprite.userData = { idx, type: 'air', obj: ac };
      Globe.airGroup.add(sprite); airMeshes.push(sprite);
      const cs = (ac.callsign || ac.icao24 || 'UNK').substring(0, 8).trim();
      const alt = ac.baro_altitude || ac.geo_altitude;
      const fl = alt ? ' FL' + Math.round(alt * 3.28084 / 100) : '';
      const label = makeAcLabel(cs + fl, lColor);
      label.visible = false; label.userData = { idx, airLabel: true };
      Globe.labelGroup.add(label); airLabels.push(label);
    });
  }

  function place() {
    const showLabels = Globe.zoom <= LABEL_ZOOM_THRESHOLD;
    const satIsolating = typeof Satellites !== 'undefined' && Satellites.isolateMode;
    const trackedAirIdx = (typeof UI !== 'undefined' && UI.selectedType === 'air' && UI.selectedIdx !== null) ? UI.selectedIdx : null;
    aircraft.forEach((ac, idx) => {
      if (ac.lat == null || ac.lon == null) return;
      const alt = (ac.geo_altitude || ac.baro_altitude || 10000) / 1000;
      const r = 1 + (alt / 6371) * 1.4 + 0.005;
      const pos = Utils.ll2v3(ac.lat, ac.lon, r);
      if (airMeshes[idx]) airMeshes[idx].position.copy(pos);
      if (airLabels[idx]) {
        airLabels[idx].position.copy(Utils.ll2v3(ac.lat, ac.lon, r + 0.035));
        let labelVis;
        if (satIsolating) { labelVis = false; }
        else if (trackedAirIdx !== null) { labelVis = (idx === trackedAirIdx); }
        else { labelVis = showLabels; }
        airLabels[idx].visible = labelVis;
      }
      if (activeBracket && activeBracket.userData.idx === idx) activeBracket.position.copy(pos);
    });
  }

  function recolor(godMode) {
    aircraft.forEach((ac, idx) => {
      if (!airMeshes[idx]) return;
      airMeshes[idx].material.opacity = godMode ? 0.7 : 0.95;
      airMeshes[idx].material.needsUpdate = true;
    });
  }

  function showBracket(idx, godMode) {
    Globe.bracketGroup.children.filter(c => c.userData.airBracket).forEach(c => Globe.bracketGroup.remove(c));
    activeBracket = null;
    if (idx === null || !airMeshes[idx]) return;
    const color = godMode ? 0x00ffcc : aircraft[idx]?.military ? 0xff9900 : 0x00f5ff;
    const bracket = Globe.makeBracket(0.045, color);
    bracket.position.copy(airMeshes[idx].position);
    bracket.userData = { idx, airBracket: true };
    Globe.bracketGroup.add(bracket);
    activeBracket = bracket;
    let t = 0;
    const pulse = () => {
      if (!activeBracket || activeBracket.userData.idx !== idx) return;
      t += 0.04; activeBracket.scale.setScalar(1 + Math.sin(t) * 0.07);
      requestAnimationFrame(pulse);
    }; pulse();
  }

  return {
    get list()    { return aircraft; },
    get meshes()  { return airMeshes; },
    get labels()  { return airLabels; },
    fetch: fetch_data, fetchMilitary, fetchRoute,
    buildMeshes, place, recolor, showBracket, isMilitary,
  };
})();
