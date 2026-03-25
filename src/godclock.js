// ═══════════════════════════════════════════════════════════
//  GODS EYE — GOD CLOCK MODULE
//  22 world timezones, live update
// ═══════════════════════════════════════════════════════════

const GodClock = (() => {
  let open = false;
  let interval = null;

  function toggle() {
    open = !open;
    const overlay = document.getElementById('god-clock-overlay');
    const btn = document.getElementById('clock-btn');
    if (open) {
      overlay.classList.add('open');
      btn.classList.add('active');
      render();
      interval = setInterval(render, 1000);
    } else {
      overlay.classList.remove('open');
      btn.classList.remove('active');
      if (interval) clearInterval(interval);
    }
  }

  function render() {
    const body = document.getElementById('god-clock-body');
    if (!body) return;
    const now = new Date();
    body.innerHTML = CONFIG.timezones.map(tz => {
      const time = now.toLocaleTimeString('en-US', { timeZone: tz.tz, hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const date = now.toLocaleDateString('en-US', { timeZone: tz.tz, weekday: 'short', month: 'short', day: 'numeric' });
      const hour = parseInt(time.split(':')[0]);
      const isDaytime = hour >= 6 && hour < 20;
      const offset = now.toLocaleString('en-US', { timeZone: tz.tz, timeZoneName: 'shortOffset' }).split('GMT')[1] || '';
      const personalCls = tz.personal ? ' personal' : '';
      return `<div class="tz-row ${isDaytime ? 'day' : 'night'}${personalCls}">
        <div class="tz-city">${tz.flag} ${tz.city}${tz.personal ? ' ★' : ''}</div>
        <div class="tz-time">${time}</div>
        <div class="tz-meta">
          <span class="tz-date">${date}</span>
          <span class="tz-offset">GMT${offset}</span>
        </div>
      </div>`;
    }).join('');
  }

  return { toggle, render, get isOpen() { return open; } };
})();
