// ═══════════════════════════════════════════════════════════
//  GODS EYE — SATELLITES MODULE
//  TLE fetching, SGP4 propagation, mesh placement
// ═══════════════════════════════════════════════════════════

const Satellites = (() => {
  let satellites = [];
  let satMeshes = [];
  const trailHist = {};

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

  function catColor(cat, god) {
    return god ? (CONFIG.catColors.godview[cat] || CONFIG.catColors.godview.other)
               : (CONFIG.catColors.normal[cat] || CONFIG.catColors.normal.other);
  }

  function catLabel(cat) {
    const m = { iss: 'ISS', starlink: 'STRLNK', weather: 'WTHR', nav: 'NAV', science: 'SCI', iridium: 'IRDM', aircraft: 'ACFT', debris: 'DBRS', other: 'OBJ' };
    return m[cat] || 'OBJ';
  }

  function catClass(cat) {
    const m = { iss: 'cs', starlink: 'cst', weather: 'cw', nav: 'cn', science: 'cs', iridium: 'co', aircraft: 'ca', debris: 'cd', other: 'co' };
    return m[cat] || 'co';
  }

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

  function buildMeshes(godMode) {
    Globe.satGroup.clear();
    satMeshes = [];
    const geoISS = new THREE.SphereGeometry(0.016, 6, 6);
    const geoStarlink = new THREE.SphereGeometry(0.004, 3, 3);
    const geoDefault = new THREE.SphereGeometry(0.008, 4, 4);
    const geoDebris = new THREE.SphereGeometry(0.003, 3, 3);

    satellites.forEach((sat, idx) => {
      const col = catColor(sat.cat, godMode);
      let geo = geoDefault;
      if (sat.cat === 'iss') geo = geoISS;
      else if (sat.cat === 'starlink') geo = geoStarlink;
      else if (sat.cat === 'debris') geo = geoDebris;
      const mat = new THREE.MeshBasicMaterial({ color: col });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.userData = { idx, type: 'sat', obj: sat };
      Globe.satGroup.add(mesh);
      satMeshes.push(mesh);
    });
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
    satMeshes.forEach((m, i) => {
      if (!satellites[i]) return;
      m.material.color.setHex(catColor(satellites[i].cat, godMode));
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
    satMeshes.forEach((m, i) => {
      m.material.color.setHex(i === idx ? 0xffffff : catColor(satellites[i].cat, godMode));
      m.scale.setScalar(i === idx ? 3 : 1);
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
    parseTLEs, fetchAll, buildMeshes, propagate, recolor, drawTrail,
    getThreatCounts, select, catColor, catLabel, catClass,
  };
})();
