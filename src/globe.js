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
  let geoGrid, flagGroup;
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
    createClickBlocker();
    geoGrid  = createGeoGrid();
    flagGroup = createFlagMarkers();
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
    // Load standard res immediately for fast startup
    const dayTex    = loader.load(CONFIG.textures.day);
    const nightTex  = loader.load(CONFIG.textures.night);
    const normalTex = loader.load(CONFIG.textures.topo);
    const cloudTex  = loader.load(CONFIG.textures.clouds);

    // Anisotropic filtering for sharper textures at oblique angles
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    dayTex.anisotropy   = maxAniso;
    nightTex.anisotropy = maxAniso;

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
    earth = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 64), earthMat);
    scene.add(earth);

    // Progressive high-res upgrade — load NASA 8K in background
    if (CONFIG.textures.dayHR) {
      loader.load(CONFIG.textures.dayHR,
        tex => {
          tex.anisotropy = maxAniso;
          earthMat.uniforms.dayTexture.value = tex;
          earthMat.needsUpdate = true;
        },
        undefined,
        () => {} // silently fail if blocked (NASA CDN has CORS restrictions)
      );
    }
    if (CONFIG.textures.nightHR) {
      loader.load(CONFIG.textures.nightHR,
        tex => {
          tex.anisotropy = maxAniso;
          earthMat.uniforms.nightTexture.value = tex;
          earthMat.needsUpdate = true;
        },
        undefined,
        () => {}
      );
    }

    cloudMat = new THREE.MeshPhongMaterial({
      map: cloudTex, transparent: true, opacity: 0.22, depthWrite: false
    });
    clouds = new THREE.Mesh(new THREE.SphereGeometry(1.008, 128, 64), cloudMat);
    scene.add(clouds);

    gridMesh = new THREE.Mesh(
      new THREE.SphereGeometry(1.002, 48, 24),
      new THREE.MeshBasicMaterial({ color: 0x00ff41, wireframe: true, transparent: true, opacity: 0.02 })
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

    godAtMat = new THREE.MeshBasicMaterial({ color: 0x002244, transparent: true, opacity: 0, side: THREE.BackSide });
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
    labelGroup  = new THREE.Group();
    bracketGroup= new THREE.Group();
    scene.add(satGroup, airGroup, trailGroup, labelGroup, bracketGroup);
  }

  // ── Click-blocker: solid sphere at earth surface ─────────
  // Prevents raycasts from hitting objects on the far side of the globe
  function createClickBlocker() {
    const mat = new THREE.MeshBasicMaterial({
      color: 0x000000, transparent: true, opacity: 0.001,
      side: THREE.FrontSide, depthWrite: true,
    });
    const blocker = new THREE.Mesh(new THREE.SphereGeometry(1.001, 64, 32), mat);
    blocker.renderOrder = 0;
    blocker.userData.isBlocker = true;
    scene.add(blocker);
    return blocker;
  }

  // ── Lat/Lon grid with coordinate labels ──────────────────
  function createGeoGrid() {
    const gridGroup = new THREE.Group();
    const R = 1.002;

    const lineMat    = new THREE.LineBasicMaterial({ color: 0x00f5ff, transparent: true, opacity: 0.15 });
    const majorMat   = new THREE.LineBasicMaterial({ color: 0x00f5ff, transparent: true, opacity: 0.35 });
    const equatorMat = new THREE.LineBasicMaterial({ color: 0xffb700, transparent: true, opacity: 0.6 });
    const primeMat   = new THREE.LineBasicMaterial({ color: 0xffb700, transparent: true, opacity: 0.6 });
    const tropicMat  = new THREE.LineBasicMaterial({ color: 0x7b2fff, transparent: true, opacity: 0.4 });

    const ll2v = (lat, lon, r) => {
      const phi   = (90 - lat) * Math.PI / 180;
      const theta = (lon + 180) * Math.PI / 180;
      return new THREE.Vector3(
        -r * Math.sin(phi) * Math.cos(theta),
         r * Math.cos(phi),
         r * Math.sin(phi) * Math.sin(theta)
      );
    };

    // Latitude parallels
    for (let lat = -80; lat <= 80; lat += 10) {
      const pts = [];
      for (let lon = -180; lon <= 180; lon += 2) pts.push(ll2v(lat, lon, R));
      const mat = lat === 0 ? equatorMat : (lat % 30 === 0 ? majorMat : lineMat);
      gridGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat));
    }

    // Longitude meridians
    for (let lon = -180; lon < 180; lon += 10) {
      const pts = [];
      for (let lat = -90; lat <= 90; lat += 2) pts.push(ll2v(lat, lon, R));
      const mat = lon === 0 ? primeMat : (lon % 30 === 0 ? majorMat : lineMat);
      gridGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat));
    }

    // Tropics + Arctic/Antarctic circles (violet)
    [23.5, -23.5, 66.5, -66.5].forEach(lat => {
      const pts = [];
      for (let lon = -180; lon <= 180; lon += 2) pts.push(ll2v(lat, lon, R));
      gridGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), tropicMat));
    });

    // Coordinate text labels
    const coordLabels = [
      { lat:0, lon:0, t:'0°' }, { lat:0, lon:90, t:'90°E' }, { lat:0, lon:-90, t:'90°W' },
      { lat:0, lon:180, t:'180°' }, { lat:30, lon:0, t:'30°N' }, { lat:-30, lon:0, t:'30°S' },
      { lat:60, lon:0, t:'60°N' }, { lat:-60, lon:0, t:'60°S' },
      { lat:0, lon:30, t:'30°E' }, { lat:0, lon:60, t:'60°E' }, { lat:0, lon:120, t:'120°E' },
      { lat:0, lon:150, t:'150°E' }, { lat:0, lon:-30, t:'30°W' }, { lat:0, lon:-60, t:'60°W' },
      { lat:0, lon:-120, t:'120°W' }, { lat:0, lon:-150, t:'150°W' },
    ];
    coordLabels.forEach(({ lat, lon, t }) => {
      const spr = makeLabelSprite(t, '#ffb700', 0.55, 8);
      spr.position.copy(ll2v(lat, lon, R + 0.02));
      spr.userData.isGridLabel = true;
      gridGroup.add(spr);
    });

    scene.add(gridGroup);
    return gridGroup;
  }

  // ── Country flag markers ──────────────────────────────────
  const TZ_MARKERS = [
    { flag:'🇺🇸', lat:38.9, lon:-77.0, name:'USA' }, { flag:'🇨🇦', lat:45.4, lon:-75.7, name:'CAN' },
    { flag:'🇬🇧', lat:51.5, lon:-0.1,  name:'GBR' }, { flag:'🇫🇷', lat:48.9, lon:2.3,   name:'FRA' },
    { flag:'🇩🇪', lat:52.5, lon:13.4,  name:'DEU' }, { flag:'🇷🇺', lat:55.8, lon:37.6,  name:'RUS' },
    { flag:'🇨🇳', lat:39.9, lon:116.4, name:'CHN' }, { flag:'🇯🇵', lat:35.7, lon:139.7, name:'JPN' },
    { flag:'🇮🇳', lat:28.6, lon:77.2,  name:'IND' }, { flag:'🇧🇷', lat:-15.8,lon:-47.9, name:'BRA' },
    { flag:'🇦🇺', lat:-35.3,lon:149.1, name:'AUS' }, { flag:'🇿🇦', lat:-25.7,lon:28.2,  name:'ZAF' },
    { flag:'🇳🇬', lat:9.1,  lon:7.5,   name:'NGA' }, { flag:'🇦🇷', lat:-34.6,lon:-58.4, name:'ARG' },
    { flag:'🇲🇽', lat:19.4, lon:-99.1, name:'MEX' }, { flag:'🇮🇩', lat:-6.2, lon:106.8, name:'IDN' },
    { flag:'🇸🇦', lat:24.7, lon:46.7,  name:'SAU' }, { flag:'🇹🇷', lat:39.9, lon:32.9,  name:'TUR' },
    { flag:'🇰🇷', lat:37.6, lon:127.0, name:'KOR' }, { flag:'🇵🇰', lat:33.7, lon:73.1,  name:'PAK' },
    { flag:'🇮🇷', lat:35.7, lon:51.4,  name:'IRN' }, { flag:'🇪🇬', lat:30.1, lon:31.2,  name:'EGY' },
    { flag:'🇬🇪', lat:41.7, lon:44.8,  name:'GEO' }, { flag:'🇺🇦', lat:50.5, lon:30.5,  name:'UKR' },
    { flag:'🇳🇿', lat:-41.3,lon:174.8, name:'NZL' }, { flag:'🇸🇬', lat:1.4,  lon:103.8, name:'SGP' },
    { flag:'🇹🇭', lat:13.8, lon:100.5, name:'THA' }, { flag:'🇪🇪', lat:59.4, lon:24.7,  name:'EST' },
  ];

  function makeFlagSprite(flag, name) {
    const cv = document.createElement('canvas');
    cv.width = 60; cv.height = 30;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, 60, 30);
    ctx.font = '18px serif';
    ctx.fillText(flag, 0, 20);
    ctx.font = '7px "Share Tech Mono", monospace';
    ctx.fillStyle = 'rgba(0,245,255,0.9)';
    ctx.fillText(name, 22, 11);
    const tex = new THREE.CanvasTexture(cv);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, opacity: 0.9 });
    const spr = new THREE.Sprite(mat);
    spr.scale.set(0.09, 0.045, 1);
    return spr;
  }

  function createFlagMarkers() {
    const flagGroup = new THREE.Group();
    TZ_MARKERS.forEach(m => {
      const spr = makeFlagSprite(m.flag, m.name);
      const phi   = (90 - m.lat) * Math.PI / 180;
      const theta = (m.lon + 180) * Math.PI / 180;
      const r = 1.016;
      spr.position.set(
        -r * Math.sin(phi) * Math.cos(theta),
         r * Math.cos(phi),
         r * Math.sin(phi) * Math.sin(theta)
      );
      spr.userData.isFlag = true;
      flagGroup.add(spr);
    });
    scene.add(flagGroup);
    return flagGroup;
  }

  // ── Label sprite helper ───────────────────────────────────
  // Creates a canvas-text sprite for floating labels above objects
  function makeLabelSprite(text, color = '#ffb700', bgAlpha = 0.0, fontSize = 11) {
    const lc = document.createElement('canvas');
    const padding = 6;
    const ctx = lc.getContext('2d');
    ctx.font = `${fontSize}px "Share Tech Mono", monospace`;
    const tw = ctx.measureText(text).width;
    lc.width  = tw + padding * 2;
    lc.height = fontSize + padding * 2;
    ctx.font = `${fontSize}px "Share Tech Mono", monospace`;
    if (bgAlpha > 0) {
      ctx.fillStyle = `rgba(0,0,0,${bgAlpha})`;
      ctx.fillRect(0, 0, lc.width, lc.height);
    }
    ctx.fillStyle = color;
    ctx.fillText(text, padding, fontSize + padding * 0.6);
    const tex = new THREE.CanvasTexture(lc);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    // Fixed world-space size — not dependent on canvas pixel dimensions
    const charW = 0.012;
    sprite.scale.set(text.length * charW, 0.045, 1);
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
    animateProp(warGrid1Mat, 'opacity', 0, 0.14, 1200);
    animateProp(warGrid2Mat, 'opacity', 0, 0.07, 1400);
    animateProp(godAtMat,    'opacity', 0, 0.1,  1000);
    // Teal/navy war mode — readable, not eye-searing red
    godSphereMat.color.setHex(0x000a14);
    warGrid1Mat.color.setHex(0x00ffcc);
    warGrid2Mat.color.setHex(0x00ccff);
    godAtMat.color.setHex(0x002244);
    setTimeout(() => { starMat.color.setHex(0x00ffcc); starMat.opacity = 0.6; }, 400);
    ambLight.color.setHex(0x001122); ambLight.intensity = 0.7;
    sunLight.color.setHex(0x00ccff); sunLight.intensity = 1.0;
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

    const allGroups = [earth, clouds, gridMesh, atmoMesh, godSphere, warGrid1, warGrid2, godAtmo, satGroup, airGroup, trailGroup, labelGroup, bracketGroup, geoGrid, flagGroup];
    allGroups.forEach(g => { if (g) { g.rotation.x = rotX; g.rotation.y = rotY; } });
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
    get geoGrid()      { return geoGrid; },
    get flagGroup()    { return flagGroup; },
    get cloudsMesh()   { return clouds; },
    get rotX()  { return rotX; },  set rotX(v)  { rotX = v; },
    get rotY()  { return rotY; },  set rotY(v)  { rotY = v; },
    get zoom()  { return zoom; },  set zoom(v)  { zoom = Math.max(1.5, Math.min(10, v)); },
    get drag()  { return drag; },
    get autoRot() { return autoRot; }, set autoRot(v) { autoRot = v; },
    get frame() { return frame; },
    get godMode() { return !earth.visible; },
  };
})();
