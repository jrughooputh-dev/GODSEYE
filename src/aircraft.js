// ═══════════════════════════════════════════════════════════
//  GODS EYE — AIRCRAFT MODULE
//  OpenSky Network integration
// ═══════════════════════════════════════════════════════════

const Aircraft = (() => {
  let aircraft = [];
  let airMeshes = [];

  async function fetch_data() {
    try {
      const res = await fetch(CONFIG.opensky);
      if (!res.ok) throw new Error('OpenSky ' + res.status);
      const data = await res.json();
      aircraft = (data.states || [])
        .filter(s => s[6] != null && s[5] != null)
        .slice(0, CONFIG.maxAircraft)
        .map(s => ({
          icao24: s[0], callsign: s[1], origin_country: s[2],
          lon: s[5], lat: s[6], baro_altitude: s[7], on_ground: s[8],
          velocity: s[9], true_track: s[10], vertical_rate: s[11],
          geo_altitude: s[13], squawk: s[14]
        }));
      return true;
    } catch (e) {
      return false;
    }
  }

  function buildMeshes(godMode) {
    Globe.airGroup.clear();
    airMeshes = [];
    const geo = new THREE.SphereGeometry(0.007, 4, 4);
    aircraft.forEach((ac, idx) => {
      const col = godMode ? 0xff0044 : 0x00bbff;
      const mat = new THREE.MeshBasicMaterial({ color: col });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.userData = { idx, type: 'air', obj: ac };
      Globe.airGroup.add(mesh);
      airMeshes.push(mesh);
    });
  }

  function place() {
    aircraft.forEach((ac, idx) => {
      if (ac.lat == null || ac.lon == null) return;
      const alt = (ac.geo_altitude || ac.baro_altitude || 10000) / 1000;
      const r = 1 + (alt / 6371) * 1.4 + 0.005;
      const pos = Utils.ll2v3(ac.lat, ac.lon, r);
      if (airMeshes[idx]) airMeshes[idx].position.copy(pos);
    });
  }

  function recolor(godMode) {
    airMeshes.forEach(m => {
      m.material.color.setHex(godMode ? 0xff0044 : 0x00bbff);
    });
  }

  return {
    get list() { return aircraft; },
    get meshes() { return airMeshes; },
    fetch: fetch_data, buildMeshes, place, recolor,
  };
})();
