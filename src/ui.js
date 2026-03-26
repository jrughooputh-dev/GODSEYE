// ═══════════════════════════════════════════════════════════
//  GODS EYE — UI MODULE v5.2
//  Palantir-style dossier panel, DATA LAYERS panel,
//  Unified search + filters, bracket reticle integration
// ═══════════════════════════════════════════════════════════

const UI = (() => {
  let selectedIdx  = null, selectedType = 'sat';
  let godMode      = false;
  let layerSat     = true, layerAir = true;
  let shaderMode   = 'normal';
  let radarOpen    = false;

  // ── Active search/filter state ────────────────────────────
  let searchQuery  = '';
  let filterType   = 'all';   // 'all' | 'sat' | 'air' | 'mil'
  let filterCountry= '';

  // ── Targeting canvas ──────────────────────────────────────
  let tcanvas, tctx, targetAnimFrame = null;

  function initTargeting() {
    tcanvas = document.getElementById('targets-canvas');
    resizeTargets();
    window.addEventListener('resize', resizeTargets);
  }
  function resizeTargets() {
    if (!tcanvas) return;
    tcanvas.width  = Globe.wrap.clientWidth;
    tcanvas.height = Globe.wrap.clientHeight;
  }

  // ── GOD VIEW targeting animation ─────────────────────────
  function drawTargets() {
    if (targetAnimFrame) cancelAnimationFrame(targetAnimFrame);
    resizeTargets();
    tctx = tcanvas.getContext('2d');
    let t = 0;
    function loop() {
      if (!godMode) { clearTargets(); return; }
      targetAnimFrame = requestAnimationFrame(loop);
      t += 0.5;
      tctx.clearRect(0, 0, tcanvas.width, tcanvas.height);

      if (selectedType === 'sat' && selectedIdx !== null && Satellites.meshes[selectedIdx]) {
        const pos    = Satellites.meshes[selectedIdx].position.clone();
        const screen = Utils.worldToScreen(pos, Globe.rotX, Globe.rotY, Globe.camera, tcanvas.width, tcanvas.height);
        if (screen) _drawTargetReticle(screen, t, Satellites.list[selectedIdx]?.name || '');
      }

      // Ambient rings
      const numRings = Math.min(6, Satellites.list.length);
      for (let i = 0; i < numRings; i++) {
        const idx = Math.floor((i / numRings) * Satellites.list.length);
        if (!Satellites.meshes[idx]) continue;
        const pos = Satellites.meshes[idx].position.clone();
        const sc  = Utils.worldToScreen(pos, Globe.rotX, Globe.rotY, Globe.camera, tcanvas.width, tcanvas.height);
        if (!sc) continue;
        const phase = t * 0.04 + i * 0.9;
        const r = 10 + Math.sin(phase) * 4;
        const alpha = 0.07 + Math.sin(phase) * 0.04;
        tctx.strokeStyle = `rgba(0,255,${180 + i * 5},${alpha})`;
        tctx.lineWidth = 0.5;
        tctx.beginPath(); tctx.arc(sc.x, sc.y, r, 0, Math.PI * 2); tctx.stroke();
      }
    }
    loop();
  }

  function _drawTargetReticle(screen, t, name) {
    const pulse = 24 + Math.sin(t * 0.06) * 6;
    const alpha = 0.7 + Math.sin(t * 0.05) * 0.2;
    tctx.save();
    tctx.translate(screen.x, screen.y);
    tctx.rotate(t * 0.008);
    tctx.strokeStyle = `rgba(0,255,204,${alpha * 0.4})`;
    tctx.lineWidth = 1; tctx.setLineDash([6, 10]);
    tctx.beginPath(); tctx.arc(0, 0, pulse * 2.8, 0, Math.PI * 2); tctx.stroke();
    tctx.setLineDash([]);
    tctx.restore();
    tctx.strokeStyle = `rgba(0,255,200,${alpha})`; tctx.lineWidth = 1.5;
    tctx.beginPath(); tctx.arc(screen.x, screen.y, pulse, 0, Math.PI * 2); tctx.stroke();
    const arm = pulse * 2.2, gap = pulse * 1.15;
    tctx.strokeStyle = `rgba(0,240,200,${alpha * 0.8})`; tctx.lineWidth = 1;
    [[screen.x - arm, screen.y, screen.x - gap, screen.y],
     [screen.x + gap, screen.y, screen.x + arm, screen.y],
     [screen.x, screen.y - arm, screen.x, screen.y - gap],
     [screen.x, screen.y + gap, screen.x, screen.y + arm]].forEach(([x1,y1,x2,y2]) => {
       tctx.beginPath(); tctx.moveTo(x1, y1); tctx.lineTo(x2, y2); tctx.stroke();
     });
    tctx.fillStyle = `rgba(0,255,204,${alpha})`;
    tctx.font = '8px "Orbitron", monospace';
    tctx.fillText('TARGET LOCKED', screen.x + pulse * 1.3, screen.y - 8);
    tctx.fillStyle = `rgba(0,220,180,0.7)`;
    tctx.font = '7px "Share Tech Mono", monospace';
    tctx.fillText(name, screen.x + pulse * 1.3, screen.y + 6);
  }

  function clearTargets() {
    if (targetAnimFrame) cancelAnimationFrame(targetAnimFrame);
    if (tctx) tctx.clearRect(0, 0, tcanvas.width, tcanvas.height);
  }

  // ── GOD VIEW ─────────────────────────────────────────────
  function toggleGodView() {
    godMode = !godMode;
    const btn   = document.getElementById('god-btn');
    const flash = document.getElementById('god-flash');
    flash.style.opacity = '0.7';
    setTimeout(() => { flash.style.opacity = '0'; }, 150);

    if (godMode) {
      btn.classList.add('active');
      btn.textContent = '☢ GOD VIEW — ACTIVE';
      document.body.classList.add('godview');
      document.getElementById('god-overlay').classList.add('on');
      document.getElementById('gl-tl').textContent = '⚠ GLOBAL THREAT ASSESSMENT — ACTIVE';
      document.getElementById('gl-br').textContent = 'DEFCON STATUS: ELEVATED';
      document.getElementById('main-title').innerHTML = 'GODS<em> EYE</em> // <span style="color:#00ffcc;text-shadow:0 0 18px rgba(0,255,204,.8)">GOD VIEW — WAR MODE</span>';
      document.getElementById('ftr-label').textContent = 'GODS EYE v5.2 // GOD VIEW ACTIVE // ALL OBJECTS FLAGGED AS THREATS';
      document.getElementById('rph-label').textContent = '// THREAT TELEMETRY';
      document.getElementById('panel-label').textContent = '// THREAT OBJECTS';
      Globe.enterGodView();
      Satellites.recolor(true);
      Aircraft.recolor(true);
      updateThreatCounts();
      renderGodDashboard();
      drawTargets();
    } else {
      btn.classList.remove('active');
      btn.textContent = '☠ GOD VIEW';
      document.body.classList.remove('godview');
      document.getElementById('god-overlay').classList.remove('on');
      document.getElementById('gl-tl').textContent = 'GLOBAL SURVEILLANCE NETWORK';
      document.getElementById('gl-br').textContent = 'SRC: CELESTRAK · OPENSKY · ADS-B';
      document.getElementById('main-title').innerHTML = 'GODS<em> EYE</em> // WORLDVIEW OPERATIONS CENTER';
      document.getElementById('ftr-label').textContent = 'GODS EYE v5.2 // UNCLASSIFIED // PUBLIC DATA ONLY';
      document.getElementById('rph-label').textContent = '// OBJECT TELEMETRY';
      document.getElementById('panel-label').textContent = '// TRACKED OBJECTS';
      Globe.exitGodView();
      Satellites.recolor(false);
      Aircraft.recolor(false);
      clearTargets();
      document.getElementById('god-dashboard').innerHTML = '';
    }
  }

  function updateThreatCounts() {
    const c = Satellites.getThreatCounts();
    document.getElementById('t-threats').textContent = c.total + Aircraft.list.length;
    document.getElementById('t-leo').textContent = c.leo;
    document.getElementById('t-meo').textContent = c.meo;
    document.getElementById('t-geo').textContent = c.geo;
  }

  // ── GOD VIEW Dashboard ────────────────────────────────────
  function renderGodDashboard() {
    const el = document.getElementById('god-dashboard');
    if (!el) return;
    const c  = Satellites.getThreatCounts();
    const milCount = Aircraft.list.filter(a => a.military).length;

    el.innerHTML = `
      <div class="gd-section">
        <div class="gd-stamp">// THREAT ASSESSMENT ACTIVE</div>
        <div class="gd-stamp-sub">TS // SI-TK // NOFORN</div>
      </div>
      <div class="gd-cards">
        <div class="gd-card gd-card-primary">
          <div class="gd-card-icon">🛰️</div>
          <div class="gd-card-val">${c.total.toLocaleString()}</div>
          <div class="gd-card-label">SATELLITES</div>
        </div>
        <div class="gd-card">
          <div class="gd-card-icon">✈️</div>
          <div class="gd-card-val">${Aircraft.list.length.toLocaleString()}</div>
          <div class="gd-card-label">AIRCRAFT</div>
        </div>
        <div class="gd-card gd-card-alert">
          <div class="gd-card-icon">🪖</div>
          <div class="gd-card-val">${milCount}</div>
          <div class="gd-card-label">MILITARY</div>
        </div>
      </div>
      <div class="gd-orbit-table">
        <div class="gd-orbit-row">
          <span class="gd-orbit-label">LEO <span class="gd-orbit-sub">&lt;2000km</span></span>
          <div class="gd-orbit-bar-wrap"><div class="gd-orbit-bar" style="width:${Math.min(100,(c.leo/Math.max(c.total,1))*100).toFixed(1)}%"></div></div>
          <span class="gd-orbit-val">${c.leo}</span>
        </div>
        <div class="gd-orbit-row">
          <span class="gd-orbit-label">MEO <span class="gd-orbit-sub">2k–35k</span></span>
          <div class="gd-orbit-bar-wrap"><div class="gd-orbit-bar gd-orbit-bar-meo" style="width:${Math.min(100,(c.meo/Math.max(c.total,1))*100).toFixed(1)}%"></div></div>
          <span class="gd-orbit-val">${c.meo}</span>
        </div>
        <div class="gd-orbit-row">
          <span class="gd-orbit-label">GEO <span class="gd-orbit-sub">&gt;35k</span></span>
          <div class="gd-orbit-bar-wrap"><div class="gd-orbit-bar gd-orbit-bar-geo" style="width:${Math.min(100,(c.geo/Math.max(c.total,1))*100).toFixed(1)}%"></div></div>
          <span class="gd-orbit-val">${c.geo}</span>
        </div>
      </div>
      <div class="gd-defcon">
        <span class="gd-defcon-label">DEFCON</span>
        <div class="gd-defcon-lights">
          ${[1,2,3,4,5].map(n => `<div class="gd-defcon-light ${n >= 3 ? 'gd-defcon-active' : ''}">${n}</div>`).join('')}
        </div>
      </div>
      <div class="gd-ticker"><span class="gd-ticker-label">SYS</span><span class="gd-ticker-msg">ALL TRACKING SYSTEMS NOMINAL · ORBITAL PROPAGATION ACTIVE · ADS-B FEED LIVE · TLE UPDATE PENDING</span></div>`;
  }

  // ── DATA LAYERS panel ────────────────────────────────────
  function buildDataLayers() {
    const el = document.getElementById('data-layers-body');
    if (!el) return;
    const milCount = Aircraft.list.filter(a => a.military).length;
    const satCount = Satellites.list.length;
    const acCount  = Aircraft.list.length;
    const now      = new Date().toUTCString().slice(17, 25) + ' UTC';

    el.innerHTML = `
      <div class="dl-row ${layerSat ? 'on' : ''}" onclick="UI.toggleLayer('sat')" title="Toggle satellites">
        <div class="dl-icon">🛰️</div>
        <div class="dl-info">
          <div class="dl-name">Satellites</div>
          <div class="dl-src">CelesTrak · ${now}</div>
        </div>
        <div class="dl-count">${satCount}</div>
        <div class="dl-toggle ${layerSat ? 'on' : 'off'}">${layerSat ? 'ON' : 'OFF'}</div>
      </div>
      <div class="dl-row ${layerAir ? 'on' : ''}" onclick="UI.toggleLayer('air')" title="Toggle live flights">
        <div class="dl-icon">✈️</div>
        <div class="dl-info">
          <div class="dl-name">Live Flights</div>
          <div class="dl-src">OpenSky Network · ${layerAir ? now : 'never'}</div>
        </div>
        <div class="dl-count">${layerAir ? acCount : '—'}</div>
        <div class="dl-toggle ${layerAir ? 'on' : 'off'}">${layerAir ? 'ON' : 'OFF'}</div>
      </div>
      <div class="dl-row ${layerAir ? 'on' : 'dim'}" onclick="UI.toggleMilitary()" title="Military flights via ADS-B Exchange">
        <div class="dl-icon">🪖</div>
        <div class="dl-info">
          <div class="dl-name">Military Flights</div>
          <div class="dl-src">ADS-B Exchange · prefix detect</div>
        </div>
        <div class="dl-count">${layerAir ? milCount : '—'}</div>
        <div class="dl-toggle ${layerAir && milCount > 0 ? 'on' : 'off'}">${layerAir && milCount > 0 ? 'ON' : 'OFF'}</div>
      </div>
      <div class="dl-row off" onclick="" title="Coming soon">
        <div class="dl-icon">🌍</div>
        <div class="dl-info">
          <div class="dl-name">Country Borders</div>
          <div class="dl-src">GeoJSON · coming soon</div>
        </div>
        <div class="dl-count">—</div>
        <div class="dl-toggle off">OFF</div>
      </div>`;
  }

  // ── Category Filter Panel ─────────────────────────────────
  function buildCatFilterPanel() {
    const el = document.getElementById('cat-filters');
    if (!el) return;
    const cats = Object.keys(CONFIG.catMeta).filter(c => c !== 'aircraft');
    el.innerHTML = cats.map(cat => {
      const meta = CONFIG.catMeta[cat];
      return `<div class="cfitem" data-cat="${cat}" onclick="UI.toggleCatFilter('${cat}')" title="${meta.purpose}">
        <span class="cficon">${meta.icon}</span>
        <span class="cflabel">${meta.label}</span>
      </div>`;
    }).join('');
  }

  function toggleCatFilter(cat) {
    Satellites.setCatFilter(cat, !Satellites.catFilter[cat]);
    const el = document.querySelector(`.cfitem[data-cat="${cat}"]`);
    if (el) el.classList.toggle('off', !Satellites.catFilter[cat]);
    buildList();
  }

  // ── Layers ────────────────────────────────────────────────
  function toggleLayer(type) {
    if (type === 'sat') {
      layerSat = !layerSat;
      Globe.satGroup.visible  = layerSat;
      Globe.labelGroup.children.filter(c => c.userData.satLabel).forEach(c => { c.visible = layerSat && Globe.zoom <= Satellites.LABEL_ZOOM_THRESHOLD; });
    } else if (type === 'air') {
      layerAir = !layerAir;
      Globe.airGroup.visible = layerAir;
      if (layerAir && Aircraft.list.length === 0) {
        Aircraft.fetch().then(ok => {
          if (ok) { Aircraft.buildMeshes(godMode); Aircraft.place(); buildList(); }
          document.getElementById('adot').style.boxShadow = ok ? '0 0 5px #00f5ff' : 'none';
          document.getElementById('acnt').textContent = ok ? Aircraft.list.length + ' ACFT' : 'ACFT OFFLINE';
          buildDataLayers();
        });
        // Also try military feed
        Aircraft.fetchMilitary().then(() => { buildDataLayers(); buildList(); });
      }
    } else if (type === 'nvg') {
      shaderMode = shaderMode === 'nvg' ? 'normal' : 'nvg';
      document.getElementById('tog-nvg').classList.toggle('on', shaderMode === 'nvg');
      document.getElementById('tog-flir').classList.remove('on');
      applyShader();
    } else if (type === 'flir') {
      shaderMode = shaderMode === 'flir' ? 'normal' : 'flir';
      document.getElementById('tog-flir').classList.toggle('on', shaderMode === 'flir');
      document.getElementById('tog-nvg').classList.remove('on');
      applyShader();
    }
    buildDataLayers();
  }

  function toggleMilitary() {
    if (!layerAir) { toggleLayer('air'); return; }
    Aircraft.fetchMilitary().then(count => {
      Aircraft.buildMeshes(godMode);
      Aircraft.place();
      buildList();
      buildDataLayers();
    });
  }

  function applyShader() {
    const ov = document.getElementById('shader-overlay');
    Globe.canvas.className = '';
    ov.className = '';
    if (shaderMode === 'nvg')  { ov.classList.add('nvg');  Globe.canvas.classList.add('nvg'); }
    else if (shaderMode === 'flir') { ov.classList.add('flir'); Globe.canvas.classList.add('flir'); }
  }

  // ── Radar ─────────────────────────────────────────────────
  function toggleRadar() {
    radarOpen = !radarOpen;
    const panel = document.getElementById('radar-panel');
    const btn   = document.getElementById('radar-btn');
    if (radarOpen) {
      panel.classList.add('open');
      btn.classList.add('active');
      Radar.activate(godMode);
    } else {
      panel.classList.remove('open');
      btn.classList.remove('active');
      Radar.deactivate();
    }
  }

  // ── Unified Search + Filters ─────────────────────────────
  function setSearchQuery(q) {
    searchQuery = q;
    buildList();
  }

  function setFilterType(type) {
    filterType = type;
    // Update filter pill UI
    document.querySelectorAll('.filter-pill').forEach(p => {
      p.classList.toggle('active', p.dataset.filter === type);
    });
    buildList();
  }

  function setFilterCountry(country) {
    filterCountry = country.trim().toUpperCase();
    buildList();
  }

  // ── List ──────────────────────────────────────────────────
  function buildList() {
    const el = document.getElementById('list');
    el.innerHTML = '';
    const q = searchQuery.toUpperCase();
    let n = 0;

    const allItems = [
      ...Satellites.list.map((s, i) => ({
        name: s.name, cat: s.cat, id: s.id,
        country: '', military: false,
        _type: 'sat', _idx: i,
      })),
      ...(layerAir ? Aircraft.list.map((a, i) => ({
        name: (a.callsign || 'UNKNOWN').trim(),
        cat: 'aircraft', id: a.icao24,
        country: (a.origin_country || '').toUpperCase(),
        military: a.military || false,
        _type: 'air', _idx: i,
      })) : []),
    ];

    allItems.forEach(obj => {
      // Type filter
      if (filterType === 'sat' && obj._type !== 'sat') return;
      if (filterType === 'air' && obj._type !== 'air') return;
      if (filterType === 'mil' && !obj.military) return;
      // Country filter
      if (filterCountry && obj.country && !obj.country.includes(filterCountry)) return;
      // Category filter (satellites)
      if (obj._type === 'sat' && Satellites.catFilter[obj.cat] === false) return;
      // Text search
      if (q && !obj.name.toUpperCase().includes(q) && !String(obj.id).includes(q)) return;

      n++;
      if (n > CONFIG.listRenderCap) return;

      const isSel = obj._type === selectedType && obj._idx === selectedIdx;
      const meta  = CONFIG.catMeta[obj.cat] || CONFIG.catMeta.other;
      const div   = document.createElement('div');
      div.className = 'sitem' + (isSel ? ' sel' : '') + (obj.military ? ' mil' : '');

      const milBadge = obj.military ? '<span class="mil-badge">🪖 MIL</span>' : '';
      div.innerHTML = `
        <div class="sitem-icon">${obj._type === 'air' ? (obj.military ? '🪖' : '✈️') : meta.icon}</div>
        <div class="sitem-info">
          <div class="sname">${obj.name}${milBadge}</div>
          <div class="sid">${obj._type === 'sat' ? 'NORAD:' + obj.id : 'ICAO:' + obj.id}${obj.country ? ' · ' + obj.country : ''}</div>
        </div>
        <div class="cbadge ${meta.cssClass}">${meta.label}</div>`;
      div.addEventListener('click', () => { obj._type === 'sat' ? selectSat(obj._idx) : selectAir(obj._idx); });
      el.appendChild(div);
    });

    document.getElementById('lcount').textContent = n;
  }

  // ── Select Satellite ──────────────────────────────────────
  function selectSat(idx) {
    selectedIdx = idx; selectedType = 'sat';
    buildList();
    const sat = Satellites.list[idx];
    if (sat && sat.cat === 'iss') showISSPanel(idx);
    else updateDetail();
    Satellites.drawTrail(idx, godMode);
    Satellites.select(idx, godMode);
    // Clear aircraft brackets
    Globe.bracketGroup.children.filter(c => c.userData.airBracket).forEach(c => Globe.bracketGroup.remove(c));
    // Show untrack button + DOM blinking bracket
    const _satName = sat ? (sat.name.length > 18 ? `SAT-${sat.id}` : sat.name) : '';
    showUntrackBtn('sat', _satName);
    if (typeof TrackBracket !== 'undefined') TrackBracket.show('sat', idx, _satName);
  }

  // ── Deselect / Untrack ────────────────────────────────────
  function deselect() {
    selectedIdx  = null;
    selectedType = 'sat';
    Satellites.deselect();
    Aircraft.showBracket(null, godMode);
    Globe.bracketGroup.clear();
    Globe.trailGroup.clear();
    Globe.autoRot = false;
    // Reset right panel
    document.getElementById('dname').innerHTML = '<span style="color:var(--cd);font-size:9px;letter-spacing:2px;opacity:.5">AWAITING TARGET LOCK</span>';
    document.getElementById('dbody').innerHTML = '<div class="nosel">&gt; SELECT OBJECT FROM LIST<br>&gt; OR CLICK ICON ON GLOBE<br>&gt; DRAG TO ROTATE · SCROLL TO ZOOM<br>&gt; <kbd style="border:1px solid var(--bo);padding:1px 5px;font-size:8px">ESC</kbd> TO UNTRACK</div>';
    document.getElementById('poslabel').textContent = 'LAT: -- LON: --';
    hideUntrackBtn();
    if (typeof TrackBracket !== 'undefined') TrackBracket.hide();
    buildList();
  }

  // ── Untrack button ────────────────────────────────────────
  function showUntrackBtn(type, name) {
    let btn = document.getElementById('untrack-btn');
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'untrack-btn';
      btn.onclick = () => deselect();
      document.getElementById('gw').appendChild(btn);
    }
    btn.innerHTML = `✕ UNTRACK ${name}`;
    btn.style.cssText = `
      position:absolute; bottom:40px; left:50%; transform:translateX(-50%);
      font-family:var(--fd); font-size:8px; letter-spacing:2px;
      padding:6px 16px; border:1px solid var(--c); color:var(--c);
      background:rgba(0,0,0,.85); cursor:pointer; z-index:20;
      clip-path:polygon(6px 0%,100% 0%,calc(100% - 6px) 100%,0% 100%);
      box-shadow:0 0 12px rgba(0,245,255,.25); backdrop-filter:blur(8px);
      transition:all .2s;
    `;
  }

  function hideUntrackBtn() {
    const btn = document.getElementById('untrack-btn');
    if (btn) btn.remove();
  }

  // ── ISS Panel ─────────────────────────────────────────────
  async function showISSPanel(idx) {
    const sat = Satellites.list[idx];
    if (!sat) return;
    document.getElementById('dname').innerHTML = _issNameHTML();
    document.getElementById('dbody').innerHTML = `<div class="iss-loading"><div class="iss-loading-dot"></div><span>FETCHING CREW DATA...</span></div>`;
    await Satellites.fetchISSData();
    const lat = sat.lat ?? 0, lon = sat.lon ?? 0, alt = sat.alt ?? 400, vel = sat.vel ?? 0;
    const speedKmh = (vel * 3600).toFixed(0);
    const speedKms = vel.toFixed(3);
    const period   = (alt > 0 && vel > 0) ? (2 * Math.PI * (6371 + alt) / vel / 60).toFixed(2) : '---';
    const inc      = sat.satrec ? (sat.satrec.inclo * 180 / Math.PI).toFixed(2) : '51.64';
    const ecc      = sat.satrec ? sat.satrec.ecco.toFixed(6) : '---';
    const mm       = sat.satrec ? (sat.satrec.no * 1440 / (2 * Math.PI)).toFixed(4) : '---';
    const raan     = sat.satrec ? (sat.satrec.nodeo * 180 / Math.PI).toFixed(2) : '---';
    const crew     = Satellites.issData.crew;
    const altFt    = (alt * 3280.84).toFixed(0);

    document.getElementById('dbody').innerHTML = `
      <div class="dossier-header">
        <div class="dossier-classification">UNCLASSIFIED // PUBLIC DATA // NASA / ESA / ROSCOSMOS</div>
        <div class="dossier-id">ISS (ZARYA) · NORAD ${sat.id || '25544'} · OBJECT 1998-067A</div>
      </div>
      <div class="iss-badge">
        <div class="iss-badge-title">INTERNATIONAL SPACE STATION</div>
        <div class="iss-badge-sub">ALT ${alt.toFixed(0)} KM · ${speedKmh} KM/H · INCL ${inc}°</div>
      </div>
      <div class="iss-pos-row">
        <div class="iss-pos-item"><div class="iss-pos-val">${lat.toFixed(2)}°</div><div class="iss-pos-label">LATITUDE</div></div>
        <div class="iss-pos-item"><div class="iss-pos-val">${lon.toFixed(2)}°</div><div class="iss-pos-label">LONGITUDE</div></div>
        <div class="iss-pos-item"><div class="iss-pos-val">${alt.toFixed(0)}</div><div class="iss-pos-label">ALT KM</div></div>
      </div>
      <div class="dblock">
        <div class="dbtitle">// ORBITAL MECHANICS</div>
        <div class="drow"><span class="dl">VELOCITY</span><span class="dv amb">${speedKmh} km/h</span></div>
        <div class="drow"><span class="dl">SPEED (km/s)</span><span class="dv">${speedKms} km/s</span></div>
        <div class="drow"><span class="dl">ALTITUDE (ft)</span><span class="dv">${altFt} ft</span></div>
        <div class="drow"><span class="dl">ORBITAL PERIOD</span><span class="dv">${period} min</span></div>
        <div class="drow"><span class="dl">INCLINATION</span><span class="dv">${inc}°</span></div>
        <div class="drow"><span class="dl">ECCENTRICITY</span><span class="dv">${ecc}</span></div>
        <div class="drow"><span class="dl">MEAN MOTION</span><span class="dv">${mm} rev/day</span></div>
        <div class="drow"><span class="dl">RAAN</span><span class="dv">${raan}°</span></div>
        <div class="drow"><span class="dl">ORBIT CLASS</span><span class="dv blu">LEO</span></div>
      </div>
      <div class="dblock">
        <div class="dbtitle">// CREW MANIFEST — ${crew.length > 0 ? crew.length + ' PERSONNEL ABOARD' : 'DATA UNAVAILABLE'}</div>
        ${crew.length > 0
          ? crew.map(p => `<div class="iss-crew-row"><span class="iss-crew-icon">👨‍🚀</span><span class="iss-crew-name">${p.name}</span><span class="iss-crew-craft">ISS</span></div>`).join('')
          : '<div class="iss-crew-row"><span class="iss-crew-name" style="opacity:.4">CREW DATA OFFLINE — OPEN-NOTIFY UNAVAILABLE</span></div>'}
      </div>
      <div id="mmc"><div class="dbtitle">// GROUND TRACK</div><canvas id="mmcanvas" width="264" height="110"></canvas></div>
      <div id="tleblock">
        <div class="dbtitle">// TLE ELEMENTS</div>
        <div class="tleline">${sat.tle1 || '---'}</div>
        <div class="tleline" style="margin-top:4px">${sat.tle2 || '---'}</div>
      </div>`;
    drawMiniMap(sat);
    document.getElementById('poslabel').textContent = `LAT: ${lat.toFixed(2)} LON: ${lon.toFixed(2)}`;
  }

  function _issNameHTML() {
    return `<div class="sat-header"><span class="sat-header-icon">🛰️</span><span class="sat-header-name">ISS — ZARYA</span></div>`;
  }

  // ── Select Aircraft ───────────────────────────────────────
  async function selectAir(idx) {
    selectedIdx = idx; selectedType = 'air';
    buildList();
    Aircraft.showBracket(idx, godMode);
    Globe.bracketGroup.children.filter(c => !c.userData.airBracket).forEach(c => Globe.bracketGroup.remove(c));
    // Auto-zoom to 2.0 and centre
    Globe.zoom = 2.0;
    const ac = Aircraft.list[idx];
    if (ac && ac.lat != null) {
      Globe.rotY = (-ac.lon - 90) * Math.PI / 180;
      Globe.rotX = -ac.lat * Math.PI / 180 * 0.4;
      Globe.autoRot = false;
    }
    const cs = (ac.callsign || 'UNKNOWN').trim();
    document.getElementById('dname').innerHTML = _airNameHTML(ac, cs);
    document.getElementById('dbody').innerHTML = _airBasicHTML(ac, cs);
    showUntrackBtn('air', cs);
    if (typeof TrackBracket !== 'undefined') TrackBracket.show('air', idx, cs);
    const route = await Aircraft.fetchRoute(cs);
    _renderAirFull(ac, cs, route);
  }

  function _airNameHTML(ac, cs) {
    const milTag = ac.military ? '<span class="dossier-mil-tag">🪖 MILITARY</span>' : '';
    return `<div class="ac-header"><div class="ac-callsign">${cs}${milTag}</div><div class="ac-airline ac-airline-loading">FETCHING ROUTE...</div></div>`;
  }

  function _airBasicHTML(ac, cs) {
    const altM  = ac.baro_altitude || ac.geo_altitude || 0;
    const altFt = Math.round(altM * 3.28084);
    const velKts= ac.velocity ? Math.round(ac.velocity * 1.944) : null;
    const velKmh= ac.velocity ? Math.round(ac.velocity * 3.6) : null;
    return `
      <div class="dossier-header">
        <div class="dossier-classification">${ac.military ? 'MILITARY · ADS-B EXCHANGE' : 'CIVIL · OPENSKY NETWORK'}</div>
        <div class="dossier-id">ICAO: ${ac.icao24 || '---'} · SQUAWK: ${ac.squawk || '---'}</div>
      </div>
      <div class="ac-route-block ac-skeleton">
        <div class="ac-airports">
          <div class="ac-airport"><div class="ac-iata">???</div><div class="ac-city">FETCHING...</div></div>
          <div class="ac-route-arrow">✈</div>
          <div class="ac-airport ac-airport-right"><div class="ac-iata">???</div><div class="ac-city">FETCHING...</div></div>
        </div>
      </div>
      ${_airTelemetryHTML(ac, altM, altFt, velKts, velKmh)}`;
  }

  function _renderAirFull(ac, cs, route) {
    if (selectedType !== 'air' || Aircraft.list[selectedIdx] !== ac) return;
    const r = route;
    const altM  = ac.baro_altitude || ac.geo_altitude || 0;
    const altFt = Math.round(altM * 3.28084);
    const velKts= ac.velocity ? Math.round(ac.velocity * 1.944) : null;
    const velKmh= ac.velocity ? Math.round(ac.velocity * 3.6) : null;
    const fmt = iso => { try { return new Date(iso).toUTCString().slice(17,22) + ' UTC'; } catch { return '---'; } };
    const depIata = r?.dep.iata || '???', depCity = (r?.dep.airport || 'UNKNOWN').split(' ')[0];
    const arrIata = r?.arr.iata || '???', arrCity = (r?.arr.airport || 'UNKNOWN').split(' ')[0];
    const airline = r?.airline || ac.origin_country || '---';
    const acType  = r?.aircraftType || ac.aircraftType || '---';
    const reg     = r?.registration || ac.registration || '---';
    let pct = 50;
    if (r?.dep.scheduled && r?.arr.scheduled) {
      const d = new Date(r.dep.scheduled).getTime(), a = new Date(r.arr.scheduled).getTime(), now = Date.now();
      pct = Math.max(5, Math.min(95, ((now - d) / (a - d)) * 100));
    }
    const milTag = ac.military ? '<span class="dossier-mil-tag">🪖 MILITARY</span>' : '';

    document.getElementById('dname').innerHTML = `<div class="ac-header"><div class="ac-callsign">${cs}${milTag}</div><div class="ac-airline">${airline}</div></div>`;
    document.getElementById('dbody').innerHTML = `
      <div class="dossier-header">
        <div class="dossier-classification">${ac.military ? 'MILITARY · ADS-B EXCHANGE' : 'CIVIL · OPENSKY NETWORK'}</div>
        <div class="dossier-id">ICAO: ${ac.icao24 || '---'} · ${acType} · ${reg}</div>
      </div>
      <div class="ac-route-block">
        <div class="ac-airports">
          <div class="ac-airport"><div class="ac-iata">${depIata}</div><div class="ac-city">${depCity.toUpperCase()}</div></div>
          <div class="ac-route-arrow">✈</div>
          <div class="ac-airport ac-airport-right"><div class="ac-iata">${arrIata}</div><div class="ac-city">${arrCity.toUpperCase()}</div></div>
        </div>
        <div class="ac-progress-wrap">
          <div class="ac-progress-track">
            <div class="ac-progress-bar" style="width:${pct.toFixed(1)}%"></div>
            <div class="ac-progress-plane" style="left:${pct.toFixed(1)}%">✈</div>
          </div>
        </div>
        <div class="ac-times-grid">
          <div class="ac-time-col">
            <div class="ac-time-row"><span class="ac-time-label">SCHED</span><span class="ac-time-val">${fmt(r?.dep.scheduled)}</span></div>
            <div class="ac-time-row"><span class="ac-time-label">ACTUAL</span><span class="ac-time-val amb">${fmt(r?.dep.actual)}</span></div>
          </div>
          <div class="ac-time-col ac-time-col-right">
            <div class="ac-time-row"><span class="ac-time-label">SCHED</span><span class="ac-time-val">${fmt(r?.arr.scheduled)}</span></div>
            <div class="ac-time-row"><span class="ac-time-label">EST</span><span class="ac-time-val amb">${fmt(r?.arr.estimated)}</span></div>
          </div>
        </div>
      </div>
      ${_airTelemetryHTML(ac, altM, altFt, velKts, velKmh)}`;
  }

  function _airTelemetryHTML(ac, altM, altFt, velKts, velKmh) {
    const lat = ac.lat != null ? ac.lat.toFixed(4) + '°' : '---';
    const lon = ac.lon != null ? ac.lon.toFixed(4) + '°' : '---';
    const fl  = altM ? 'FL' + Math.round(altM * 3.28084 / 100) : '---';
    const squawkClass = (ac.squawk === '7700' || ac.squawk === '7500' || ac.squawk === '7600') ? 'red' : 'amb';
    const squawkNote  = ac.squawk === '7700' ? ' ⚠ EMERGENCY' : ac.squawk === '7500' ? ' ⚠ HIJACK' : ac.squawk === '7600' ? ' ⚠ COMMS FAIL' : '';
    return `
      <div class="dblock">
        <div class="dbtitle">// LIVE POSITION</div>
        <div class="drow"><span class="dl">LATITUDE</span><span class="dv">${lat}</span></div>
        <div class="drow"><span class="dl">LONGITUDE</span><span class="dv">${lon}</span></div>
        <div class="drow"><span class="dl">ALTITUDE</span><span class="dv amb">${altM ? Math.round(altM) + ' m' : '---'}</span></div>
        <div class="drow"><span class="dl">FLIGHT LEVEL</span><span class="dv amb">${fl}</span></div>
        <div class="drow"><span class="dl">ALT (ft)</span><span class="dv">${altFt ? altFt.toLocaleString() + ' ft' : '---'}</span></div>
      </div>
      <div class="dblock">
        <div class="dbtitle">// LIVE TELEMETRY</div>
        <div class="drow"><span class="dl">SPEED</span><span class="dv">${velKmh ? velKmh + ' km/h' : '---'}</span></div>
        <div class="drow"><span class="dl">SPEED (kts)</span><span class="dv">${velKts ? velKts + ' kts' : '---'}</span></div>
        <div class="drow"><span class="dl">HEADING</span><span class="dv">${ac.true_track ? ac.true_track.toFixed(1) + '°' : '---'}</span></div>
        <div class="drow"><span class="dl">VERT RATE</span><span class="dv">${ac.vertical_rate ? (ac.vertical_rate > 0 ? '▲ ' : '▼ ') + Math.abs(ac.vertical_rate).toFixed(1) + ' m/s' : '---'}</span></div>
        <div class="drow"><span class="dl">SQUAWK</span><span class="dv ${squawkClass}">${ac.squawk || '---'}${squawkNote}</span></div>
        <div class="drow"><span class="dl">ON GROUND</span><span class="dv ${ac.on_ground ? 'amb' : 'blu'}">${ac.on_ground ? '▣ GROUND' : '▲ AIRBORNE'}</span></div>
      </div>
      <div class="dblock">
        <div class="dbtitle">// IDENTIFICATION</div>
        <div class="drow"><span class="dl">ICAO24</span><span class="dv">${ac.icao24 || '---'}</span></div>
        <div class="drow"><span class="dl">COUNTRY</span><span class="dv">${ac.origin_country || '---'}</span></div>
        <div class="drow"><span class="dl">MILITARY</span><span class="dv ${ac.military ? 'teal' : 'blu'}">${ac.military ? '🪖 YES — FLAGGED' : 'NO'}</span></div>
        <div class="drow"><span class="dl">SOURCE</span><span class="dv" style="font-size:8px">${ac.source === 'adsbx' ? 'ADS-B EXCHANGE' : 'OPENSKY NETWORK'}</span></div>
      </div>`;
  }

  // ── Satellite Detail (Palantir dossier style) ─────────────
  function updateDetail() {
    if (selectedType !== 'sat' || selectedIdx === null) return;
    const sat = Satellites.list[selectedIdx];
    if (!sat) return;
    if (sat.cat === 'iss') { showISSPanel(selectedIdx); return; }

    const lat = sat.lat ?? 0, lon = sat.lon ?? 0, alt = sat.alt ?? 0, vel = sat.vel ?? 0;
    const period = (alt > 0 && vel > 0) ? (2 * Math.PI * (6371 + alt) / vel / 60) : 0;
    const ot  = alt < 2000 ? 'LEO' : alt < 35786 ? 'MEO' : 'GEO';
    const inc = sat.satrec ? (sat.satrec.inclo * 180 / Math.PI).toFixed(2) : '---';
    const ecc = sat.satrec ? sat.satrec.ecco.toFixed(6) : '---';
    const mm  = sat.satrec ? (sat.satrec.no * 1440 / (2 * Math.PI)).toFixed(4) : '---';
    const raan= sat.satrec ? (sat.satrec.nodeo * 180 / Math.PI).toFixed(2) : '---';
    const argp= sat.satrec ? (sat.satrec.argpo * 180 / Math.PI).toFixed(2) : '---';
    // Launch year from TLE epoch
    const epochStr = sat.tle1 ? sat.tle1.substring(18, 32).trim() : '';
    const epochYY  = epochStr ? parseInt(epochStr.substring(0, 2)) : null;
    const launchYr = epochYY !== null ? (epochYY >= 57 ? 1900 + epochYY : 2000 + epochYY) : '---';
    const meta= CONFIG.catMeta[sat.cat] || CONFIG.catMeta.other;

    document.getElementById('dname').innerHTML = `
      <div class="sat-header">
        <span class="sat-header-icon">${meta.icon}</span>
        <span class="sat-header-name">${sat.name.length > 20 ? 'SAT-' + sat.id : sat.name}</span>
      </div>`;

    document.getElementById('dbody').innerHTML = `
      <div class="dossier-header">
        <div class="dossier-classification">${godMode ? 'TOP SECRET // SI-TK // NOFORN' : 'UNCLASSIFIED // PUBLIC DATA // CELESTRAK'}</div>
        <div class="dossier-id">NORAD ${sat.id} · ${sat.name}</div>
      </div>
      <div class="sat-purpose-badge">${meta.icon} ${meta.purpose}</div>

      <div class="dblock">
        <div class="dbtitle">${godMode ? '// THREAT POSITION' : '// LIVE POSITION'}</div>
        <div class="drow"><span class="dl">LATITUDE</span><span class="dv">${lat.toFixed(4)}°</span></div>
        <div class="drow"><span class="dl">LONGITUDE</span><span class="dv">${lon.toFixed(4)}°</span></div>
        <div class="drow"><span class="dl">ALTITUDE</span><span class="dv amb">${alt.toFixed(1)} km</span></div>
        <div class="drow"><span class="dl">ORBIT CLASS</span><span class="dv ${godMode ? 'teal' : 'blu'}">${ot}</span></div>
        ${godMode ? '<div class="drow"><span class="dl">THREAT STATUS</span><span class="dv teal">⚠ FLAGGED</span></div>' : ''}
      </div>

      <div class="dblock">
        <div class="dbtitle">// ORBITAL MECHANICS</div>
        <div class="drow"><span class="dl">VELOCITY</span><span class="dv amb">${(vel * 3600).toFixed(0)} km/h</span></div>
        <div class="drow"><span class="dl">SPEED (km/s)</span><span class="dv">${vel.toFixed(3)} km/s</span></div>
        <div class="drow"><span class="dl">PERIOD</span><span class="dv">${period > 0 ? period.toFixed(2) + ' min' : '---'}</span></div>
        <div class="drow"><span class="dl">INCLINATION</span><span class="dv">${inc}°</span></div>
        <div class="drow"><span class="dl">ECCENTRICITY</span><span class="dv">${ecc}</span></div>
        <div class="drow"><span class="dl">MEAN MOTION</span><span class="dv">${mm} rev/day</span></div>
        <div class="drow"><span class="dl">RAAN</span><span class="dv">${raan}°</span></div>
        <div class="drow"><span class="dl">ARG OF PERIGEE</span><span class="dv">${argp}°</span></div>
      </div>

      <div class="dblock">
        <div class="dbtitle">// IDENTIFICATION</div>
        <div class="drow"><span class="dl">NORAD ID</span><span class="dv">${sat.id}</span></div>
        <div class="drow"><span class="dl">FULL NAME</span><span class="dv" style="font-size:8px;letter-spacing:.5px">${sat.name}</span></div>
        <div class="drow"><span class="dl">CATEGORY</span><span class="dv">${meta.label}</span></div>
        <div class="drow"><span class="dl">PURPOSE</span><span class="dv" style="font-size:8px">${meta.purpose}</span></div>
        <div class="drow"><span class="dl">EPOCH YEAR</span><span class="dv">${launchYr}</span></div>
        <div class="drow"><span class="dl">STATUS</span><span class="dv ${godMode ? 'teal' : 'blu'}">${godMode ? '⚠ HOSTILE' : '✓ TRACKED'}</span></div>
      </div>

      <div id="mmc">
        <div class="dbtitle">// GROUND TRACK</div>
        <canvas id="mmcanvas" width="264" height="110"></canvas>
      </div>
      <div id="tleblock">
        <div class="dbtitle">// TLE ELEMENTS</div>
        <div class="tleline">${sat.tle1 || '---'}</div>
        <div class="tleline" style="margin-top:4px">${sat.tle2 || '---'}</div>
      </div>`;

    drawMiniMap(sat);
    document.getElementById('poslabel').textContent = `LAT: ${lat.toFixed(2)} LON: ${lon.toFixed(2)}`;
  }

  function drawMiniMap(sat) {
    const cv = document.getElementById('mmcanvas');
    if (!cv) return;
    const ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
    const bg    = godMode ? '#0d0000' : '#000510';
    const grid  = godMode ? 'rgba(0,255,200,0.1)' : 'rgba(0,245,255,0.07)';
    const dotC  = godMode ? '#00ffcc' : '#ffb700';
    const trailC= godMode ? 'rgba(0,255,180,0.4)' : 'rgba(255,204,0,0.5)';
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = grid; ctx.lineWidth = 0.5;
    for (let x = 0; x < W; x += W / 6) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += H / 3) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    const h = Satellites.trails[selectedIdx];
    if (h && h.length > 1) {
      ctx.strokeStyle = trailC; ctx.lineWidth = 1; ctx.beginPath();
      h.forEach((p, i) => { const x = (p.lon + 180) / 360 * W, y = (90 - p.lat) / 180 * H; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.stroke();
    }
    if (sat.lat != null) {
      const x = (sat.lon + 180) / 360 * W, y = (90 - sat.lat) / 180 * H;
      ctx.fillStyle = dotC; ctx.shadowColor = dotC; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    }
  }

  // ── Raycasting ────────────────────────────────────────────
  function initRaycast() {
    const ray   = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const tip   = document.getElementById('tip');

    // ESC to untrack
    window.addEventListener('keydown', e => {
      if (e.key === 'Escape') deselect();
    });

    Globe.canvas.addEventListener('click', e => {
      if (Globe.drag) return;
      const rect = Globe.canvas.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      ray.setFromCamera(mouse, Globe.camera);
      const all  = [...(layerSat ? Satellites.meshes : []), ...(layerAir ? Aircraft.meshes : [])];
      const hits = ray.intersectObjects(all).filter(h => !h.object.userData.isBlocker && !h.object.userData.isFlag && !h.object.userData.isGridLabel);
      if (hits.length) {
        const ud = hits[0].object.userData;
        ud.type === 'sat' ? selectSat(ud.idx) : selectAir(ud.idx);
      }
    });

    Globe.canvas.addEventListener('mousemove', e => {
      const rect = Globe.canvas.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      ray.setFromCamera(mouse, Globe.camera);
      const all  = [...(layerSat ? Satellites.meshes : []), ...(layerAir ? Aircraft.meshes : [])];
      const hits = ray.intersectObjects(all);
      if (hits.length) {
        const ud   = hits[0].object.userData;
        const name = ud.type === 'sat' ? ud.obj.name : ((ud.obj.callsign || 'UNKNOWN').trim());
        const id   = ud.type === 'sat' ? 'NORAD:' + ud.obj.id : 'ICAO:' + (ud.obj.icao24 || '?');
        const milFlag = ud.type === 'air' && ud.obj.military ? ' 🪖' : '';
        tip.style.cssText = `display:block;left:${e.clientX + 14}px;top:${e.clientY - 10}px`;
        tip.textContent   = (godMode ? '⚠ TARGET: ' : '') + name + milFlag + '  ' + id;
        Globe.canvas.style.cursor = 'crosshair';
      } else {
        tip.style.display = 'none';
        Globe.canvas.style.cursor = Globe.drag ? 'grabbing' : 'grab';
      }
    });
  }

  return {
    initTargeting, initRaycast, toggleGodView, toggleLayer, toggleMilitary, toggleRadar,
    buildList, buildDataLayers, buildCatFilterPanel, toggleCatFilter,
    selectSat, selectAir, updateDetail, updateThreatCounts, renderGodDashboard,
    setSearchQuery, setFilterType, setFilterCountry, deselect,
    get godMode()     { return godMode; },
    get selectedIdx() { return selectedIdx; },
    get selectedType(){ return selectedType; },
  };
})();
