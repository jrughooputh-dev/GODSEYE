// ═══════════════════════════════════════════════════════════
//  GODS EYE — RADAR MODULE
//  50km proximity radar with sweep animation
//  Detects aircraft and satellites overhead
//  Uses browser geolocation API
// ═══════════════════════════════════════════════════════════

const Radar = (() => {
  let active = false;
  let userLat = null, userLon = null;
  let locationGranted = false;
  let sweepAngle = 0;
  let blips = [];
  let radarCanvas, radarCtx;
  let animFrame = null;
  let lastScan = 0;

  const RADIUS_KM = CONFIG.radar.radiusKm;
  const EARTH_R = 6371;

  function haversine(lat1, lon1, lat2, lon2) {
    const toRad = x => x * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * EARTH_R * Math.asin(Math.sqrt(a));
  }

  function bearing(lat1, lon1, lat2, lon2) {
    const toRad = x => x * Math.PI / 180;
    const dLon = toRad(lon2 - lon1);
    const y = Math.sin(dLon) * Math.cos(toRad(lat2));
    const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
    return (Math.atan2(y, x) + 2 * Math.PI) % (2 * Math.PI);
  }

  async function requestLocation() {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(false);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        pos => {
          userLat = pos.coords.latitude;
          userLon = pos.coords.longitude;
          locationGranted = true;
          resolve(true);
        },
        () => resolve(false),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }

  function scan() {
    blips = [];
    if (!userLat || !userLon) return;

    // Scan satellites
    Satellites.list.forEach((sat, idx) => {
      if (sat.lat == null || sat.lon == null) return;
      const dist = haversine(userLat, userLon, sat.lat, sat.lon);
      if (dist <= RADIUS_KM) {
        const bear = bearing(userLat, userLon, sat.lat, sat.lon);
        blips.push({
          type: 'sat', name: sat.name, cat: sat.cat,
          dist, bearing: bear, alt: sat.alt || 0,
          vel: sat.vel ? (sat.vel * 3600 / 1000).toFixed(0) + ' km/h' : '---',
          id: 'NORAD:' + sat.id, idx,
        });
      }
    });

    // Scan aircraft
    Aircraft.list.forEach((ac, idx) => {
      if (ac.lat == null || ac.lon == null) return;
      const dist = haversine(userLat, userLon, ac.lat, ac.lon);
      if (dist <= RADIUS_KM) {
        const bear = bearing(userLat, userLon, ac.lat, ac.lon);
        blips.push({
          type: 'air', name: (ac.callsign || 'UNKNOWN').trim(),
          cat: 'aircraft', dist, bearing: bear,
          alt: ac.geo_altitude || ac.baro_altitude || 0,
          vel: ac.velocity ? ac.velocity.toFixed(0) + ' m/s' : '---',
          id: 'ICAO:' + ac.icao24, idx,
          origin: ac.origin_country,
          heading: ac.true_track ? ac.true_track.toFixed(0) + '°' : '---',
          squawk: ac.squawk || '---',
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
    const container = radarCanvas.parentElement;
    const size = Math.min(container.clientWidth - 16, 240);
    radarCanvas.width = size;
    radarCanvas.height = size;
  }

  function drawRadar(godMode) {
    if (!radarCtx || !radarCanvas) return;
    const W = radarCanvas.width, H = radarCanvas.height;
    const cx = W / 2, cy = H / 2, R = Math.min(cx, cy) - 8;

    const green = godMode ? '#ff2020' : '#00ff41';
    const greenDim = godMode ? '#aa0000' : '#00aa2a';
    const greenFaint = godMode ? 'rgba(255,32,32,' : 'rgba(0,255,65,';
    const bg = godMode ? '#0a0000' : '#000a02';

    radarCtx.fillStyle = bg;
    radarCtx.fillRect(0, 0, W, H);

    // Range rings
    for (let i = 1; i <= 4; i++) {
      const r = (R / 4) * i;
      radarCtx.strokeStyle = greenFaint + '0.15)';
      radarCtx.lineWidth = 0.5;
      radarCtx.beginPath();
      radarCtx.arc(cx, cy, r, 0, Math.PI * 2);
      radarCtx.stroke();
    }

    // Cross lines
    radarCtx.strokeStyle = greenFaint + '0.1)';
    radarCtx.lineWidth = 0.5;
    radarCtx.beginPath(); radarCtx.moveTo(cx, 4); radarCtx.lineTo(cx, H - 4); radarCtx.stroke();
    radarCtx.beginPath(); radarCtx.moveTo(4, cy); radarCtx.lineTo(W - 4, cy); radarCtx.stroke();
    // Diagonals
    radarCtx.beginPath(); radarCtx.moveTo(cx - R * 0.7, cy - R * 0.7); radarCtx.lineTo(cx + R * 0.7, cy + R * 0.7); radarCtx.stroke();
    radarCtx.beginPath(); radarCtx.moveTo(cx + R * 0.7, cy - R * 0.7); radarCtx.lineTo(cx - R * 0.7, cy + R * 0.7); radarCtx.stroke();

    // Sweep
    sweepAngle += 0.03;
    if (sweepAngle > Math.PI * 2) sweepAngle -= Math.PI * 2;
    const grad = radarCtx.createConicalGradient ?
      null : // fallback for older browsers
      radarCtx.createLinearGradient(cx, cy, cx + Math.cos(sweepAngle) * R, cy + Math.sin(sweepAngle) * R);

    // Sweep line
    radarCtx.save();
    radarCtx.strokeStyle = green;
    radarCtx.lineWidth = 1.5;
    radarCtx.globalAlpha = 0.8;
    radarCtx.beginPath();
    radarCtx.moveTo(cx, cy);
    radarCtx.lineTo(cx + Math.cos(sweepAngle) * R, cy + Math.sin(sweepAngle) * R);
    radarCtx.stroke();

    // Sweep trail (fade arc)
    for (let i = 0; i < 30; i++) {
      const a = sweepAngle - (i * 0.02);
      const alpha = (30 - i) / 30 * 0.15;
      radarCtx.strokeStyle = greenFaint + alpha + ')';
      radarCtx.lineWidth = 1;
      radarCtx.beginPath();
      radarCtx.moveTo(cx, cy);
      radarCtx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
      radarCtx.stroke();
    }
    radarCtx.restore();

    // Blips
    blips.forEach((blip, i) => {
      const normDist = Math.min(blip.dist / RADIUS_KM, 1);
      const bx = cx + Math.cos(blip.bearing - Math.PI / 2) * normDist * R;
      const by = cy + Math.sin(blip.bearing - Math.PI / 2) * normDist * R;

      // Angle diff for brightness pulse
      const angleDiff = Math.abs(((sweepAngle - blip.bearing + Math.PI / 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
      const brightness = angleDiff < 0.5 ? 1.0 : 0.5 + Math.random() * 0.1;

      const size = blip.type === 'air' ? 3 : 2;
      const blipColor = blip.type === 'air'
        ? (godMode ? `rgba(255,80,80,${brightness})` : `rgba(0,200,255,${brightness})`)
        : (godMode ? `rgba(255,100,40,${brightness})` : `rgba(0,255,65,${brightness})`);

      radarCtx.fillStyle = blipColor;
      radarCtx.shadowColor = blipColor;
      radarCtx.shadowBlur = 4;
      radarCtx.beginPath();
      radarCtx.arc(bx, by, size, 0, Math.PI * 2);
      radarCtx.fill();
      radarCtx.shadowBlur = 0;

      // Label for first 5 blips
      if (i < 5) {
        radarCtx.fillStyle = greenFaint + '0.6)';
        radarCtx.font = '6px "Share Tech Mono", monospace';
        radarCtx.fillText(blip.name.substring(0, 10), bx + 5, by - 3);
      }
    });

    // Center dot (YOU)
    radarCtx.fillStyle = godMode ? '#ff6600' : '#ffaa00';
    radarCtx.shadowColor = radarCtx.fillStyle;
    radarCtx.shadowBlur = 6;
    radarCtx.beginPath();
    radarCtx.arc(cx, cy, 3, 0, Math.PI * 2);
    radarCtx.fill();
    radarCtx.shadowBlur = 0;

    // Range labels
    radarCtx.fillStyle = greenDim;
    radarCtx.font = '7px "Orbitron", monospace';
    radarCtx.fillText(Math.round(RADIUS_KM / 4) + 'km', cx + 2, cy - R / 4 + 8);
    radarCtx.fillText(RADIUS_KM + 'km', cx + 2, cy - R + 8);

    // Cardinal directions
    radarCtx.fillStyle = greenDim;
    radarCtx.font = '7px "Orbitron", monospace';
    radarCtx.textAlign = 'center';
    radarCtx.fillText('N', cx, 10);
    radarCtx.fillText('S', cx, H - 3);
    radarCtx.textAlign = 'left';
    radarCtx.fillText('E', W - 10, cy + 3);
    radarCtx.textAlign = 'right';
    radarCtx.fillText('W', 10, cy + 3);
    radarCtx.textAlign = 'left';
  }

  function renderBlipList(godMode) {
    const listEl = document.getElementById('radar-list');
    if (!listEl) return;

    if (!active || !locationGranted) {
      listEl.innerHTML = '<div class="radar-empty">RADAR OFFLINE</div>';
      return;
    }

    if (blips.length === 0) {
      listEl.innerHTML = '<div class="radar-empty">NO CONTACTS IN RANGE</div>';
      return;
    }

    listEl.innerHTML = blips.slice(0, 20).map((b, i) => {
      const typeIcon = b.type === 'air' ? '✈' : '◉';
      const distStr = b.dist < 1 ? (b.dist * 1000).toFixed(0) + 'm' : b.dist.toFixed(1) + 'km';
      const altStr = b.type === 'air'
        ? (b.alt ? Math.round(b.alt) + 'm' : '---')
        : (b.alt ? b.alt.toFixed(0) + 'km' : '---');
      const bearDeg = (b.bearing * 180 / Math.PI).toFixed(0);
      return `<div class="radar-blip-item" data-type="${b.type}" data-idx="${b.idx}">
        <div class="rbi-top">
          <span class="rbi-icon">${typeIcon}</span>
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

    // Click handlers
    listEl.querySelectorAll('.radar-blip-item').forEach(el => {
      el.addEventListener('click', () => {
        const type = el.dataset.type;
        const idx = parseInt(el.dataset.idx);
        if (type === 'sat') UI.selectSat(idx);
        else UI.selectAir(idx);
      });
    });
  }

  function updateStatusUI() {
    const statusEl = document.getElementById('radar-status');
    const coordsEl = document.getElementById('radar-coords');
    const countEl = document.getElementById('radar-count');
    if (statusEl) statusEl.textContent = active ? (locationGranted ? 'SCANNING' : 'NO GPS') : 'OFFLINE';
    if (coordsEl) coordsEl.textContent = locationGranted ? `${userLat.toFixed(4)}°N ${userLon.toFixed(4)}°E` : '---';
    if (countEl) countEl.textContent = blips.length + ' CONTACTS';
  }

  async function activate(godMode) {
    active = true;
    const gotLoc = await requestLocation();
    initCanvas();
    if (gotLoc) {
      scan();
      renderBlipList(godMode);
    }
    updateStatusUI();
    startLoop(godMode);
  }

  function deactivate() {
    active = false;
    if (animFrame) cancelAnimationFrame(animFrame);
    blips = [];
    updateStatusUI();
  }

  function startLoop(godMode) {
    if (animFrame) cancelAnimationFrame(animFrame);
    function loop() {
      if (!active) return;
      animFrame = requestAnimationFrame(loop);
      drawRadar(godMode);
      // Re-scan every 5 seconds
      if (Date.now() - lastScan > 5000) {
        scan();
        renderBlipList(godMode);
        updateStatusUI();
      }
    }
    loop();
  }

  return {
    get active() { return active; },
    get blips() { return blips; },
    get userLat() { return userLat; },
    get userLon() { return userLon; },
    activate, deactivate, scan, drawRadar, renderBlipList, updateStatusUI,
  };
})();
