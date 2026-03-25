// ═══════════════════════════════════════════════════════════
//  GODS EYE — UTILITIES
//  Shared helper functions
// ═══════════════════════════════════════════════════════════

const Utils = {
  ll2v3(lat, lon, r) {
    const phi = (90 - lat) * Math.PI / 180;
    const theta = (lon + 180) * Math.PI / 180;
    return new THREE.Vector3(
      -r * Math.sin(phi) * Math.cos(theta),
       r * Math.cos(phi),
       r * Math.sin(phi) * Math.sin(theta)
    );
  },

  pad(x) {
    return String(x).padStart(2, '0');
  },

  formatUTC() {
    const n = new Date();
    return `${Utils.pad(n.getUTCHours())}:${Utils.pad(n.getUTCMinutes())}:${Utils.pad(n.getUTCSeconds())} UTC`;
  },

  worldToScreen(vec3, rotX, rotY, camera, width, height) {
    const v = vec3.clone();
    v.applyEuler(new THREE.Euler(rotX, rotY, 0));
    const proj = v.project(camera);
    if (proj.z > 1) return null;
    return {
      x: (proj.x * 0.5 + 0.5) * width,
      y: (-proj.y * 0.5 + 0.5) * height,
    };
  },
};
