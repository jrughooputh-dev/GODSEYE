// ═══════════════════════════════════════════════════════════
//  GODS EYE — UI MODULE
//  Sidebar, detail panel, search, raycasting, targeting
// ═══════════════════════════════════════════════════════════

const UI = (() => {
  let selectedIdx = null, selectedType = 'sat';
  let godMode = false;
  let layerSat = true, layerAir = false;
  let shaderMode = 'normal';
  let radarOpen = false;

  // ── Targeting canvas ──
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
          const pulse = 20 + Math.sin(t * 0.08) * 5;
          tctx.save();
          tctx.strokeStyle = `rgba(255,20,20,${0.6 + Math.sin(t * 0.06) * 0.2})`;
          tctx.lineWidth = 1;
          tctx.beginPath(); tctx.arc(screen.x, screen.y, pulse * 2, 0, Math.PI * 2); tctx.stroke();
          tctx.strokeStyle = `rgba(255,80,0,${0.8 + Math.sin(t * 0.1) * 0.2})`;
          tctx.lineWidth = 1.5;
          tctx.beginPath(); tctx.arc(screen.x, screen.y, pulse, 0, Math.PI * 2); tctx.stroke();
          tctx.strokeStyle = 'rgba(255,50,50,0.5)'; tctx.lineWidth = 0.5;
          const s = pulse * 2.5;
          tctx.beginPath(); tctx.moveTo(screen.x - s, screen.y); tctx.lineTo(screen.x - pulse * 1.2, screen.y); tctx.stroke();
          tctx.beginPath(); tctx.moveTo(screen.x + pulse * 1.2, screen.y); tctx.lineTo(screen.x + s, screen.y); tctx.stroke();
          tctx.beginPath(); tctx.moveTo(screen.x, screen.y - s); tctx.lineTo(screen.x, screen.y - pulse * 1.2); tctx.stroke();
          tctx.beginPath(); tctx.moveTo(screen.x, screen.y + pulse * 1.2); tctx.lineTo(screen.x, screen.y + s); tctx.stroke();
          tctx.fillStyle = 'rgba(255,60,60,0.9)';
          tctx.font = '8px "Orbitron",monospace';
          tctx.fillText('TARGET LOCKED', screen.x + pulse * 2 + 6, screen.y - 4);
          tctx.fillStyle = 'rgba(255,100,100,0.6)';
          tctx.font = '7px "Share Tech Mono",monospace';
          if (Satellites.list[selectedIdx])
            tctx.fillText(Satellites.list[selectedIdx].name, screen.x + pulse * 2 + 6, screen.y + 8);
          tctx.restore();
        }
      }

      const numRings = Math.min(8, Satellites.list.length);
      for (let i = 0; i < numRings; i++) {
        const idx = Math.floor((i / numRings) * Satellites.list.length);
        if (!Satellites.meshes[idx]) continue;
        const pos = Satellites.meshes[idx].position.clone();
        const screen = Utils.worldToScreen(pos, Globe.rotX, Globe.rotY, Globe.camera, tcanvas.width, tcanvas.height);
        if (!screen) continue;
        const phase = t * 0.05 + i * 0.7;
        const r = 8 + Math.sin(phase) * 3;
        const alpha = 0.15 + Math.sin(phase) * 0.1;
        tctx.save();
        tctx.strokeStyle = `rgba(255,${30 + i * 10},0,${alpha})`;
        tctx.lineWidth = 0.5;
        tctx.beginPath(); tctx.arc(screen.x, screen.y, r, 0, Math.PI * 2); tctx.stroke();
        [0, Math.PI / 2, Math.PI, Math.PI * 1.5].forEach(angle => {
          const ax = screen.x + Math.cos(angle) * r;
          const ay = screen.y + Math.sin(angle) * r;
          tctx.beginPath(); tctx.arc(ax, ay, 1.5, 0, Math.PI * 2);
          tctx.fillStyle = `rgba(255,60,0,${alpha * 2})`; tctx.fill();
        });
        tctx.restore();
      }
    }
    loop();
  }

  function clearTargets() {
    if (targetAnimFrame) cancelAnimationFrame(targetAnimFrame);
    if (tctx) tctx.clearRect(0, 0, tcanvas.width, tcanvas.height);
  }

  // ── GOD VIEW ──
  function toggleGodView() {
    godMode = !godMode;
    const btn = document.getElementById('god-btn');
    const flash = document.getElementById('god-flash');
    flash.style.opacity = '0.6';
    setTimeout(() => { flash.style.opacity = '0'; }, 120);

    if (godMode) {
      btn.classList.add('active');
      btn.textContent = '☢ GOD VIEW — ACTIVE';
      document.body.classList.add('godview');
      document.getElementById('god-overlay').classList.add('on');
      document.getElementById('gl-tl').textContent = '⚠ GLOBAL THREAT ASSESSMENT — ACTIVE';
      document.getElementById('gl-br').textContent = 'DEFCON STATUS: ELEVATED';
      document.getElementById('main-title').innerHTML = 'GODS<em> EYE</em> // <span style="color:#ff2020;text-shadow:0 0 18px #ff2020">GOD VIEW — WAR MODE</span>';
      document.getElementById('ftr-label').textContent = 'GODS EYE v4.0 // GOD VIEW ACTIVE // ALL OBJECTS FLAGGED AS THREATS';
      document.getElementById('rph-label').textContent = '// THREAT TELEMETRY';
      document.getElementById('panel-label').textContent = '// THREAT OBJECTS';
      Globe.enterGodView();
      Satellites.recolor(true);
      Aircraft.recolor(true);
      updateThreatCounts();
      drawTargets();
    } else {
      btn.classList.remove('active');
      btn.textContent = '☠ GOD VIEW';
      document.body.classList.remove('godview');
      document.getElementById('god-overlay').classList.remove('on');
      document.getElementById('gl-tl').textContent = 'GLOBAL SURVEILLANCE NETWORK';
      document.getElementById('gl-br').textContent = 'SRC: CELESTRAK · OPENSKY';
      document.getElementById('main-title').innerHTML = 'GODS<em> EYE</em> // WORLDVIEW OPERATIONS CENTER';
      document.getElementById('ftr-label').textContent = 'GODS EYE v4.0 // UNCLASSIFIED // PUBLIC DATA ONLY';
      document.getElementById('rph-label').textContent = '// OBJECT TELEMETRY';
      document.getElementById('panel-label').textContent = '// TRACKED OBJECTS';
      Globe.exitGodView();
      Satellites.recolor(false);
      Aircraft.recolor(false);
      clearTargets();
    }
  }

  function updateThreatCounts() {
    const c = Satellites.getThreatCounts();
    document.getElementById('t-threats').textContent = c.total + Aircraft.list.length;
    document.getElementById('t-leo').textContent = c.leo;
    document.getElementById('t-meo').textContent = c.meo;
    document.getElementById('t-geo').textContent = c.geo;
  }

  // ── Layers ──
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

  // ── Radar panel ──
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

  // ── List ──
  function buildList(filter) {
    const el = document.getElementById('list');
    el.innerHTML = '';
    const f = (filter || '').toUpperCase();
    let n = 0;
    const all = [
      ...Satellites.list.map((s, i) => ({ ...s, _type: 'sat', _idx: i })),
      ...(layerAir ? Aircraft.list.map((a, i) => ({ name: a.callsign || 'UNKNOWN', cat: 'aircraft', id: a.icao24, _type: 'air', _idx: i })) : [])
    ];
    all.forEach(obj => {
      if (f && !obj.name.toUpperCase().includes(f)) return;
      n++;
      if (n > CONFIG.listRenderCap) return;
      const isSel = obj._type === selectedType && obj._idx === selectedIdx;
      const div = document.createElement('div');
      div.className = 'sitem' + (isSel ? ' sel' : '');
      div.innerHTML = `<div><div class="sname">${obj.name}</div><div class="sid">${obj._type === 'sat' ? 'NORAD:' + obj.id : 'ICAO:' + obj.id}</div></div><div class="cbadge ${Satellites.catClass(obj.cat)}">${Satellites.catLabel(obj.cat)}</div>`;
      div.addEventListener('click', () => { obj._type === 'sat' ? selectSat(obj._idx) : selectAir(obj._idx); });
      el.appendChild(div);
    });
    document.getElementById('lcount').textContent = n;
  }

  // ── Select ──
  function selectSat(idx) {
    selectedIdx = idx; selectedType = 'sat';
    buildList(document.getElementById('search').value);
    updateDetail();
    Satellites.drawTrail(idx, godMode);
    Satellites.select(idx, godMode);
  }

  function selectAir(idx) {
    selectedIdx = idx; selectedType = 'air';
    buildList(document.getElementById('search').value);
    const ac = Aircraft.list[idx];
    const nameColor = godMode ? '#ff2020' : 'var(--g)';
    document.getElementById('dname').innerHTML = `<span style="color:${nameColor}">${ac.callsign || 'UNKNOWN'}</span>`;
    document.getElementById('dbody').innerHTML = `
      <div class="dblock">
        <div class="dbtitle">// ${godMode ? 'THREAT' : 'AIRCRAFT'} DATA</div>
        <div class="drow"><span class="dl">ICAO24</span><span class="dv">${ac.icao24 || '---'}</span></div>
        <div class="drow"><span class="dl">CALLSIGN</span><span class="dv">${(ac.callsign || '---').trim()}</span></div>
        <div class="drow"><span class="dl">ORIGIN</span><span class="dv">${ac.origin_country || '---'}</span></div>
        <div class="drow"><span class="dl">LATITUDE</span><span class="dv">${(ac.lat || 0).toFixed(4)}°</span></div>
        <div class="drow"><span class="dl">LONGITUDE</span><span class="dv">${(ac.lon || 0).toFixed(4)}°</span></div>
        <div class="drow"><span class="dl">ALTITUDE</span><span class="dv amb">${ac.baro_altitude ? Math.round(ac.baro_altitude) + ' m' : '---'}</span></div>
        <div class="drow"><span class="dl">VELOCITY</span><span class="dv">${ac.velocity ? ac.velocity.toFixed(1) + ' m/s' : '---'}</span></div>
        <div class="drow"><span class="dl">HEADING</span><span class="dv">${ac.true_track ? ac.true_track.toFixed(1) + '°' : '---'}</span></div>
        <div class="drow"><span class="dl">SQUAWK</span><span class="dv amb">${ac.squawk || '---'}</span></div>
      </div>`;
  }

  function updateDetail() {
    if (selectedType !== 'sat' || selectedIdx === null) return;
    const sat = Satellites.list[selectedIdx];
    if (!sat) return;
    const lat = sat.lat ?? 0, lon = sat.lon ?? 0, alt = sat.alt ?? 0, vel = sat.vel ?? 0;
    const period = (alt > 0 && vel > 0) ? (2 * Math.PI * (6371 + alt) / vel / 60) : 0;
    const ot = alt < 2000 ? 'LEO' : alt < 35786 ? 'MEO' : 'GEO';
    const inc = sat.satrec ? (sat.satrec.inclo * 180 / Math.PI).toFixed(2) : '---';
    const ecc = sat.satrec ? sat.satrec.ecco.toFixed(6) : '---';

    document.getElementById('dname').textContent = sat.name;
    document.getElementById('dbody').innerHTML = `
      <div class="dblock">
        <div class="dbtitle">${godMode ? '// THREAT ASSESSMENT' : '// POSITION'}</div>
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
        <div class="drow"><span class="dl">CATEGORY</span><span class="dv">${sat.cat.toUpperCase()}</span></div>
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

  // ── Raycasting ──
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
    get godMode() { return godMode; },
    get selectedIdx() { return selectedIdx; },
    get selectedType() { return selectedType; },
  };
})();
