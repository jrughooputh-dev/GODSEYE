// ═══════════════════════════════════════════════════════════
//  GODS EYE — SATELLITES MODULE v5.3
//  Crisp Point dots (no blurry sprite upscaling)
//  Labels only at zoom ≤ 2.3, adjust to zoom level
//  Isolate mode — hide all other sats when tracking one
//  Blinking bracket on selected
// ═══════════════════════════════════════════════════════════

const Satellites = (() => {
  let satellites   = [];
  let satMeshes    = [];   // THREE.Sprite per sat
  let satLabels    = [];   // label sprites
  let activeBracket = null;
  const trailHist  = {};

  let selectedIdx  = null;  // currently tracked sat index
  let isolateMode  = false; // hide all others when tracking

  // ── ISS ────────────────────────────────────────────────
  let issData = { crew: [], fetching: false };

  // ── Category filters ───────────────────────────────────
  const catFilter = {
    iss: true, starlink: true, weather: true, nav: true,
    science: true, iridium: true, debris: true, other: true,
  };

  // ── Label zoom threshold ───────────────────────────────
  const LABEL_ZOOM_THRESHOLD = 2.3;

  // ── Dot texture cache — uses NearestFilter to stay crisp ─
  const dotTexCache = {};

  function makeDotTex(color, pxSize = 16) {
    const key = color + pxSize;
    if (dotTexCache[key]) return dotTexCache[key];
    const cv = document.createElement('canvas');
    // Use larger canvas so filter doesn't blur it — 32px
    const sz = 32;
    cv.width = cv.height = sz;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, sz, sz);
    // Draw a clean square in the center at full size
    const pad = Math.floor(sz * 0.15);
    ctx.fillStyle = color;
    ctx.fillRect(pad, pad, sz - pad * 2, sz - pad * 2);
    const tex = new THREE.CanvasTexture(cv);
    // CRITICAL: NearestFilter prevents blurry upscaling
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
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
          const sr    = satellite.twoline2satrec(lines[i + 1], lines[i + 2]);
          const rawId = parseInt(lines[i + 1].substring(2, 7).trim(), 10);
          sats.push({
            name: lines[i].trim(), tle1: lines[i + 1], tle2: lines[i + 2],
            satrec: sr, cat,
            id: isNaN(rawId) ? Math.floor(Math.random() * 99999) : rawId
          });
          i += 2;
        } catch (e) {}
      }
    }
    return sats;
  }

  // ── Category helpers ────────────────────────────────────
  function catMeta(cat) { return CONFIG.catMeta[cat] || CONFIG.catMeta.other; }
  function catColor(cat, god) { return god ? catMeta(cat).godColor : catMeta(cat).color; }
  function catLabel(cat) { return catMeta(cat).label; }
  function catClass(cat) { return catMeta(cat).cssClass; }
  function catIcon(cat)  { return catMeta(cat).icon; }

  function dotColorStr(cat, god) {
    const hex = catColor(cat, god);
    return '#' + hex.toString(16).padStart(6, '0');
  }

  function labelColor(cat, god) {
    if (god) return '#00ffcc';
    return { iss:'#ffb700', starlink:'#00f5ff', weather:'#88ffcc',
      nav:'#ffcc88', science:'#cc88ff', iridium:'#aaaaff',
      debris:'#666688', other:'#00ff88' }[cat] || '#ffb700';
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
        else if (n.includes('NOAA')||n.includes('GOES'))  s.cat = 'weather';
        else if (n.includes('GPS')||n.includes('GLONASS'))s.cat = 'nav';
        else s.cat = 'science';
      });
      return { sats: allSats, fallback: true };
    }
    return { sats: allSats, fallback: false };
  }

  // ── ISS Crew ───────────────────────────────────────────
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

  // ── Cross/plus pixel marker texture ─────────────────────
  // Matches the reference screenshot — small bright + shape
  const crossTexCache = {};

  function makeCrossTex(color, sz = 32) {
    const key = color + sz;
    if (crossTexCache[key]) return crossTexCache[key];
    const cv  = document.createElement('canvas');
    cv.width  = cv.height = sz;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, sz, sz);
    const cx = sz / 2, arm = Math.floor(sz * 0.38), w = Math.max(2, Math.floor(sz * 0.13));
    ctx.fillStyle = color;
    // Horizontal bar
    ctx.fillRect(cx - arm, cx - w/2, arm * 2, w);
    // Vertical bar
    ctx.fillRect(cx - w/2, cx - arm, w, arm * 2);
    const tex = new THREE.CanvasTexture(cv);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    crossTexCache[key] = tex;
    return tex;
  }

  // Label sprite — clean text only, no emoji prefix
  function makeSatLabelTex(text, color, fontSize = 9) {
    const cv  = document.createElement('canvas');
    const ctx = cv.getContext('2d');
    ctx.font  = `${fontSize}px "Share Tech Mono", monospace`;
    const tw  = ctx.measureText(text).width;
    const pad = 3;
    cv.width  = Math.ceil(tw + pad * 2);
    cv.height = fontSize + pad * 2;
    ctx.font  = `${fontSize}px "Share Tech Mono", monospace`;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = color;
    ctx.textBaseline = 'middle';
    ctx.fillText(text, pad, cv.height / 2 + 1);
    const tex = new THREE.CanvasTexture(cv);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const spr = new THREE.Sprite(mat);
    const h = 0.038;
    spr.scale.set((cv.width / cv.height) * h, h, 1);
    return spr;
  }

  // ── Build Meshes ────────────────────────────────────────
  function buildMeshes(godMode) {
    Globe.satGroup.clear();
    Globe.labelGroup.children.filter(c => c.userData.satLabel).forEach(c => Globe.labelGroup.remove(c));
    Globe.bracketGroup.children.filter(c => !c.userData.airBracket).forEach(c => Globe.bracketGroup.remove(c));
    activeBracket = null;
    satMeshes = [];
    satLabels = [];

    satellites.forEach((sat, idx) => {
      const isISS = sat.cat === 'iss';
      // Color by category — matching reference green/yellow dot palette
      const colStr = dotColorStr(sat.cat, godMode);
      const dotSz  = isISS ? 32 : sat.cat === 'debris' ? 16 : 24;
      const tex    = makeCrossTex(colStr, dotSz);
      const mat    = new THREE.SpriteMaterial({
        map: tex, transparent: true, depthTest: false,
        opacity: sat.cat === 'debris' ? 0.3 : isISS ? 1.0 : 0.85,
      });
      const sprite = new THREE.Sprite(mat);
      // World-space scale — ISS slightly larger, debris tiny
      const scale  = isISS ? 0.014 : sat.cat === 'debris' ? 0.004 : 0.007;
      sprite.scale.setScalar(scale);
      sprite.userData = { idx, type: 'sat', obj: sat };
      Globe.satGroup.add(sprite);
      satMeshes.push(sprite);

      // Text label — shown only when zoomed in
      const labelText = isISS ? 'ISS' : sat.name.length <= 16 ? sat.name : `SAT-${sat.id}`;
      const lc    = labelColor(sat.cat, godMode);
      const label = makeSatLabelTex(labelText, lc, isISS ? 10 : 8);
      label.visible = false;
      label.userData = { idx, satLabel: true };
      Globe.labelGroup.add(label);
      satLabels.push(label);
    });

    applyCatFilter();
  }

  // ── Apply category + isolate filter ────────────────────
  function applyCatFilter() {
    const showLabels = Globe.zoom <= LABEL_ZOOM_THRESHOLD;
    satellites.forEach((sat, idx) => {
      const catVis = catFilter[sat.cat] !== false;
      // In isolate mode, only show the selected sat
      const isoVis = !isolateMode || idx === selectedIdx;
      const vis    = catVis && isoVis;
      if (satMeshes[idx]) satMeshes[idx].visible = vis;
      if (satLabels[idx]) satLabels[idx].visible  = vis && showLabels;
    });
  }

  function setCatFilter(cat, val) {
    catFilter[cat] = val;
    applyCatFilter();
  }

  // ── Propagate positions ─────────────────────────────────
  function propagate(godMode) {
    const now        = new Date();
    const showLabels = Globe.zoom <= LABEL_ZOOM_THRESHOLD;
    // Scale label size with zoom — bigger labels when zoomed in more
    const labelScale = Math.max(0.6, Math.min(1.4, 2.3 / Math.max(Globe.zoom, 0.5)));

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

        if (satLabels[idx]) {
          satLabels[idx].position.copy(Utils.ll2v3(sat.lat, sat.lon, r + 0.035));
          const catVis = catFilter[sat.cat] !== false;
          const isoVis = !isolateMode || idx === selectedIdx;
          satLabels[idx].visible = catVis && isoVis && showLabels;
          // Scale labels with zoom
          if (showLabels) {
            const base = sat.cat === 'iss' ? 0.055 : 0.04;
            satLabels[idx].scale.setScalar(base * labelScale);
          }
        }

        // Keep bracket on selected sat
        if (activeBracket && activeBracket.userData.idx === idx) {
          activeBracket.position.copy(pos);
        }

        if (!trailHist[idx]) trailHist[idx] = [];
        trailHist[idx].push({ lat: sat.lat, lon: sat.lon, alt: sat.alt });
        if (trailHist[idx].length > CONFIG.maxTrailPoints) trailHist[idx].shift();
      } catch (e) {}
    });
  }

  // ── Recolor (no rebuild) ───────────────────────────────
  function recolor(godMode) {
    // Emoji sprites don't change color — just opacity for debris in god mode
    // In god mode all emojis stay the same (🛰️/📡) — no swap needed
    satellites.forEach((sat, idx) => {
      if (!satMeshes[idx]) return;
      satMeshes[idx].material.opacity = sat.cat === 'debris' ? 0.25 : (godMode ? 0.7 : 1.0);
      satMeshes[idx].material.needsUpdate = true;
    });
  }

  // ── Trail ──────────────────────────────────────────────
  function drawTrail(idx, godMode) {
    Globe.trailGroup.clear();
    const h = trailHist[idx];
    if (!h || h.length < 2) return;
    const pts = h.map(p => Utils.ll2v3(p.lat, p.lon, 1 + (p.alt / 6371) * 1.4));
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({
      color: godMode ? 0x00ffcc : 0xffcc00, transparent: true, opacity: 0.55
    });
    Globe.trailGroup.add(new THREE.Line(geo, mat));
  }

  // ── Bracket reticle ────────────────────────────────────
  function showBracket(idx, godMode) {
    Globe.bracketGroup.children.filter(c => !c.userData.airBracket).forEach(c => Globe.bracketGroup.remove(c));
    activeBracket = null;
    if (idx === null || !satMeshes[idx]) return;

    const color  = godMode ? 0x00ffcc : 0xffb700;
    const bracket = Globe.makeBracket(0.05, color);
    bracket.position.copy(satMeshes[idx].position);
    bracket.userData = { idx };
    Globe.bracketGroup.add(bracket);
    activeBracket = bracket;

    let t = 0;
    const pulse = () => {
      if (!activeBracket || activeBracket.userData.idx !== idx) return;
      t += 0.05;
      activeBracket.scale.setScalar(1 + Math.sin(t) * 0.1);
      requestAnimationFrame(pulse);
    };
    pulse();
  }

  // ── Select + isolate + zoom ─────────────────────────────
  function select(idx, godMode) {
    selectedIdx = idx;

    // Reset all cross sprite sizes first
    satellites.forEach((_, i) => {
      if (!satMeshes[i]) return;
      const s = satellites[i];
      satMeshes[i].scale.setScalar(
        s.cat === 'iss' ? 0.014 : s.cat === 'debris' ? 0.004 : 0.007
      );
    });

    if (idx === null) {
      // DESELECT — exit isolate mode, restore all
      isolateMode = false;
      Globe.trailGroup.clear();
      Globe.bracketGroup.children.filter(c => !c.userData.airBracket).forEach(c => Globe.bracketGroup.remove(c));
      activeBracket = null;
      applyCatFilter();
      return;
    }

    // Enlarge selected cross marker slightly
    if (satMeshes[idx]) {
      const base = satellites[idx].cat === 'iss' ? 0.014 : 0.007;
      satMeshes[idx].scale.setScalar(base * 2.0);
    }

    // Isolate: hide all others
    isolateMode = true;
    applyCatFilter();

    // Force label visible on selected regardless of zoom
    if (satLabels[idx]) satLabels[idx].visible = true;

    // Auto-zoom to 2.0
    Globe.zoom = 2.0;
    const zlbl = document.getElementById('zlabel');
    if (zlbl) zlbl.textContent = 'ZOOM: 2.0x';

    // Rotate globe to centre on sat
    const sat = satellites[idx];
    if (sat && sat.lat !== undefined) {
      Globe.rotY = (-sat.lon - 90) * Math.PI / 180;
      Globe.rotX = -sat.lat * Math.PI / 180 * 0.4;
      Globe.autoRot = false;
    }

    showBracket(idx, godMode);
  }

  // ── Deselect ───────────────────────────────────────────
  function deselect() {
    select(null, false);
    selectedIdx = null;
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

  return {
    get list()       { return satellites; },
    set list(v)      { satellites = v; },
    get meshes()     { return satMeshes; },
    get labels()     { return satLabels; },
    get trails()     { return trailHist; },
    get issData()    { return issData; },
    get catFilter()  { return catFilter; },
    get selectedIdx(){ return selectedIdx; },
    get isolateMode(){ return isolateMode; },
    parseTLEs, fetchAll, fetchISSData, getISSIndex,
    buildMeshes, propagate, recolor, drawTrail, showBracket,
    getThreatCounts, select, deselect, applyCatFilter, setCatFilter,
    catColor, catLabel, catClass, catIcon, catMeta,
    get LABEL_ZOOM_THRESHOLD() { return LABEL_ZOOM_THRESHOLD; },
  };
})();
