// ═══════════════════════════════════════════════════════════
//  GODS EYE — UI MODULE v5
//  FR24-style aircraft panel, ISS tracker, GOD VIEW redesign
//  Category filters, expandable radar
// ═══════════════════════════════════════════════════════════

const UI = (() => {
  let selectedIdx = null, selectedType = 'sat';
  let godMode = false;
  let layerSat = true, layerAir = false;
  let shaderMode = 'normal';
  let radarOpen = false;

  // ── Targeting canvas ────────────────────────────────────
  let tcanvas, tctx, targetAnimFrame = null;

  function initTargeting() {
    tcanvas = document.getElementById('targets-canvas');
    resizeTargets();
    window.addEventListener('resize', resizeTargets);
  }

  function resizeTargets() {
    if (!tcanvas) return;
    tcanvas.width = Globe.wrap.clientWidth;
    tcanvas.height = Globe.wrap.clientHeight;
  }

  // ── GOD VIEW targeting animation ────────────────────────
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
        const pos = Satellites.meshes[selectedIdx].position.clone();
        const screen = Utils.worldToScreen(pos, Globe.rotX, Globe.rotY, Globe.camera, tcanvas.width, tcanvas.height);
        if (screen) {
          const pulse = 24 + Math.sin(t * 0.06) * 6;
          const alpha = 0.7 + Math.sin(t * 0.05) * 0.2;

          // Outer slow-rotating ring
          tctx.save();
          tctx.translate(screen.x, screen.y);
          tctx.rotate(t * 0.008);
          tctx.strokeStyle = `rgba(255,40,40,${alpha * 0.5})`;
          tctx.lineWidth = 1;
          tctx.setLineDash([6, 10]);
          tctx.beginPath(); tctx.arc(0, 0, pulse * 2.8, 0, Math.PI * 2); tctx.stroke();
          tctx.setLineDash([]);
          tctx.restore();

          // Inner solid ring
          tctx.strokeStyle = `rgba(255,60,20,${alpha})`;
          tctx.lineWidth = 1.5;
          tctx.beginPath(); tctx.arc(screen.x, screen.y, pulse, 0, Math.PI * 2); tctx.stroke();

          // Crosshair arms
          tctx.strokeStyle = `rgba(255,80,30,${alpha * 0.8})`;
          tctx.lineWidth = 1;
          const arm = pulse * 2.2;
          const gap = pulse * 1.15;
          tctx.beginPath(); tctx.moveTo(screen.x - arm, screen.y); tctx.lineTo(screen.x - gap, screen.y); tctx.stroke();
          tctx.beginPath(); tctx.moveTo(screen.x + gap, screen.y); tctx.lineTo(screen.x + arm, screen.y); tctx.stroke();
          tctx.beginPath(); tctx.moveTo(screen.x, screen.y - arm); tctx.lineTo(screen.x, screen.y - gap); tctx.stroke();
          tctx.beginPath(); tctx.moveTo(screen.x, screen.y + gap); tctx.lineTo(screen.x, screen.y + arm); tctx.stroke();

          // Corner tick marks on inner ring
          [0, Math.PI / 2, Math.PI, Math.PI * 1.5].forEach(a => {
            const rx = screen.x + Math.cos(a) * pulse;
            const ry = screen.y + Math.sin(a) * pulse;
            tctx.fillStyle = `rgba(255,100,50,${alpha})`;
            tctx.beginPath(); tctx.arc(rx, ry, 2, 0, Math.PI * 2); tctx.fill();
          });

          // Label
          tctx.fillStyle = `rgba(255,60,40,${alpha})`;
          tctx.font = '8px "Orbitron", monospace';
          tctx.letterSpacing = '2px';
          tctx.fillText('TARGET LOCKED', screen.x + pulse * 1.3, screen.y - 8);
          tctx.fillStyle = `rgba(255,120,80,0.7)`;
          tctx.font = '7px "Share Tech Mono", monospace';
          if (Satellites.list[selectedIdx])
            tctx.fillText(Satellites.list[selectedIdx].name, screen.x + pulse * 1.3, screen.y + 6);
        }
      }

      // Background ambient rings on random sats
      const numRings = Math.min(6, Satellites.list.length);
      for (let i = 0; i < numRings; i++) {
        const idx = Math.floor((i / numRings) * Satellites.list.length);
        if (!Satellites.meshes[idx]) continue;
        const pos = Satellites.meshes[idx].position.clone();
        const screen = Utils.worldToScreen(pos, Globe.rotX, Globe.rotY, Globe.camera, tcanvas.width, tcanvas.height);
        if (!screen) continue;
        const phase = t * 0.04 + i * 0.9;
        const r = 10 + Math.sin(phase) * 4;
        const alpha = 0.08 + Math.sin(phase) * 0.05;
        tctx.strokeStyle = `rgba(255,${20 + i * 8},0,${alpha})`;
        tctx.lineWidth = 0.5;
        tctx.beginPath(); tctx.arc(screen.x, screen.y, r, 0, Math.PI * 2); tctx.stroke();
      }
    }
    loop();
  }

  function clearTargets() {
    if (targetAnimFrame) cancelAnimationFrame(targetAnimFrame);
    if (tctx) tctx.clearRect(0, 0, tcanvas.width, tcanvas.height);
  }

  // ── GOD VIEW ────────────────────────────────────────────
  function toggleGodView() {
    godMode = !godMode;
    const btn = document.getElementById('god-btn');
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
      document.getElementById('main-title').innerHTML = 'GODS<em> EYE</em> // <span style="color:#ff2020;text-shadow:0 0 18px #ff2020">GOD VIEW — WAR MODE</span>';
      document.getElementById('ftr-label').textContent = 'GODS EYE v5.0 // GOD VIEW ACTIVE // ALL OBJECTS FLAGGED AS THREATS';
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
      document.getElementById('gl-br').textContent = 'SRC: CELESTRAK · OPENSKY';
      document.getElementById('main-title').innerHTML = 'GODS<em> EYE</em> // WORLDVIEW OPERATIONS CENTER';
      document.getElementById('ftr-label').textContent = 'GODS EYE v5.0 // UNCLASSIFIED // PUBLIC DATA ONLY';
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

  // ── GOD VIEW Dashboard ─────────────────────────────────
  function renderGodDashboard() {
    const el = document.getElementById('god-dashboard');
    if (!el) return;
    const c = Satellites.getThreatCounts();
    const acCount = Aircraft.list.length;
    const proximity = Radar.blips ? Radar.blips.length : 0;

    el.innerHTML = `
      <div class="gd-section">
        <div class="gd-stamp">// THREAT ASSESSMENT ACTIVE</div>
        <div class="gd-stamp gd-stamp-sub">CLASSIFICATION: TOP SECRET</div>
      </div>
      <div class="gd-cards">
        <div class="gd-card gd-card-primary">
          <div class="gd-card-icon">🛰️</div>
          <div class="gd-card-val">${c.total.toLocaleString()}</div>
          <div class="gd-card-label">SATELLITES</div>
        </div>
        <div class="gd-card">
          <div class="gd-card-icon">✈️</div>
          <div class="gd-card-val">${acCount.toLocaleString()}</div>
          <div class="gd-card-label">AIRCRAFT</div>
        </div>
        <div class="gd-card gd-card-alert">
          <div class="gd-card-icon">📡</div>
          <div class="gd-card-val">${proximity}</div>
          <div class="gd-card-label">PROXIMITY</div>
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
          ${[1,2,3,4,5].map(n => `<div class="gd-defcon-light ${n >= 3 ? 'gd-defcon-active' : ''}" data-level="${n}">${n}</div>`).join('')}
        </div>
      </div>
      <div class="gd-ticker">
        <span class="gd-ticker-label">SYS</span>
        <span class="gd-ticker-msg">ALL TRACKING SYSTEMS NOMINAL · ORBITAL PROPAGATION ACTIVE · NEXT TLE UPDATE PENDING</span>
      </div>`;
  }

  // ── Category Filter Panel ───────────────────────────────
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
    const current = Satellites.catFilter[cat];
    Satellites.setCatFilter(cat, !current);
    const el = document.querySelector(`.cfitem[data-cat="${cat}"]`);
    if (el) el.classList.toggle('off', !Satellites.catFilter[cat]);
    buildList(document.getElementById('search').value);
  }

  // ── Layers ──────────────────────────────────────────────
  function toggleLayer(type) {
    if (type === 'sat') {
      layerSat = !layerSat;
      document.getElementById('tog-sat').classList.toggle('on', layerSat);
      Globe.satGroup.visible = layerSat;
    } else if (type === 'air') {
      layerAir = !layerAir;
      document.getElementById('tog-air').classList.toggle('on', layerAir);
      Globe.airGroup.visible = layerAir;
      if (layerAir && Aircraft.list.length === 0) {
        Aircraft.fetch().then(ok => {
          if (ok) { Aircraft.buildMeshes(godMode); Aircraft.place(); buildList(); }
          document.getElementById('adot').style.boxShadow = ok ? '0 0 5px #00ccff' : 'none';
          document.getElementById('acnt').textContent = ok ? Aircraft.list.length + ' ACFT' : 'ACFT OFFLINE';
        });
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
  }

  function applyShader() {
    const ov = document.getElementById('shader-overlay');
    Globe.canvas.className = '';
    ov.className = '';
    if (shaderMode === 'nvg') { ov.classList.add('nvg'); Globe.canvas.classList.add('nvg'); }
    else if (shaderMode === 'flir') { ov.classList.add('flir'); Globe.canvas.classList.add('flir'); }
  }

  // ── Radar toggle ────────────────────────────────────────
  function toggleRadar() {
    radarOpen = !radarOpen;
    const panel = document.getElementById('radar-panel');
    const btn = document.getElementById('radar-btn');
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

  // ── List ─────────────────────────────────────────────────
  function buildList(filter) {
    const el = document.getElementById('list');
    el.innerHTML = '';
    const f = (filter || '').toUpperCase();
    let n = 0;
    const all = [
      ...Satellites.list.map((s, i) => ({ ...s, _type: 'sat', _idx: i })),
      ...(layerAir ? Aircraft.list.map((a, i) => ({
        name: a.callsign || 'UNKNOWN', cat: 'aircraft', id: a.icao24, _type: 'air', _idx: i
      })) : [])
    ];
    all.forEach(obj => {
      if (f && !obj.name.toUpperCase().includes(f)) return;
      if (obj._type === 'sat' && Satellites.catFilter[obj.cat] === false) return;
      n++;
      if (n > CONFIG.listRenderCap) return;
      const isSel = obj._type === selectedType && obj._idx === selectedIdx;
      const meta = CONFIG.catMeta[obj.cat] || CONFIG.catMeta.other;
      const div = document.createElement('div');
      div.className = 'sitem' + (isSel ? ' sel' : '');
      div.innerHTML = `
        <div class="sitem-icon">${meta.icon}</div>
        <div class="sitem-info">
          <div class="sname">${obj.name}</div>
          <div class="sid">${obj._type === 'sat' ? 'NORAD:' + obj.id : 'ICAO:' + obj.id}</div>
        </div>
        <div class="cbadge ${meta.cssClass}">${meta.label}</div>`;
      div.addEventListener('click', () => { obj._type === 'sat' ? selectSat(obj._idx) : selectAir(obj._idx); });
      el.appendChild(div);
    });
    document.getElementById('lcount').textContent = n;
  }

  // ── Select Satellite ─────────────────────────────────────
  function selectSat(idx) {
    selectedIdx = idx; selectedType = 'sat';
    buildList(document.getElementById('search').value);

    const sat = Satellites.list[idx];
    // ISS gets special panel
    if (sat && sat.cat === 'iss') {
      showISSPanel(idx);
    } else {
      updateDetail();
    }
    Satellites.drawTrail(idx, godMode);
    Satellites.select(idx, godMode);
  }

  // ── ISS Dedicated Panel ──────────────────────────────────
  async function showISSPanel(idx) {
    const sat = Satellites.list[idx];
    if (!sat) return;

    document.getElementById('dname').innerHTML = `<span class="iss-header-name">🛰️ INTERNATIONAL SPACE STATION</span>`;
    document.getElementById('dbody').innerHTML = `
      <div class="iss-loading">
        <div class="iss-loading-dot"></div>
        <span>FETCHING CREW DATA...</span>
      </div>`;

    // Fetch crew data
    await Satellites.fetchISSData();

    const lat = sat.lat ?? 0, lon = sat.lon ?? 0, alt = sat.alt ?? 400, vel = sat.vel ?? 0;
    const speedKmh = (vel * 3600 / 1000).toFixed(0);
    const period = (alt > 0 && vel > 0) ? (2 * Math.PI * (6371 + alt) / vel / 60).toFixed(1) : '---';
    const inc = sat.satrec ? (sat.satrec.inclo * 180 / Math.PI).toFixed(2) : '---';
    const crew = Satellites.issData.crew;

    document.getElementById('dbody').innerHTML = `
      <div class="iss-panel">
        <div class="iss-badge">
          <div class="iss-badge-title">ISS · ZARYA · UNITY · DESTINY</div>
          <div class="iss-badge-sub">ALTITUDE ${alt.toFixed(0)} KM · ${speedKmh} KM/H</div>
        </div>

        <div class="iss-pos-row">
          <div class="iss-pos-item">
            <div class="iss-pos-val">${lat.toFixed(2)}°</div>
            <div class="iss-pos-label">LATITUDE</div>
          </div>
          <div class="iss-pos-item">
            <div class="iss-pos-val">${lon.toFixed(2)}°</div>
            <div class="iss-pos-label">LONGITUDE</div>
          </div>
          <div class="iss-pos-item">
            <div class="iss-pos-val">${alt.toFixed(0)}</div>
            <div class="iss-pos-label">ALT (KM)</div>
          </div>
        </div>

        <div class="dblock">
          <div class="dbtitle">// ORBITAL MECHANICS</div>
          <div class="drow"><span class="dl">VELOCITY</span><span class="dv amb">${speedKmh} km/h</span></div>
          <div class="drow"><span class="dl">PERIOD</span><span class="dv">${period} min</span></div>
          <div class="drow"><span class="dl">INCLINATION</span><span class="dv">${inc}°</span></div>
          <div class="drow"><span class="dl">ORBIT CLASS</span><span class="dv blu">LEO</span></div>
          <div class="drow"><span class="dl">NORAD ID</span><span class="dv">${sat.id || '25544'}</span></div>
        </div>

        <div class="dblock">
          <div class="dbtitle">// CREW MANIFEST — ${crew.length > 0 ? crew.length + ' ABOARD' : 'DATA UNAVAILABLE'}</div>
          ${crew.length > 0
            ? crew.map(p => `<div class="iss-crew-row"><span class="iss-crew-icon">👨‍🚀</span><span class="iss-crew-name">${p.name}</span><span class="iss-crew-craft">ISS</span></div>`).join('')
            : '<div class="iss-crew-row"><span class="iss-crew-name" style="opacity:.5">CREW DATA OFFLINE</span></div>'
          }
        </div>

        <div id="mmc">
          <div class="dbtitle">// GROUND TRACK</div>
          <canvas id="mmcanvas" width="264" height="100"></canvas>
        </div>

        <div id="tleblock">
          <div class="dbtitle">// TLE ELEMENTS</div>
          <div class="tleline">${sat.tle1}</div>
          <div class="tleline" style="margin-top:3px">${sat.tle2}</div>
        </div>
      </div>`;

    drawMiniMap(sat);
    document.getElementById('poslabel').textContent = `LAT: ${lat.toFixed(2)} LON: ${lon.toFixed(2)}`;
  }

  // ── Select Aircraft (FR24 Style) ─────────────────────────
  async function selectAir(idx) {
    selectedIdx = idx; selectedType = 'air';
    buildList(document.getElementById('search').value);

    const ac = Aircraft.list[idx];
    const callsign = (ac.callsign || 'UNKNOWN').trim();
    const altM = ac.baro_altitude || ac.geo_altitude || 0;
    const altFt = Math.round(altM * 3.28084);
    const velKts = ac.velocity ? Math.round(ac.velocity * 1.944) : null;
    const velKmh = ac.velocity ? Math.round(ac.velocity * 3.6) : null;

    // Show skeleton immediately
    document.getElementById('dname').innerHTML = `
      <div class="ac-header">
        <div class="ac-callsign">${callsign}</div>
        <div class="ac-airline-loading">FETCHING ROUTE...</div>
      </div>`;

    document.getElementById('dbody').innerHTML = buildAircraftBasic(ac, callsign, altM, altFt, velKts, velKmh);

    // Async fetch route
    const route = await Aircraft.fetchRoute(callsign);
    renderAircraftFull(ac, callsign, altM, altFt, velKts, velKmh, route);
  }

  function buildAircraftBasic(ac, callsign, altM, altFt, velKts, velKmh) {
    return `
      <div class="ac-route-block ac-skeleton">
        <div class="ac-airports">
          <div class="ac-airport">
            <div class="ac-iata">???</div>
            <div class="ac-city">FETCHING...</div>
          </div>
          <div class="ac-route-arrow">✈</div>
          <div class="ac-airport ac-airport-right">
            <div class="ac-iata">???</div>
            <div class="ac-city">FETCHING...</div>
          </div>
        </div>
      </div>
      ${buildAircraftTelemetry(ac, altM, altFt, velKts, velKmh)}`;
  }

  function renderAircraftFull(ac, callsign, altM, altFt, velKts, velKmh, route) {
    if (selectedType !== 'air' || Aircraft.list[selectedIdx] !== ac) return;

    const r = route;
    const depIata  = r ? r.dep.iata : '???';
    const depCity  = r ? r.dep.airport.split(' ')[0] : 'UNKNOWN';
    const arrIata  = r ? r.arr.iata : '???';
    const arrCity  = r ? r.arr.airport.split(' ')[0] : 'UNKNOWN';
    const airline  = r ? r.airline : ac.origin_country || '---';
    const acType   = r ? r.aircraftType : '---';
    const reg      = r ? r.registration : '---';

    const fmt = (iso) => {
      if (!iso) return '---';
      try { return new Date(iso).toUTCString().slice(17,22) + ' UTC'; } catch { return '---'; }
    };
    const depSched = fmt(r?.dep.scheduled);
    const depActual = fmt(r?.dep.actual);
    const arrSched  = fmt(r?.arr.scheduled);
    const arrEst    = fmt(r?.arr.estimated);

    // Progress bar calculation
    let progressPct = 50;
    if (r?.dep.scheduled && r?.arr.scheduled) {
      const depT = new Date(r.dep.scheduled).getTime();
      const arrT = new Date(r.arr.scheduled).getTime();
      const now = Date.now();
      progressPct = Math.max(5, Math.min(95, ((now - depT) / (arrT - depT)) * 100));
    }

    document.getElementById('dname').innerHTML = `
      <div class="ac-header">
        <div class="ac-callsign">${callsign}</div>
        <div class="ac-airline">${airline}</div>
      </div>`;

    document.getElementById('dbody').innerHTML = `
      <div class="ac-route-block">
        <div class="ac-airports">
          <div class="ac-airport">
            <div class="ac-iata">${depIata}</div>
            <div class="ac-city">${depCity.toUpperCase()}</div>
          </div>
          <div class="ac-route-arrow">✈</div>
          <div class="ac-airport ac-airport-right">
            <div class="ac-iata">${arrIata}</div>
            <div class="ac-city">${arrCity.toUpperCase()}</div>
          </div>
        </div>
        <div class="ac-progress-wrap">
          <div class="ac-progress-track">
            <div class="ac-progress-bar" style="width:${progressPct.toFixed(1)}%"></div>
            <div class="ac-progress-plane" style="left:${progressPct.toFixed(1)}%">✈</div>
          </div>
        </div>
        <div class="ac-times-grid">
          <div class="ac-time-col">
            <div class="ac-time-row"><span class="ac-time-label">SCHEDULED</span><span class="ac-time-val">${depSched}</span></div>
            <div class="ac-time-row"><span class="ac-time-label">ACTUAL</span><span class="ac-time-val ${depActual !== '---' ? 'amb' : ''}">${depActual}</span></div>
          </div>
          <div class="ac-time-col ac-time-col-right">
            <div class="ac-time-row"><span class="ac-time-label">SCHEDULED</span><span class="ac-time-val">${arrSched}</span></div>
            <div class="ac-time-row"><span class="ac-time-label">ESTIMATED</span><span class="ac-time-val ${arrEst !== '---' ? 'amb' : ''}">${arrEst}</span></div>
          </div>
        </div>
      </div>

      <div class="dblock">
        <div class="dbtitle">// AIRCRAFT INFO</div>
        <div class="drow"><span class="dl">TYPE</span><span class="dv">${acType}</span></div>
        <div class="drow"><span class="dl">REGISTRATION</span><span class="dv">${reg}</span></div>
        <div class="drow"><span class="dl">ICAO24</span><span class="dv">${ac.icao24 || '---'}</span></div>
        <div class="drow"><span class="dl">SQUAWK</span><span class="dv ${ac.squawk === '7700' || ac.squawk === '7500' ? 'red' : 'amb'}">${ac.squawk || '---'}</span></div>
      </div>

      ${buildAircraftTelemetry(ac, altM, altFt, velKts, velKmh)}`;
  }

  function buildAircraftTelemetry(ac, altM, altFt, velKts, velKmh) {
    return `
      <div class="dblock">
        <div class="dbtitle">// LIVE TELEMETRY</div>
        <div class="drow"><span class="dl">ALTITUDE</span><span class="dv amb">${altM ? Math.round(altM) + ' m / ' + altFt + ' ft' : '---'}</span></div>
        <div class="drow"><span class="dl">SPEED</span><span class="dv">${velKmh ? velKmh + ' km/h / ' + velKts + ' kts' : '---'}</span></div>
        <div class="drow"><span class="dl">HEADING</span><span class="dv">${ac.true_track ? ac.true_track.toFixed(1) + '°' : '---'}</span></div>
        <div class="drow"><span class="dl">VERT RATE</span><span class="dv">${ac.vertical_rate ? (ac.vertical_rate > 0 ? '▲ ' : '▼ ') + Math.abs(ac.vertical_rate).toFixed(1) + ' m/s' : '---'}</span></div>
        <div class="drow"><span class="dl">LATITUDE</span><span class="dv">${(ac.lat || 0).toFixed(4)}°</span></div>
        <div class="drow"><span class="dl">LONGITUDE</span><span class="dv">${(ac.lon || 0).toFixed(4)}°</span></div>
        <div class="drow"><span class="dl">COUNTRY</span><span class="dv">${ac.origin_country || '---'}</span></div>
        <div class="drow"><span class="dl">ON GROUND</span><span class="dv ${ac.on_ground ? 'amb' : 'blu'}">${ac.on_ground ? 'YES' : 'AIRBORNE'}</span></div>
      </div>`;
  }

  // ── Satellite Detail ─────────────────────────────────────
  function updateDetail() {
    if (selectedType !== 'sat' || selectedIdx === null) return;
    const sat = Satellites.list[selectedIdx];
    if (!sat) return;
    if (sat.cat === 'iss') { showISSPanel(selectedIdx); return; }

    const lat = sat.lat ?? 0, lon = sat.lon ?? 0, alt = sat.alt ?? 0, vel = sat.vel ?? 0;
    const period = (alt > 0 && vel > 0) ? (2 * Math.PI * (6371 + alt) / vel / 60) : 0;
    const ot = alt < 2000 ? 'LEO' : alt < 35786 ? 'MEO' : 'GEO';
    const inc = sat.satrec ? (sat.satrec.inclo * 180 / Math.PI).toFixed(2) : '---';
    const ecc = sat.satrec ? sat.satrec.ecco.toFixed(6) : '---';
    const meta = CONFIG.catMeta[sat.cat] || CONFIG.catMeta.other;

    document.getElementById('dname').innerHTML = `
      <div class="sat-header">
        <span class="sat-header-icon">${meta.icon}</span>
        <span class="sat-header-name">${sat.name}</span>
      </div>`;

    document.getElementById('dbody').innerHTML = `
      <div class="sat-purpose-badge">${meta.purpose}</div>
      <div class="dblock">
        <div class="dbtitle">${godMode ? '// THREAT ASSESSMENT' : '// LIVE POSITION'}</div>
        <div class="drow"><span class="dl">LATITUDE</span><span class="dv">${lat.toFixed(4)}°</span></div>
        <div class="drow"><span class="dl">LONGITUDE</span><span class="dv">${lon.toFixed(4)}°</span></div>
        <div class="drow"><span class="dl">ALTITUDE</span><span class="dv amb">${alt.toFixed(1)} km</span></div>
        ${godMode ? '<div class="drow"><span class="dl">THREAT STATUS</span><span class="dv red">⚠ FLAGGED</span></div>' : ''}
      </div>
      <div class="dblock">
        <div class="dbtitle">// ORBITAL MECHANICS</div>
        <div class="drow"><span class="dl">VELOCITY</span><span class="dv">${(vel * 3600 / 1000).toFixed(2)} km/h</span></div>
        <div class="drow"><span class="dl">PERIOD</span><span class="dv">${period.toFixed(1)} min</span></div>
        <div class="drow"><span class="dl">INCLINATION</span><span class="dv">${inc}°</span></div>
        <div class="drow"><span class="dl">ECCENTRICITY</span><span class="dv">${ecc}</span></div>
        <div class="drow"><span class="dl">ORBIT CLASS</span><span class="dv ${godMode ? 'red' : 'blu'}">${ot}</span></div>
      </div>
      <div class="dblock">
        <div class="dbtitle">// CLASSIFICATION</div>
        <div class="drow"><span class="dl">NORAD ID</span><span class="dv">${sat.id || '---'}</span></div>
        <div class="drow"><span class="dl">CATEGORY</span><span class="dv">${meta.purpose}</span></div>
        <div class="drow"><span class="dl">STATUS</span><span class="dv ${godMode ? 'red' : 'blu'}">${godMode ? 'HOSTILE' : 'TRACKED'}</span></div>
      </div>
      <div id="mmc">
        <div class="dbtitle">// GROUND TRACK</div>
        <canvas id="mmcanvas" width="264" height="100"></canvas>
      </div>
      <div id="tleblock">
        <div class="dbtitle">// TLE ELEMENTS</div>
        <div class="tleline">${sat.tle1}</div>
        <div class="tleline" style="margin-top:3px">${sat.tle2}</div>
      </div>`;

    drawMiniMap(sat);
    document.getElementById('poslabel').textContent = `LAT: ${lat.toFixed(2)} LON: ${lon.toFixed(2)}`;
  }

  function drawMiniMap(sat) {
    const cv = document.getElementById('mmcanvas');
    if (!cv) return;
    const ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
    const bg = godMode ? '#0d0000' : '#000902';
    const grid = godMode ? 'rgba(255,20,20,0.1)' : 'rgba(0,255,65,0.1)';
    const dotCol = godMode ? '#ff2020' : '#00ff41';
    const trailCol = godMode ? 'rgba(255,32,0,0.4)' : 'rgba(0,255,65,0.35)';
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = grid; ctx.lineWidth = 0.5;
    for (let x = 0; x < W; x += W / 6) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += H / 3) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    const h = Satellites.trails[selectedIdx];
    if (h && h.length > 1) {
      ctx.strokeStyle = trailCol; ctx.lineWidth = 1; ctx.beginPath();
      h.forEach((p, i) => { const x = (p.lon + 180) / 360 * W, y = (90 - p.lat) / 180 * H; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.stroke();
    }
    if (sat.lat != null) {
      const x = (sat.lon + 180) / 360 * W, y = (90 - sat.lat) / 180 * H;
      ctx.fillStyle = dotCol; ctx.shadowColor = dotCol; ctx.shadowBlur = 6;
      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    }
  }

  // ── Raycasting ──────────────────────────────────────────
  function initRaycast() {
    const ray = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const tip = document.getElementById('tip');

    Globe.canvas.addEventListener('click', e => {
      if (Globe.drag) return;
      const rect = Globe.canvas.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      ray.setFromCamera(mouse, Globe.camera);
      const all = [...(layerSat ? Satellites.meshes : []), ...(layerAir ? Aircraft.meshes : [])];
      const hits = ray.intersectObjects(all);
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
      const all = [...(layerSat ? Satellites.meshes : []), ...(layerAir ? Aircraft.meshes : [])];
      const hits = ray.intersectObjects(all);
      if (hits.length) {
        const ud = hits[0].object.userData;
        const name = ud.type === 'sat' ? ud.obj.name : ((ud.obj.callsign || 'UNKNOWN').trim());
        const id = ud.type === 'sat' ? 'NORAD:' + ud.obj.id : 'ICAO:' + (ud.obj.icao24 || '?');
        tip.style.cssText = `display:block;left:${e.clientX + 14}px;top:${e.clientY - 10}px`;
        tip.textContent = (godMode ? '⚠ TARGET: ' : '') + name + '  ' + id;
        Globe.canvas.style.cursor = 'crosshair';
      } else {
        tip.style.display = 'none';
        Globe.canvas.style.cursor = Globe.drag ? 'grabbing' : 'grab';
      }
    });
  }

  return {
    initTargeting, initRaycast, toggleGodView, toggleLayer, toggleRadar,
    buildList, selectSat, selectAir, updateDetail, updateThreatCounts,
    buildCatFilterPanel, toggleCatFilter, renderGodDashboard,
    get godMode() { return godMode; },
    get selectedIdx() { return selectedIdx; },
    get selectedType() { return selectedType; },
  };
})();
