// ═══════════════════════════════════════════════════════════
//  GODS EYE — SATELLITES MODULE v5
//  TLE fetching, SGP4 propagation, emoji sprite icons
//  ISS dedicated tracker, Open Notify crew data
// ═══════════════════════════════════════════════════════════

const Satellites = (() => {
  let satellites = [];
  let satMeshes = [];
  const trailHist = {};

  // ── ISS state ──
  let issData = { crew: [], nextPass: null, fetching: false };

  // ── Category filter state ──
  const catFilter = {
    iss: true, starlink: true, weather: true, nav: true,
    science: true, iridium: true, debris: true, other: true,
  };

  // ── Emoji sprite canvas cache ──────────────────────────
  const spriteCache = {};

  function makeEmojiSprite(emoji, sizePx = 28) {
    if (spriteCache[emoji + sizePx]) return spriteCache[emoji + sizePx];
    const canvas = document.createElement('canvas');
    canvas.width = sizePx; canvas.height = sizePx;
    const ctx = canvas.getContext('2d');
    ctx.font = `${sizePx * 0.8}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.clearRect(0, 0, sizePx, sizePx);
    ctx.fillText(emoji, sizePx / 2, sizePx / 2);
    const tex = new THREE.CanvasTexture(canvas);
    spriteCache[emoji + sizePx] = tex;
    return tex;
  }

  // ── TLE Parsing ────────────────────────────────────────
  function parseTLEs(raw, cat) {
    const lines = raw.trim().split('\n').map(l => l.trim()).filter(Boolean);
    const sats = [];
    for (let i = 0; i + 2 < lines.length; i++) {
      if (lines[i + 1].startsWith('1 ') && lines[i + 2].startsWith('2 ')) {
        try {
          const sr = satellite.twoline2satrec(lines[i + 1], lines[i + 2]);
          sats.push({
            name: lines[i].trim(), tle1: lines[i + 1], tle2: lines[i + 2],
            satrec: sr, cat, id: parseInt(lines[i + 1].substring(2, 7))
          });
          i += 2;
        } catch (e) { }
      }
    }
    return sats;
  }

  function catMeta(cat) {
    return CONFIG.catMeta[cat] || CONFIG.catMeta.other;
  }

  function catColor(cat, god) {
    const m = catMeta(cat);
    return god ? m.godColor : m.color;
  }

  function catLabel(cat) {
    return catMeta(cat).label;
  }

  function catClass(cat) {
    return catMeta(cat).cssClass;
  }

  function catIcon(cat) {
    return catMeta(cat).icon;
  }

  // ── TLE Fetch ──────────────────────────────────────────
  async function fetchTLEGroup(group) {
    const urls = [CONFIG.proxy + encodeURIComponent(group.url), group.url];
    for (const url of urls) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) continue;
        const text = await res.text();
        if (text.includes('1 ') && text.length > 100) return parseTLEs(text, group.cat);
      } catch (e) { }
    }
    return [];
  }

  async function fetchAll(onProgress) {
    let allSats = [];
    const results = await Promise.allSettled(
      CONFIG.tleGroups.map((g, i) =>
        fetchTLEGroup(g).then(sats => {
          if (onProgress) onProgress(g.label, sats.length, i, CONFIG.tleGroups.length);
          return sats;
        })
      )
    );
    results.forEach(r => { if (r.status === 'fulfilled') allSats = allSats.concat(r.value); });

    if (allSats.length < 5) {
      allSats = parseTLEs(CONFIG.fallbackTLE, 'other');
      allSats.forEach(s => {
        const n = s.name.toUpperCase();
        if (n.includes('ISS') || n.includes('ZARYA')) s.cat = 'iss';
        else if (n.includes('STARLINK')) s.cat = 'starlink';
        else if (n.includes('NOAA') || n.includes('GOES') || n.includes('METOP')) s.cat = 'weather';
        else if (n.includes('GPS') || n.includes('GLONASS') || n.includes('GALILEO')) s.cat = 'nav';
        else s.cat = 'science';
      });
      return { sats: allSats, fallback: true };
    }
    return { sats: allSats, fallback: false };
  }

  // ── ISS Crew Fetch (Open Notify) ───────────────────────
  async function fetchISSData() {
    if (issData.fetching) return;
    issData.fetching = true;
    try {
      const res = await fetch('http://api.open-notify.org/astros.json');
      if (res.ok) {
        const data = await res.json();
        issData.crew = (data.people || []).filter(p => p.craft === 'ISS');
      }
    } catch (e) {
      issData.crew = [];
    }
    issData.fetching = false;
  }

  function getISSIndex() {
    return satellites.findIndex(s => s.cat === 'iss' && (s.name.includes('ISS') || s.name.includes('ZARYA')));
  }

  // ── Mesh Building with Emoji Sprites ──────────────────
  function buildMeshes(godMode) {
    Globe.satGroup.clear();
    satMeshes = [];

    satellites.forEach((sat, idx) => {
      const meta = catMeta(sat.cat);
      const emoji = sat.cat === 'iss' ? '🛰️' : meta.icon;
      const sizePx = sat.cat === 'iss' ? 40 : sat.cat === 'debris' ? 16 : 24;

      const tex = makeEmojiSprite(emoji, sizePx);
      const mat = new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        opacity: sat.cat === 'debris' ? 0.5 : 0.9,
        depthTest: false,
      });
      const sprite = new THREE.Sprite(mat);
      const scale = sat.cat === 'iss' ? 0.035 : sat.cat === 'debris' ? 0.008 : sat.cat === 'starlink' ? 0.010 : 0.016;
      sprite.scale.setScalar(scale);
      sprite.userData = { idx, type: 'sat', obj: sat };
      Globe.satGroup.add(sprite);
      satMeshes.push(sprite);
    });

    applyCatFilter();
  }

  function applyCatFilter() {
    satellites.forEach((sat, idx) => {
      if (satMeshes[idx]) {
        satMeshes[idx].visible = catFilter[sat.cat] !== false;
      }
    });
  }

  function setCatFilter(cat, val) {
    catFilter[cat] = val;
    applyCatFilter();
  }

  function propagate(godMode) {
    const now = new Date();
    satellites.forEach((sat, idx) => {
      try {
        const pv = satellite.propagate(sat.satrec, now);
        if (!pv.position) return;
        const gmst = satellite.gstime(now);
        const geo = satellite.eciToGeodetic(pv.position, gmst);
        sat.lat = satellite.degreesLat(geo.latitude);
        sat.lon = satellite.degreesLong(geo.longitude);
        sat.alt = geo.height;
        const v = pv.velocity;
        sat.vel = v ? Math.sqrt(v.x ** 2 + v.y ** 2 + v.z ** 2) : 0;
        const r = 1 + (sat.alt / 6371) * 1.4;
        const pos = Utils.ll2v3(sat.lat, sat.lon, r);
        if (satMeshes[idx]) satMeshes[idx].position.copy(pos);
        if (!trailHist[idx]) trailHist[idx] = [];
        trailHist[idx].push({ lat: sat.lat, lon: sat.lon, alt: sat.alt });
        if (trailHist[idx].length > CONFIG.maxTrailPoints) trailHist[idx].shift();
      } catch (e) { }
    });
  }

  function recolor(godMode) {
    satellites.forEach((sat, idx) => {
      if (!satMeshes[idx]) return;
      const meta = catMeta(sat.cat);
      const emoji = godMode ? '⚠️' : (sat.cat === 'iss' ? '🛰️' : meta.icon);
      const sizePx = sat.cat === 'iss' ? 40 : sat.cat === 'debris' ? 16 : 24;
      satMeshes[idx].material.map = makeEmojiSprite(emoji, sizePx);
      satMeshes[idx].material.needsUpdate = true;
      satMeshes[idx].material.opacity = godMode ? 0.85 : (sat.cat === 'debris' ? 0.5 : 0.9);
    });
  }

  function drawTrail(idx, godMode) {
    Globe.trailGroup.clear();
    const h = trailHist[idx];
    if (!h || h.length < 2) return;
    const pts = h.map(p => Utils.ll2v3(p.lat, p.lon, 1 + (p.alt / 6371) * 1.4));
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const color = godMode ? 0xff2200 : 0x00ff41;
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.45 });
    Globe.trailGroup.add(new THREE.Line(geo, mat));
  }

  function getThreatCounts() {
    let leo = 0, meo = 0, geo = 0;
    satellites.forEach(s => {
      const a = s.alt || 400;
      if (a < 2000) leo++; else if (a < 35000) meo++; else geo++;
    });
    return { total: satellites.length, leo, meo, geo };
  }

  function select(idx, godMode) {
    const SCALE_DEFAULT = 1;
    const SCALE_SEL = 3;
    satellites.forEach((sat, i) => {
      if (!satMeshes[i]) return;
      satMeshes[i].scale.setScalar(
        i === idx ? (sat.cat === 'iss' ? 0.07 : 0.04)
                  : (sat.cat === 'iss' ? 0.035 : sat.cat === 'debris' ? 0.008 : 0.016)
      );
    });
    const sat = satellites[idx];
    if (sat && sat.lat !== undefined) {
      Globe.rotY = (-sat.lon - 90) * Math.PI / 180;
      Globe.rotX = -sat.lat * Math.PI / 180 * 0.4;
    }
  }

  return {
    get list() { return satellites; },
    set list(v) { satellites = v; },
    get meshes() { return satMeshes; },
    get trails() { return trailHist; },
    get issData() { return issData; },
    get catFilter() { return catFilter; },
    parseTLEs, fetchAll, fetchISSData, getISSIndex,
    buildMeshes, propagate, recolor, drawTrail,
    getThreatCounts, select,
    catColor, catLabel, catClass, catIcon, catMeta,
    setCatFilter, applyCatFilter,
  };
})();
