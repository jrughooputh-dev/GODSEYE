// ═══════════════════════════════════════════════════════════
//  GODS EYE — SATELLITES MODULE v5.2
//  Floating SAT labels, bracket reticle on selection,
//  cyan square dot sprites, category filters
// ═══════════════════════════════════════════════════════════

const Satellites = (() => {
  let satellites   = [];
  let satMeshes    = [];
  let satLabels    = [];   // floating label sprites per satellite
  let activeBracket = null; // current bracket group on selected sat
  const trailHist  = {};

  // ── ISS state ──────────────────────────────────────────
  let issData = { crew: [], fetching: false };

  // ── Category filter state ───────────────────────────────
  const catFilter = {
    iss: true, starlink: true, weather: true, nav: true,
    science: true, iridium: true, debris: true, other: true,
  };

  // ── Label visibility threshold ──────────────────────────
  // Only show labels when zoom is close enough
  const LABEL_ZOOM_THRESHOLD = 4.5;

  // ── Dot sprite cache ────────────────────────────────────
  const dotTexCache = {};

  function makeDotTex(color, size = 8) {
    const key = color + size;
    if (dotTexCache[key]) return dotTexCache[key];
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const ctx = cv.getContext('2d');
    // Square dot — matches reference screenshots
    ctx.fillStyle = color;
    ctx.fillRect(1, 1, size - 2, size - 2);
    const tex = new THREE.CanvasTexture(cv);
    dotTexCache[key] = tex;
    return tex;
  }

  // ── TLE Parsing ────────────────────────────────────────
  function parseTLEs(raw, cat) {
    const lines = raw.trim().split('\n').map(l => l.trim()).filter(Boolean);
    const sats  = [];
    for (let i = 0; i + 2 < lines.length; i++) {
      if (lines[i + 1].startsWith('1 ') && lines[i + 2].startsWith('2 ')) {
        try {
          const sr = satellite.twoline2satrec(lines[i + 1], lines[i + 2]);
          sats.push({
            name: lines[i].trim(), tle1: lines[i + 1], tle2: lines[i + 2],
            satrec: sr, cat, id: parseInt(lines[i + 1].substring(2, 7))
          });
          i += 2;
        } catch (e) {}
      }
    }
    return sats;
  }

  // ── Category helpers ────────────────────────────────────
  function catMeta(cat) { return CONFIG.catMeta[cat] || CONFIG.catMeta.other; }
  function catColor(cat, god) { const m = catMeta(cat); return god ? m.godColor : m.color; }
  function catLabel(cat) { return catMeta(cat).label; }
  function catClass(cat) { return catMeta(cat).cssClass; }
  function catIcon(cat)  { return catMeta(cat).icon; }

  // Dot color string for canvas (hex number → CSS string)
  function dotColorStr(cat, god) {
    const hex = catColor(cat, god);
    return '#' + hex.toString(16).padStart(6, '0');
  }

  // Label color per category
  function labelColor(cat, god) {
    if (god) return '#ff4422';
    const colors = {
      iss: '#ffb700', starlink: '#00f5ff', weather: '#88ffcc',
      nav: '#ffcc88', science: '#cc88ff', iridium: '#aaaaff',
      debris: '#555577', other: '#00ff88',
    };
    return colors[cat] || '#ffb700';
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
      } catch (e) {}
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
        if (n.includes('ISS') || n.includes('ZARYA'))     s.cat = 'iss';
        else if (n.includes('STARLINK'))                  s.cat = 'starlink';
        else if (n.includes('NOAA') || n.includes('GOES') || n.includes('METOP')) s.cat = 'weather';
        else if (n.includes('GPS') || n.includes('GLONASS') || n.includes('GALILEO')) s.cat = 'nav';
        else s.cat = 'science';
      });
      return { sats: allSats, fallback: true };
    }
    return { sats: allSats, fallback: false };
  }

  // ── ISS Crew (Open Notify) ─────────────────────────────
  async function fetchISSData() {
    if (issData.fetching) return;
    issData.fetching = true;
    try {
      const res = await fetch('http://api.open-notify.org/astros.json');
      if (res.ok) {
        const data = await res.json();
        issData.crew = (data.people || []).filter(p => p.craft === 'ISS');
      }
    } catch (e) { issData.crew = []; }
    issData.fetching = false;
  }

  function getISSIndex() {
    return satellites.findIndex(s => s.cat === 'iss' && (s.name.includes('ISS') || s.name.includes('ZARYA')));
  }

  // ── Build Meshes ────────────────────────────────────────
  function buildMeshes(godMode) {
    Globe.satGroup.clear();
    Globe.labelGroup.clear();
    Globe.bracketGroup.clear();
    activeBracket = null;
    satMeshes  = [];
    satLabels  = [];

    satellites.forEach((sat, idx) => {
      // ── Square dot sprite ──
      const isISS   = sat.cat === 'iss';
      const colStr  = dotColorStr(sat.cat, godMode);
      const dotSize = isISS ? 12 : sat.cat === 'debris' ? 5 : 8;
      const tex     = makeDotTex(colStr, dotSize);
      const mat     = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false,
                        opacity: sat.cat === 'debris' ? 0.45 : 0.9 });
      const sprite  = new THREE.Sprite(mat);
      const scale   = isISS ? 0.028 : sat.cat === 'debris' ? 0.007 : sat.cat === 'starlink' ? 0.009 : 0.013;
      sprite.scale.setScalar(scale);
      sprite.userData = { idx, type: 'sat', obj: sat };
      Globe.satGroup.add(sprite);
      satMeshes.push(sprite);

      // ── Floating label ──
      // Format: "SAT-XXXXX" for generic, or name for ISS / named sats
      const labelText = isISS ? 'ISS' : `SAT-${sat.id}`;
      const lc = labelColor(sat.cat, godMode);
      const label = Globe.makeLabelSprite(labelText, lc, 0.55, isISS ? 11 : 9);
      // Position slightly above the dot — offset handled in propagate()
      label.visible = false; // shown when zoom threshold met
      label.userData = { idx, satLabel: true };
      Globe.labelGroup.add(label);
      satLabels.push(label);
    });

    applyCatFilter();
  }

  // ── Apply category filter ───────────────────────────────
  function applyCatFilter() {
    satellites.forEach((sat, idx) => {
      const vis = catFilter[sat.cat] !== false;
      if (satMeshes[idx]) satMeshes[idx].visible = vis;
      if (satLabels[idx]) satLabels[idx].visible  = vis && Globe.zoom <= LABEL_ZOOM_THRESHOLD;
    });
  }

  function setCatFilter(cat, val) {
    catFilter[cat] = val;
    applyCatFilter();
  }

  // ── Propagate ──────────────────────────────────────────
  function propagate(godMode) {
    const now  = new Date();
    const showLabels = Globe.zoom <= LABEL_ZOOM_THRESHOLD;

    satellites.forEach((sat, idx) => {
      try {
        const pv = satellite.propagate(sat.satrec, now);
        if (!pv.position) return;
        const gmst = satellite.gstime(now);
        const geo  = satellite.eciToGeodetic(pv.position, gmst);
        sat.lat = satellite.degreesLat(geo.latitude);
        sat.lon = satellite.degreesLong(geo.longitude);
        sat.alt = geo.height;
        const v = pv.velocity;
        sat.vel = v ? Math.sqrt(v.x ** 2 + v.y ** 2 + v.z ** 2) : 0;

        const r   = 1 + (sat.alt / 6371) * 1.4;
        const pos = Utils.ll2v3(sat.lat, sat.lon, r);

        if (satMeshes[idx]) satMeshes[idx].position.copy(pos);

        // Label floats slightly above dot
        if (satLabels[idx]) {
          const labelR = r + 0.04;
          satLabels[idx].position.copy(Utils.ll2v3(sat.lat, sat.lon, labelR));
          satLabels[idx].visible = catFilter[sat.cat] !== false && showLabels;
        }

        // Update bracket position if this is selected
        if (activeBracket && activeBracket.userData.idx === idx) {
          activeBracket.position.copy(pos);
        }

        if (!trailHist[idx]) trailHist[idx] = [];
        trailHist[idx].push({ lat: sat.lat, lon: sat.lon, alt: sat.alt });
        if (trailHist[idx].length > CONFIG.maxTrailPoints) trailHist[idx].shift();
      } catch (e) {}
    });
  }

  // ── Recolor ────────────────────────────────────────────
  function recolor(godMode) {
    satellites.forEach((sat, idx) => {
      if (!satMeshes[idx]) return;
      const colStr = dotColorStr(sat.cat, godMode);
      const dotSize = sat.cat === 'iss' ? 12 : sat.cat === 'debris' ? 5 : 8;
      satMeshes[idx].material.map = makeDotTex(godMode ? '#ff2020' : colStr, dotSize);
      satMeshes[idx].material.needsUpdate = true;

      if (satLabels[idx]) {
        const lc = labelColor(sat.cat, godMode);
        const labelText = sat.cat === 'iss' ? 'ISS' : `SAT-${sat.id}`;
        satLabels[idx].material.map = Globe.makeLabelSprite(labelText, lc, 0.55, 9).material.map;
        satLabels[idx].material.needsUpdate = true;
      }
    });
  }

  // ── Trail ──────────────────────────────────────────────
  function drawTrail(idx, godMode) {
    Globe.trailGroup.clear();
    const h = trailHist[idx];
    if (!h || h.length < 2) return;
    const pts = h.map(p => Utils.ll2v3(p.lat, p.lon, 1 + (p.alt / 6371) * 1.4));
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    // Yellow trail matching reference screenshots
    const color = godMode ? 0xff2200 : 0xffcc00;
    const mat   = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.6 });
    Globe.trailGroup.add(new THREE.Line(geo, mat));
  }

  // ── Bracket reticle on selected ─────────────────────────
  function showBracket(idx, godMode) {
    // Remove only sat brackets (not aircraft brackets)
    Globe.bracketGroup.children
      .filter(c => !c.userData.airBracket)
      .forEach(c => Globe.bracketGroup.remove(c));
    activeBracket = null;
    if (idx === null || !satMeshes[idx]) return;

    const color  = godMode ? 0xff2020 : 0xffb700;
    const bracket= Globe.makeBracket(0.055, color);
    bracket.position.copy(satMeshes[idx].position);
    bracket.userData = { idx };
    Globe.bracketGroup.add(bracket);
    activeBracket = bracket;

    // Pulsing scale animation on bracket
    let t = 0;
    const pulse = () => {
      if (!activeBracket || activeBracket.userData.idx !== idx) return;
      t += 0.04;
      const s = 1 + Math.sin(t) * 0.08;
      activeBracket.scale.setScalar(s);
      requestAnimationFrame(pulse);
    };
    pulse();
  }

  // ── Threat counts ──────────────────────────────────────
  function getThreatCounts() {
    let leo = 0, meo = 0, geo = 0;
    satellites.forEach(s => {
      const a = s.alt || 400;
      if (a < 2000) leo++; else if (a < 35000) meo++; else geo++;
    });
    return { total: satellites.length, leo, meo, geo };
  }

  // ── Select ─────────────────────────────────────────────
  function select(idx, godMode) {
    // Reset all sizes
    satellites.forEach((sat, i) => {
      if (!satMeshes[i]) return;
      satMeshes[i].scale.setScalar(1);
    });
    // Enlarge selected
    if (satMeshes[idx]) {
      const s = satellites[idx].cat === 'iss' ? 2.5 : 2;
      satMeshes[idx].scale.setScalar(s);
    }
    showBracket(idx, godMode);
    const sat = satellites[idx];
    if (sat && sat.lat !== undefined) {
      Globe.rotY = (-sat.lon - 90) * Math.PI / 180;
      Globe.rotX = -sat.lat * Math.PI / 180 * 0.4;
    }
  }

  return {
    get list()      { return satellites; },
    set list(v)     { satellites = v; },
    get meshes()    { return satMeshes; },
    get labels()    { return satLabels; },
    get trails()    { return trailHist; },
    get issData()   { return issData; },
    get catFilter() { return catFilter; },
    parseTLEs, fetchAll, fetchISSData, getISSIndex,
    buildMeshes, propagate, recolor, drawTrail, showBracket,
    getThreatCounts, select,
    catColor, catLabel, catClass, catIcon, catMeta,
    setCatFilter, applyCatFilter,
    get LABEL_ZOOM_THRESHOLD() { return LABEL_ZOOM_THRESHOLD; },
  };
})();
