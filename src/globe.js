// ═══════════════════════════════════════════════════════════
//  GODS EYE — GLOBE MODULE v5.2
//  Zoom setter, label sprite group, bracket reticle overlay
// ═══════════════════════════════════════════════════════════

const Globe = (() => {
  let renderer, scene, camera;
  let earth, clouds, atmoMesh, gridMesh;
  let godSphere, warGrid1, warGrid2, godAtmo;
  let warGrid1Mat, warGrid2Mat, godAtMat, godSphereMat;
  let earthMat, atmoMat, cloudMat, starMat;
  let satGroup, airGroup, trailGroup, labelGroup, bracketGroup;
  let sunLight, ambLight;

  let drag = false, prevM = { x: 0, y: 0 };
  let rotX = 0.3, rotY = 0, zoom = 3.6, autoRot = true;
  let frame = 0;

  const canvas = document.getElementById('gc');
  const wrap   = document.getElementById('gw');

  // ── Sun direction ─────────────────────────────────────────
  function getSunDirection() {
    const now = new Date();
    const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
    const declination = -23.45 * Math.cos((2 * Math.PI / 365) * (dayOfYear + 10)) * Math.PI / 180;
    const hourAngle = (now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600) / 24 * 2 * Math.PI - Math.PI;
    return new THREE.Vector3(
      Math.cos(declination) * Math.cos(hourAngle),
      Math.sin(declination),
      Math.cos(declination) * Math.sin(hourAngle)
    ).normalize();
  }

  // ── Init ──────────────────────────────────────────────────
  function init() {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setClearColor(0x000000);

    scene  = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000);
    camera.position.set(0, 0, zoom);

    resize();
    window.addEventListener('resize', resize);

    createStars();
    createEarth();
    createAtmosphere();
    createGodViewElements();
    createLights();
    createGroups();
    setupControls();
  }

  function resize() {
    const w = wrap.clientWidth, h = wrap.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  // ── Stars ─────────────────────────────────────────────────
  function createStars() {
    const geo = new THREE.BufferGeometry();
    const arr = new Float32Array(6000 * 3);
    for (let i = 0; i < arr.length; i++) arr[i] = (Math.random() - 0.5) * 500;
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    starMat = new THREE.PointsMaterial({ color: 0xccccdd, size: 0.06, transparent: true, opacity: 0.55 });
    scene.add(new THREE.Points(geo, starMat));
  }

  // ── Earth ─────────────────────────────────────────────────
  function createEarth() {
    const loader   = new THREE.TextureLoader();
    const dayTex   = loader.load(CONFIG.textures.day);
    const nightTex = loader.load(CONFIG.textures.night);
    const normalTex= loader.load(CONFIG.textures.topo);
    const cloudTex = loader.load(CONFIG.textures.clouds);

    earthMat = new THREE.ShaderMaterial({
      uniforms: {
        dayTexture:   { value: dayTex },
        nightTexture: { value: nightTex },
        bumpMap:      { value: normalTex },
        sunDirection: { value: new THREE.Vector3(1, 0, 0) },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        void main(){
          vUv = uv;
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D dayTexture;
        uniform sampler2D nightTexture;
        uniform vec3 sunDirection;
        varying vec2 vUv;
        varying vec3 vNormal;
        void main(){
          float sunDot = dot(normalize(vNormal), normalize(sunDirection));
          float blend  = smoothstep(-0.15, 0.15, sunDot);
          vec4 dayColor   = texture2D(dayTexture, vUv);
          vec4 nightColor = texture2D(nightTexture, vUv) * 1.6;
          dayColor.rgb += vec3(0.0, 0.01, 0.03) * blend;
          gl_FragColor = mix(nightColor, dayColor, blend);
        }
      `
    });
    earth = new THREE.Mesh(new THREE.SphereGeometry(1, 72, 36), earthMat);
    scene.add(earth);

    cloudMat = new THREE.MeshPhongMaterial({ map: cloudTex, transparent: true, opacity: 0.28, depthWrite: false });
    clouds   = new THREE.Mesh(new THREE.SphereGeometry(1.008, 64, 32), cloudMat);
    scene.add(clouds);

    gridMesh = new THREE.Mesh(
      new THREE.SphereGeometry(1.002, 48, 24),
      new THREE.MeshBasicMaterial({ color: 0x00ff41, wireframe: true, transparent: true, opacity: 0.025 })
    );
    scene.add(gridMesh);
  }

  // ── Atmosphere ────────────────────────────────────────────
  function createAtmosphere() {
    atmoMat = new THREE.ShaderMaterial({
      uniforms: { sunDirection: { value: new THREE.Vector3(1, 0, 0) } },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main(){
          vNormal   = normalize(normalMatrix * normal);
          vPosition = (modelViewMatrix * vec4(position,1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main(){
          vec3 viewDir = normalize(-vPosition);
          float rim    = 1.0 - max(0.0, dot(viewDir, vNormal));
          rim = pow(rim, 3.0);
          vec3 color = mix(vec3(0.15, 0.4, 1.0), vec3(0.3, 0.6, 1.0), rim);
          gl_FragColor = vec4(color, rim * 0.6);
        }
      `,
      transparent: true, side: THREE.BackSide, depthWrite: false
    });
    atmoMesh = new THREE.Mesh(new THREE.SphereGeometry(1.04, 64, 32), atmoMat);
    scene.add(atmoMesh);
  }

  // ── God View elements ─────────────────────────────────────
  function createGodViewElements() {
    godSphereMat = new THREE.MeshBasicMaterial({ color: 0x0a0000, transparent: true, opacity: 0 });
    godSphere    = new THREE.Mesh(new THREE.SphereGeometry(1, 72, 36), godSphereMat);
    godSphere.visible = false;
    scene.add(godSphere);

    warGrid1Mat = new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true, transparent: true, opacity: 0 });
    warGrid1    = new THREE.Mesh(new THREE.SphereGeometry(1.001, 48, 24), warGrid1Mat);
    scene.add(warGrid1);

    warGrid2Mat = new THREE.MeshBasicMaterial({ color: 0xff4400, wireframe: true, transparent: true, opacity: 0 });
    warGrid2    = new THREE.Mesh(new THREE.SphereGeometry(1.003, 24, 12), warGrid2Mat);
    scene.add(warGrid2);

    godAtMat = new THREE.MeshBasicMaterial({ color: 0xff1100, transparent: true, opacity: 0, side: THREE.BackSide });
    godAtmo  = new THREE.Mesh(new THREE.SphereGeometry(1.06, 32, 32), godAtMat);
    scene.add(godAtmo);
  }

  // ── Lights ────────────────────────────────────────────────
  function createLights() {
    sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
    sunLight.position.copy(getSunDirection().multiplyScalar(10));
    scene.add(sunLight);
    ambLight = new THREE.AmbientLight(0x111122, 0.4);
    scene.add(ambLight);
  }

  // ── Groups ────────────────────────────────────────────────
  function createGroups() {
    satGroup    = new THREE.Group();
    airGroup    = new THREE.Group();
    trailGroup  = new THREE.Group();
    labelGroup  = new THREE.Group();   // floating name labels
    bracketGroup= new THREE.Group();   // targeting bracket lines
    scene.add(satGroup, airGroup, trailGroup, labelGroup, bracketGroup);
  }

  // ── Label sprite helper ───────────────────────────────────
  // Creates a canvas-text sprite for floating labels above objects
  function makeLabelSprite(text, color = '#ffb700', bgAlpha = 0.0, fontSize = 11) {
    const canvas = document.createElement('canvas');
    const padding = 6;
    const ctx = canvas.getContext('2d');
    ctx.font = `${fontSize}px "Share Tech Mono", monospace`;
    const tw = ctx.measureText(text).width;
    canvas.width  = tw + padding * 2;
    canvas.height = fontSize + padding * 2;
    // Re-apply font after resize
    ctx.font = `${fontSize}px "Share Tech Mono", monospace`;
    if (bgAlpha > 0) {
      ctx.fillStyle = `rgba(0,0,0,${bgAlpha})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.fillStyle = color;
    ctx.fillText(text, padding, fontSize + padding * 0.6);
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    // Scale relative to canvas aspect
    const aspect = canvas.width / canvas.height;
    sprite.scale.set(aspect * 0.06, 0.06, 1);
    return sprite;
  }

  // ── Bracket reticle (4-corner targeting brackets) ─────────
  // Returns a THREE.Group of line segments forming corner brackets
  function makeBracket(size = 0.06, color = 0xffb700, thickness = 1) {
    const arm  = size * 0.4;   // bracket arm length
    const gap  = size * 0.5;   // half-size to corner
    const mat  = new THREE.LineBasicMaterial({ color, linewidth: thickness, transparent: true, opacity: 0.9, depthTest: false });
    const group = new THREE.Group();

    const corners = [
      // [startX, startY, endX1, endY1, endX2, endY2]  (two arms per corner)
      [-gap, +gap,  -gap+arm, +gap,  -gap, +gap-arm],  // top-left
      [+gap, +gap,  +gap-arm, +gap,  +gap, +gap-arm],  // top-right
      [-gap, -gap,  -gap+arm, -gap,  -gap, -gap+arm],  // bottom-left
      [+gap, -gap,  +gap-arm, -gap,  +gap, -gap+arm],  // bottom-right
    ];

    corners.forEach(([cx, cy, ax, ay, bx, by]) => {
      // Horizontal arm
      const geoH = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(cx, cy, 0),
        new THREE.Vector3(ax, ay, 0),
      ]);
      group.add(new THREE.Line(geoH, mat));
      // Vertical arm
      const geoV = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(cx, cy, 0),
        new THREE.Vector3(bx, by, 0),
      ]);
      group.add(new THREE.Line(geoV, mat));
    });

    return group;
  }

  // ── Controls ──────────────────────────────────────────────
  function setupControls() {
    canvas.addEventListener('mousedown', e => { drag = true; autoRot = false; prevM = { x: e.clientX, y: e.clientY }; });
    window.addEventListener('mouseup', () => { drag = false; });
    window.addEventListener('mousemove', e => {
      if (!drag) return;
      rotY += (e.clientX - prevM.x) * 0.006;
      rotX += (e.clientY - prevM.y) * 0.006;
      rotX = Math.max(-1.4, Math.min(1.4, rotX));
      prevM = { x: e.clientX, y: e.clientY };
    });
    canvas.addEventListener('wheel', e => {
      zoom += e.deltaY * 0.002;
      zoom = Math.max(1.5, Math.min(10, zoom));
      const lbl = document.getElementById('zlabel');
      if (lbl) lbl.textContent = 'ZOOM: ' + zoom.toFixed(1) + 'x';
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchstart', e => {
      if (e.touches.length === 1) { drag = true; autoRot = false; prevM = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }
    });
    canvas.addEventListener('touchmove', e => {
      if (!drag || e.touches.length !== 1) return;
      rotY += (e.touches[0].clientX - prevM.x) * 0.006;
      rotX += (e.touches[0].clientY - prevM.y) * 0.006;
      rotX = Math.max(-1.4, Math.min(1.4, rotX));
      prevM = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchend', () => { drag = false; });
  }

  // ── Animate property helper ───────────────────────────────
  function animateProp(obj, prop, from, to, dur) {
    const start = performance.now();
    function step() {
      const t = Math.min((performance.now() - start) / dur, 1);
      obj[prop] = from + (to - from) * t;
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // ── GOD VIEW transitions ──────────────────────────────────
  function enterGodView() {
    earth.visible = false; clouds.visible = false; gridMesh.visible = false; atmoMesh.visible = false;
    godSphere.visible = true; godSphereMat.opacity = 0.01;
    animateProp(warGrid1Mat, 'opacity', 0, 0.12, 1200);
    animateProp(warGrid2Mat, 'opacity', 0, 0.06, 1400);
    animateProp(godAtMat,    'opacity', 0, 0.08, 1000);
    setTimeout(() => { starMat.color.setHex(0xff2200); starMat.opacity = 0.35; }, 400);
    ambLight.color.setHex(0x1a0000); ambLight.intensity = 0.6;
    sunLight.color.setHex(0xff2200); sunLight.intensity = 0.9;
  }

  function exitGodView() {
    earth.visible = true; clouds.visible = true; gridMesh.visible = true; atmoMesh.visible = true;
    godSphere.visible = false;
    animateProp(warGrid1Mat, 'opacity', warGrid1Mat.opacity, 0, 600);
    animateProp(warGrid2Mat, 'opacity', warGrid2Mat.opacity, 0, 600);
    animateProp(godAtMat,    'opacity', godAtMat.opacity,    0, 600);
    starMat.color.setHex(0xccccdd); starMat.opacity = 0.55;
    ambLight.color.setHex(0x111122); ambLight.intensity = 0.4;
    sunLight.color.setHex(0xffffff); sunLight.intensity = 1.2;
  }

  // ── Render ────────────────────────────────────────────────
  function render() {
    frame++;
    if (autoRot) rotY += 0.0008;

    const sunDir = getSunDirection();
    earthMat.uniforms.sunDirection.value.copy(sunDir);
    atmoMat.uniforms.sunDirection.value.copy(sunDir);
    sunLight.position.copy(sunDir.clone().multiplyScalar(10));

    const allGroups = [earth, clouds, gridMesh, atmoMesh, godSphere, warGrid1, warGrid2, godAtmo, satGroup, airGroup, trailGroup, labelGroup, bracketGroup];
    allGroups.forEach(g => { g.rotation.x = rotX; g.rotation.y = rotY; });
    clouds.rotation.y = rotY + frame * 0.00005;

    // ── Zoom: read from internal variable, camera follows ──
    camera.position.z = zoom;
    renderer.render(scene, camera);
  }

  // ── Public API ────────────────────────────────────────────
  return {
    init, render, resize, enterGodView, exitGodView, animateProp,
    makeLabelSprite, makeBracket,
    get scene()        { return scene; },
    get camera()       { return camera; },
    get canvas()       { return canvas; },
    get wrap()         { return wrap; },
    get satGroup()     { return satGroup; },
    get airGroup()     { return airGroup; },
    get trailGroup()   { return trailGroup; },
    get labelGroup()   { return labelGroup; },
    get bracketGroup() { return bracketGroup; },
    get rotX()  { return rotX; },  set rotX(v)  { rotX = v; },
    get rotY()  { return rotY; },  set rotY(v)  { rotY = v; },
    get zoom()  { return zoom; },  set zoom(v)  { zoom = Math.max(1.5, Math.min(10, v)); },
    get drag()  { return drag; },
    get autoRot() { return autoRot; }, set autoRot(v) { autoRot = v; },
    get frame() { return frame; },
    get godMode() { return !earth.visible; },
  };
})();
