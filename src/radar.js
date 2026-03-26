// ═══════════════════════════════════════════════════════════
//  GODS EYE — RADAR MODULE v5.2
//  Fixed fullscreen overlay above Three.js canvas
//  Side-by-side canvas + contact list when expanded
// ═══════════════════════════════════════════════════════════

const Radar = (() => {
  let active   = false;
  let expanded = false;
  let userLat  = null, userLon = null;
  let locationGranted = false;
  let sweepAngle = 0;
  let blips   = [];
  let radarCanvas, radarCtx;
  let animFrame = null;
  let lastScan  = 0;
  let currentRangeKm = 50;

  const EARTH_R = 6371;

  function haversine(lat1, lon1, lat2, lon2) {
    const r = x => x * Math.PI / 180;
    const dLat = r(lat2 - lat1), dLon = r(lon2 - lon1);
    const a = Math.sin(dLat/2)**2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(dLon/2)**2;
    return 2 * EARTH_R * Math.asin(Math.sqrt(a));
  }

  function bearing(lat1, lon1, lat2, lon2) {
    const r = x => x * Math.PI / 180;
    const dLon = r(lon2 - lon1);
    const y = Math.sin(dLon) * Math.cos(r(lat2));
    const x = Math.cos(r(lat1)) * Math.sin(r(lat2)) - Math.sin(r(lat1)) * Math.cos(r(lat2)) * Math.cos(dLon);
    return (Math.atan2(y, x) + 2 * Math.PI) % (2 * Math.PI);
  }

  async function requestLocation() {
    return new Promise(resolve => {
      if (!navigator.geolocation) { resolve(false); return; }
      navigator.geolocation.getCurrentPosition(
        pos => { userLat = pos.coords.latitude; userLon = pos.coords.longitude; locationGranted = true; resolve(true); },
        () => resolve(false),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }

  function scan() {
    blips = [];
    if (!userLat || !userLon) return;
    Satellites.list.forEach((sat, idx) => {
      if (sat.lat == null || sat.lon == null) return;
      const dist = haversine(userLat, userLon, sat.lat, sat.lon);
      if (dist <= currentRangeKm) {
        blips.push({
          type: 'sat', name: sat.name, cat: sat.cat,
          dist, bearing: bearing(userLat, userLon, sat.lat, sat.lon),
          alt: sat.alt || 0,
          vel: sat.vel ? (sat.vel * 3600 / 1000).toFixed(0) + ' km/h' : '---',
          id: 'NORAD:' + sat.id, idx,
          icon: CONFIG.catMeta[sat.cat]?.icon || '🛰️',
        });
      }
    });
    Aircraft.list.forEach((ac, idx) => {
      if (ac.lat == null || ac.lon == null) return;
      const dist = haversine(userLat, userLon, ac.lat, ac.lon);
      if (dist <= currentRangeKm) {
        blips.push({
          type: 'air', name: (ac.callsign || 'UNKNOWN').trim(),
          cat: 'aircraft', dist, bearing: bearing(userLat, userLon, ac.lat, ac.lon),
          alt: ac.geo_altitude || ac.baro_altitude || 0,
          vel: ac.velocity ? ac.velocity.toFixed(0) + ' m/s' : '---',
          id: 'ICAO:' + ac.icao24, idx,
          military: ac.military || false,
          origin: ac.origin_country,
          heading: ac.true_track ? ac.true_track.toFixed(0) + '°' : '---',
          squawk: ac.squawk || '---',
          icon: ac.military ? '🪖' : '✈️',
        });
      }
    });
    blips.sort((a, b) => a.dist - b.dist);
    blips = blips.slice(0, CONFIG.radar.maxBlips);
    lastScan = Date.now();
  }

  function initCanvas() {
    radarCanvas = document.getElementById('radar-canvas');
    if (!radarCanvas) return;
    radarCtx = radarCanvas.getContext('2d');
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
  }

  function resizeCanvas() {
    if (!radarCanvas) return;
    if (expanded) {
      // In expanded overlay: canvas takes left half
      const overlay = document.getElementById('radar-overlay');
      if (overlay) {
        const h = Math.min(window.innerHeight * 0.75, 560);
        radarCanvas.width  = h;
        radarCanvas.height = h;
      }
    } else {
      const container = radarCanvas.parentElement;
      const size = Math.min(container ? container.clientWidth - 16 : 240, 240);
      radarCanvas.width  = size;
      radarCanvas.height = size;
    }
  }

  function drawRadar(godMode) {
    if (!radarCtx || !radarCanvas) return;
    const W = radarCanvas.width, H = radarCanvas.height;
    const cx = W/2, cy = H/2, R = Math.min(cx, cy) - (expanded ? 20 : 8);
    const green    = godMode ? '#00ffcc' : '#00f5ff';
    const greenDim = godMode ? '#880020' : '#007a88';
    const gf       = godMode ? 'rgba(0,255,204,' : 'rgba(0,245,255,';
    const bg       = godMode ? '#0a0002' : '#000510';
    const fs       = expanded ? 11 : 7;

    radarCtx.fillStyle = bg;
    radarCtx.fillRect(0, 0, W, H);

    // Range rings
    for (let i = 1; i <= 4; i++) {
      const r = (R / 4) * i;
      radarCtx.strokeStyle = gf + '0.12)';
      radarCtx.lineWidth = 0.5;
      radarCtx.beginPath(); radarCtx.arc(cx, cy, r, 0, Math.PI * 2); radarCtx.stroke();
      radarCtx.fillStyle = greenDim;
      radarCtx.font = `${fs}px "Orbitron", monospace`;
      radarCtx.textAlign = 'left';
      radarCtx.fillText(Math.round((currentRangeKm / 4) * i) + 'km', cx + 3, cy - r + fs + 2);
    }

    // Crosshairs
    radarCtx.strokeStyle = gf + '0.08)'; radarCtx.lineWidth = 0.5;
    radarCtx.beginPath(); radarCtx.moveTo(cx, 4);     radarCtx.lineTo(cx, H-4);   radarCtx.stroke();
    radarCtx.beginPath(); radarCtx.moveTo(4, cy);     radarCtx.lineTo(W-4, cy);   radarCtx.stroke();
    radarCtx.beginPath(); radarCtx.moveTo(cx-R*.7,cy-R*.7); radarCtx.lineTo(cx+R*.7,cy+R*.7); radarCtx.stroke();
    radarCtx.beginPath(); radarCtx.moveTo(cx+R*.7,cy-R*.7); radarCtx.lineTo(cx-R*.7,cy+R*.7); radarCtx.stroke();

    // Sweep
    sweepAngle += 0.025;
    if (sweepAngle > Math.PI * 2) sweepAngle -= Math.PI * 2;
    radarCtx.save();
    radarCtx.strokeStyle = green; radarCtx.lineWidth = expanded ? 2 : 1.5; radarCtx.globalAlpha = 0.85;
    radarCtx.beginPath(); radarCtx.moveTo(cx, cy);
    radarCtx.lineTo(cx + Math.cos(sweepAngle) * R, cy + Math.sin(sweepAngle) * R); radarCtx.stroke();
    for (let i = 0; i < 40; i++) {
      const a = sweepAngle - i * 0.018;
      const alpha = (40 - i) / 40 * 0.1;
      radarCtx.strokeStyle = gf + alpha + ')'; radarCtx.lineWidth = 1;
      radarCtx.beginPath(); radarCtx.moveTo(cx, cy);
      radarCtx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); radarCtx.stroke();
    }
    radarCtx.restore();

    // Blips
    const labelCount = expanded ? 20 : 5;
    blips.forEach((blip, i) => {
      const normDist = Math.min(blip.dist / currentRangeKm, 1);
      const bx = cx + Math.cos(blip.bearing - Math.PI / 2) * normDist * R;
      const by = cy + Math.sin(blip.bearing - Math.PI / 2) * normDist * R;
      const angleDiff  = Math.abs(((sweepAngle - blip.bearing + Math.PI / 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
      const brightness = angleDiff < 0.5 ? 1.0 : 0.5 + Math.random() * 0.1;
      const size = expanded ? (blip.type === 'air' ? 5 : 3) : (blip.type === 'air' ? 3 : 2);
      const blipColor = blip.military
        ? `rgba(255,153,0,${brightness})`
        : blip.type === 'air'
          ? (godMode ? `rgba(255,80,80,${brightness})` : `rgba(0,245,255,${brightness})`)
          : (godMode ? `rgba(255,100,40,${brightness})` : `rgba(0,245,255,${brightness})`);

      radarCtx.fillStyle   = blipColor;
      radarCtx.shadowColor = blipColor;
      radarCtx.shadowBlur  = expanded ? 6 : 4;
      radarCtx.beginPath(); radarCtx.arc(bx, by, size, 0, Math.PI * 2); radarCtx.fill();
      radarCtx.shadowBlur = 0;

      if (i < labelCount) {
        radarCtx.fillStyle = gf + '0.65)';
        radarCtx.font = `${expanded ? 9 : 6}px "Share Tech Mono", monospace`;
        radarCtx.textAlign = 'left';
        const dist = blip.dist < 1 ? (blip.dist * 1000).toFixed(0) + 'm' : blip.dist.toFixed(1) + 'km';
        radarCtx.fillText(`${blip.name.substring(0, expanded ? 12 : 8)} ${dist}`, bx + size + 3, by - 2);
      }
    });

    // Center YOU dot
    radarCtx.fillStyle   = godMode ? '#ff6600' : '#ffb700';
    radarCtx.shadowColor = radarCtx.fillStyle; radarCtx.shadowBlur = 8;
    radarCtx.beginPath(); radarCtx.arc(cx, cy, expanded ? 5 : 3, 0, Math.PI * 2); radarCtx.fill();
    radarCtx.shadowBlur = 0;

    // Cardinals
    radarCtx.fillStyle = greenDim; radarCtx.font = `${expanded ? 11 : 7}px "Orbitron", monospace`;
    radarCtx.textAlign = 'center';
    radarCtx.fillText('N', cx, expanded ? 16 : 10);
    radarCtx.fillText('S', cx, H - (expanded ? 5 : 3));
    radarCtx.textAlign = 'left';  radarCtx.fillText('E', W - (expanded ? 18 : 10), cy + (expanded ? 5 : 3));
    radarCtx.textAlign = 'right'; radarCtx.fillText('W', expanded ? 18 : 10, cy + (expanded ? 5 : 3));
    radarCtx.textAlign = 'left';

    if (expanded) {
      radarCtx.fillStyle = gf + '0.4)';
      radarCtx.font = '10px "Orbitron", monospace';
      radarCtx.textAlign = 'right';
      radarCtx.fillText(`${blips.length} CONTACTS · ${currentRangeKm}km`, W - 10, H - 10);
      radarCtx.textAlign = 'left';
    }
  }

  function renderBlipList(godMode) {
    const listEl = document.getElementById('radar-list');
    if (!listEl) return;
    if (!active || !locationGranted) { listEl.innerHTML = '<div class="radar-empty">RADAR OFFLINE</div>'; return; }
    if (blips.length === 0) { listEl.innerHTML = '<div class="radar-empty">NO CONTACTS IN RANGE</div>'; return; }

    listEl.innerHTML = blips.slice(0, expanded ? 60 : 20).map(b => {
      const distStr = b.dist < 1 ? (b.dist * 1000).toFixed(0) + 'm' : b.dist.toFixed(1) + 'km';
      const altStr  = b.type === 'air' ? (b.alt ? Math.round(b.alt) + 'm' : '---') : (b.alt ? b.alt.toFixed(0) + 'km' : '---');
      const bearDeg = (b.bearing * 180 / Math.PI).toFixed(0);
      const milClass= b.military ? ' mil' : '';
      return `<div class="radar-blip-item${milClass}" data-type="${b.type}" data-idx="${b.idx}">
        <div class="rbi-top">
          <span class="rbi-icon">${b.icon}</span>
          <span class="rbi-name">${b.name}</span>
          <span class="rbi-dist">${distStr}</span>
        </div>
        <div class="rbi-bottom">
          <span class="rbi-id">${b.id}</span>
          <span class="rbi-alt">ALT:${altStr}</span>
          <span class="rbi-bear">BRG:${bearDeg}°</span>
        </div>
      </div>`;
    }).join('');

    listEl.querySelectorAll('.radar-blip-item').forEach(el => {
      el.addEventListener('click', () => {
        const type = el.dataset.type, idx = parseInt(el.dataset.idx);
        if (type === 'sat') UI.selectSat(idx); else UI.selectAir(idx);
      });
    });
  }

  function updateStatusUI() {
    const s   = document.getElementById('radar-status');
    const c   = document.getElementById('radar-coords');
    const cnt = document.getElementById('radar-count');
    if (s)   s.textContent   = active ? (locationGranted ? 'SCANNING' : 'NO GPS') : 'OFFLINE';
    if (c)   c.textContent   = locationGranted ? `${userLat.toFixed(4)}° ${userLon.toFixed(4)}°` : '---';
    if (cnt) cnt.textContent = blips.length + ' CONTACTS';
  }

  // ── EXPANDED OVERLAY ──────────────────────────────────────
  // Renders as a true fixed overlay ABOVE the Three.js canvas
  // to avoid z-index stacking context issues
  function toggleExpand() {
    expanded = !expanded;
    const btn = document.getElementById('radar-expand-btn');
    if (expanded) {
      _mountOverlay();
      if (btn) btn.textContent = '⊡';
    } else {
      _unmountOverlay();
      if (btn) btn.textContent = '⊞';
    }
    resizeCanvas();
  }

  function _mountOverlay() {
    let overlay = document.getElementById('radar-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'radar-overlay';
      document.body.appendChild(overlay);
    }
    overlay.innerHTML = `
      <div class="radar-overlay-inner">
        <div class="radar-overlay-header">
          <span class="radar-overlay-title">📡 PROXIMITY RADAR // ${currentRangeKm}KM RANGE</span>
          <div class="radar-overlay-controls">
            <button class="radar-range-btn ${currentRangeKm===10?'active':''}" onclick="Radar.setRange(10)">10km</button>
            <button class="radar-range-btn ${currentRangeKm===50?'active':''}" onclick="Radar.setRange(50)">50km</button>
            <button class="radar-range-btn ${currentRangeKm===200?'active':''}" onclick="Radar.setRange(200)">200km</button>
            <span class="radar-overlay-status">STATUS: <span id="radar-status-ov">${active && locationGranted ? 'SCANNING' : 'OFFLINE'}</span></span>
            <span id="radar-count-ov">${blips.length} CONTACTS</span>
            <button class="radar-overlay-close" onclick="Radar.toggleExpand()">✕ CLOSE</button>
          </div>
        </div>
        <div class="radar-overlay-body">
          <div class="radar-overlay-canvas-wrap">
            <canvas id="radar-canvas-exp" width="480" height="480"></canvas>
          </div>
          <div class="radar-overlay-list-wrap">
            <div class="radar-overlay-list-header">
              <span>CONTACTS</span>
              <span id="radar-coords" style="font-size:8px;opacity:.6">${locationGranted ? userLat.toFixed(4)+'° '+userLon.toFixed(4)+'°' : '---'}</span>
            </div>
            <div id="radar-list" class="radar-overlay-list"></div>
          </div>
        </div>
      </div>`;
    overlay.style.display = 'flex';

    // Defer canvas init by one tick so DOM is fully painted
    requestAnimationFrame(() => {
      radarCanvas = document.getElementById('radar-canvas-exp');
      if (radarCanvas) {
        radarCtx = radarCanvas.getContext('2d');
        // Size the canvas properly
        const wrap = radarCanvas.parentElement;
        const size = Math.min(window.innerHeight * 0.7, 520);
        radarCanvas.width  = size;
        radarCanvas.height = size;
        // Restart loop with new canvas
        if (active) startLoop(UI.godMode);
        renderBlipList(UI.godMode);
      }
    });
  }

  function _unmountOverlay() {
    const overlay = document.getElementById('radar-overlay');
    if (overlay) { overlay.style.display = 'none'; overlay.innerHTML = ''; }
    // Re-point back to the inline panel canvas
    radarCanvas = document.getElementById('radar-canvas');
    if (radarCanvas) {
      radarCtx = radarCanvas.getContext('2d');
      radarCanvas.width  = 240;
      radarCanvas.height = 240;
    }
    if (active) startLoop(UI.godMode);
  }

  function setRange(km) {
    currentRangeKm = km;
    document.querySelectorAll('.radar-range-btn').forEach(b => {
      b.classList.toggle('active', parseInt(b.dataset.range) === km || b.textContent === km + 'km');
    });
    // Update overlay title if open
    const title = document.querySelector('.radar-overlay-title');
    if (title) title.textContent = `📡 PROXIMITY RADAR // ${km}KM RANGE`;
    scan();
    renderBlipList(UI.godMode);
    updateStatusUI();
  }

  async function activate(godMode) {
    active = true;
    // Always grab the inline panel canvas fresh on activate
    radarCanvas = document.getElementById('radar-canvas');
    if (radarCanvas) {
      radarCtx = radarCanvas.getContext('2d');
      radarCanvas.width  = 240;
      radarCanvas.height = 240;
    }
    const gotLoc = await requestLocation();
    if (gotLoc) { scan(); renderBlipList(godMode); }
    updateStatusUI();
    startLoop(godMode);
  }

  function deactivate() {
    active = false; expanded = false;
    _unmountOverlay();
    if (animFrame) cancelAnimationFrame(animFrame);
    blips = [];
    updateStatusUI();
  }

  function startLoop(godMode) {
    if (animFrame) cancelAnimationFrame(animFrame);
    function loop() {
      if (!active) return;
      animFrame = requestAnimationFrame(loop);
      // Always re-check canvas in case it was swapped by overlay mount/unmount
      if (!radarCanvas || !radarCtx) {
        radarCanvas = document.getElementById('radar-canvas-exp') || document.getElementById('radar-canvas');
        if (radarCanvas) radarCtx = radarCanvas.getContext('2d');
      }
      drawRadar(godMode);
      const ov  = document.getElementById('radar-status-ov');
      const cnt = document.getElementById('radar-count-ov');
      if (ov)  ov.textContent  = active && locationGranted ? 'SCANNING' : 'OFFLINE';
      if (cnt) cnt.textContent = blips.length + ' CONTACTS';
      if (Date.now() - lastScan > 5000) {
        scan(); renderBlipList(godMode); updateStatusUI();
      }
    }
    loop();
  }

  return {
    get active()   { return active; },
    get blips()    { return blips; },
    get expanded() { return expanded; },
    get userLat()  { return userLat; },
    get userLon()  { return userLon; },
    activate, deactivate, scan, drawRadar, renderBlipList,
    updateStatusUI, toggleExpand, setRange,
  };
})();
