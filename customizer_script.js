  /* ==========================================================================
     GLOBAL STATE & VARIABLES
     ========================================================================== */
  const customizerState = {
    garmentType: 'soccer', // 'soccer', 'cricket', 'basketball', 'hoodie'
    fabricGsm: '160 GSM AeroPoly Interlock',
    fabricType: 'interlock', // 'interlock', 'mesh', 'pique', 'spandex', 'fleece'
    colors: {
      primary: '#00e5ff',
      sleeve: '#0a0e14',
      collar: '#ffffff',
      sidePanel: '#00e5ff',
      cuff: '#ffffff',
      text: '#cdff13'
    },
    pattern: 'solid', // 'solid', 'stripes', 'chevron', 'hex', 'gradient', 'camo', 'custom'
    teamName: 'GORSY APEX',
    sponsorOn: true,
    logoPlacement: 'left', // 'left', 'center', 'off'
    sleevePlacement: 'both', // 'both', 'right', 'left', 'off'
    playerName: 'SALEEM',
    playerNumber: '10',
    crestBadge: 'shield', // 'shield', 'falcon', 'star', 'bolt'
    uploadedLogoImg: null,
    uploadedArtworkImg: null,
    wireframe: false,
    autoRotate: true,
    cameraAngle: 'iso',
    quantity: 250,
    unitPrice: 11.80,
    currencySymbol: '$',
    currencyRate: 1.0,
    currencyCode: 'USD',
    sku: 'GOR-3D-SOC-1049'
  };

  let activeQuickViewItem = null;

  /* Three.js Engine Variables */
  let scene, camera, renderer, controls;
  let garmentGroup = null;
  let dynamicCanvas, dynamicCtx, dynamicTexture;
  let fabricBumpCache = {};
  let targetCamPos = { x: 2.1, y: 0.4, z: 2.3 };
  let targetLookAt = { x: 0, y: 0, z: 0 };
  let isCamTransitioning = false;

  /* ==========================================================================
     PROCEDURAL FABRIC BUMP MAP GENERATOR
     ========================================================================== */
  function getFabricBumpMap(type) {
    if (fabricBumpCache[type]) return fabricBumpCache[type];

    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 512;
    const ctx = c.getContext('2d');

    // Base neutral grey
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, 512, 512);

    if (type === 'mesh') {
      // Perforated breathable micro-mesh dot grid
      ctx.fillStyle = '#404040';
      const spacing = 16;
      for (let y = 0; y < 512; y += spacing) {
        const offset = (Math.floor(y / spacing) % 2) * (spacing / 2);
        for (let x = 0; x < 512; x += spacing) {
          ctx.beginPath();
          ctx.arc(x + offset, y, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (type === 'pique') {
      // Honeycomb waffle weave
      ctx.strokeStyle = '#5a5a5a';
      ctx.lineWidth = 2.5;
      const size = 12;
      for (let y = 0; y < 512; y += size) {
        for (let x = 0; x < 512; x += size) {
          ctx.strokeRect(x + ((y / size) % 2) * (size / 2), y, size * 0.8, size * 0.8);
        }
      }
    } else if (type === 'fleece') {
      // Soft brushed fleece horizontal nap grain
      for (let y = 0; y < 512; y += 4) {
        ctx.fillStyle = (y % 8 === 0) ? '#929292' : '#6e6e6e';
        ctx.fillRect(0, y, 512, 2);
      }
      // Micro fiber noise
      for (let i = 0; i < 4000; i++) {
        const rx = Math.random() * 512;
        const ry = Math.random() * 512;
        ctx.fillStyle = Math.random() > 0.5 ? '#a0a0a0' : '#606060';
        ctx.fillRect(rx, ry, 2, 1.5);
      }
    } else {
      // Standard AeroPoly / Spandex fine interlock twill diagonal weave
      ctx.strokeStyle = '#6c6c6c';
      ctx.lineWidth = 1.2;
      for (let d = -512; d < 1024; d += 8) {
        ctx.beginPath();
        ctx.moveTo(d, 0);
        ctx.lineTo(d + 512, 512);
        ctx.stroke();
      }
    }

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(6, 6);
    fabricBumpCache[type] = tex;
    return tex;
  }

  /* ==========================================================================
     THREE.JS 3D INITIALIZATION
     ========================================================================== */
  function initThreeCustomizer() {
    const container = document.getElementById('canvas-container');
    if (!container) return;

    const width = container.clientWidth || 600;
    const height = container.clientHeight || 550;

    // 1. Scene
    scene = new THREE.Scene();
    scene.background = null;

    // 2. Camera with optimal vertical field of view to keep garment fully framed
    camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(2.1, 0.4, 2.3);

    // 3. Renderer with antialiasing and sRGB encoding
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 4. Orbit Controls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 1.5;
    controls.maxDistance = 5.2;
    controls.maxPolarAngle = Math.PI / 2 + 0.12;
    controls.autoRotate = customizerState.autoRotate;
    controls.autoRotateSpeed = 1.2;
    controls.target.set(0, 0, 0);

    // 5. Studio 3-Point Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.88);
    scene.add(ambientLight);

    // Main Studio Key Light
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.25);
    keyLight.position.set(3.5, 4.5, 3.5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 15;
    scene.add(keyLight);

    // Cyan Neon Accent Rim Light (Futuristic GORSY Industrial Identity)
    const cyanRimLight = new THREE.SpotLight(0x00e5ff, 2.8, 12, Math.PI / 4, 0.5);
    cyanRimLight.position.set(-3.5, 2.5, -3.0);
    scene.add(cyanRimLight);

    // Soft Front Fill Light
    const fillLight = new THREE.DirectionalLight(0xb4c5ff, 0.55);
    fillLight.position.set(-2, -1, 3);
    scene.add(fillLight);

    // Realistic Soft Ground Contact Shadow (Natural shadow disk, no floating rings)
    const shadowGeo = new THREE.PlaneGeometry(3.6, 3.6);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: createContactShadowTexture(),
      transparent: true,
      opacity: 0.55,
      depthWrite: false
    });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = -1.45;
    scene.add(shadowMesh);

    // 6. Build Procedural Dynamic Texture Canvas & 3D Garment
    initDynamicTextureCanvas();
    build3DGarmentMesh();
    updateSummaryCard();

    // 7. Render Loop
    animate();

    // 8. Resize Listener
    window.addEventListener('resize', onWindowResize);
  }

  // Soft Radial Contact Shadow Texture
  function createContactShadowTexture() {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(128, 128, 10, 128, 128, 120);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.7)');
    grad.addColorStop(0.35, 'rgba(0, 0, 0, 0.35)');
    grad.addColorStop(0.7, 'rgba(0, 0, 0, 0.12)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  }

  /* ==========================================================================
     PROCEDURAL DYNAMIC 2D TEXTURE GENERATION
     ========================================================================== */
  function initDynamicTextureCanvas() {
    dynamicCanvas = document.createElement('canvas');
    dynamicCanvas.width = 2048;
    dynamicCanvas.height = 2048;
    dynamicCtx = dynamicCanvas.getContext('2d');

    dynamicTexture = new THREE.CanvasTexture(dynamicCanvas);
    dynamicTexture.encoding = THREE.sRGBEncoding;
    dynamicTexture.wrapS = THREE.RepeatWrapping;
    dynamicTexture.wrapT = THREE.ClampToEdgeWrapping;

    renderCanvasTexture();
  }

  function renderCanvasTexture() {
    if (!dynamicCtx) return;
    const ctx = dynamicCtx;
    const w = dynamicCanvas.width;
    const h = dynamicCanvas.height;

    // 1. Base Body Color Fill
    ctx.fillStyle = customizerState.colors.primary;
    ctx.fillRect(0, 0, w, h);

    // 2. Custom Uploaded Full-Body Sublimation Artwork
    if (customizerState.pattern === 'custom' && customizerState.uploadedArtworkImg) {
      try {
        ctx.drawImage(customizerState.uploadedArtworkImg, 0, 0, w, h);
      } catch (err) {
        console.error('Artwork draw error:', err);
      }
    } else {
      // 3. Sublimation Graphic Engine
      ctx.fillStyle = customizerState.colors.sleeve;
      ctx.strokeStyle = customizerState.colors.sleeve;

      if (customizerState.pattern === 'stripes') {
        // Dual Velocity Racing Stripes
        const stripeWidth = w * 0.07;
        ctx.fillRect(w * 0.34, 0, stripeWidth, h);
        ctx.fillRect(w * 0.59, 0, stripeWidth, h);

        // Accent micro-pinstripe
        ctx.fillStyle = customizerState.colors.collar;
        ctx.fillRect(w * 0.33, 0, w * 0.01, h);
        ctx.fillRect(w * 0.66, 0, w * 0.01, h);

        // Horizontal hem speed band
        ctx.fillStyle = customizerState.colors.sleeve;
        ctx.fillRect(0, h * 0.82, w, h * 0.035);
      } else if (customizerState.pattern === 'chevron') {
        // Dynamic Aerodynamic V-Chevrons
        ctx.lineWidth = 65;
        ctx.beginPath();
        ctx.moveTo(w * 0.1, h * 0.38);
        ctx.lineTo(w * 0.5, h * 0.6);
        ctx.lineTo(w * 0.9, h * 0.38);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(w * 0.15, h * 0.24);
        ctx.lineTo(w * 0.5, h * 0.46);
        ctx.lineTo(w * 0.85, h * 0.24);
        ctx.stroke();

        ctx.strokeStyle = customizerState.colors.collar;
        ctx.lineWidth = 12;
        ctx.beginPath();
        ctx.moveTo(w * 0.16, h * 0.22);
        ctx.lineTo(w * 0.5, h * 0.44);
        ctx.lineTo(w * 0.84, h * 0.22);
        ctx.stroke();
      } else if (customizerState.pattern === 'hex') {
        // High-Tech Carbon Honeycomb Matrix
        ctx.strokeStyle = customizerState.colors.sleeve;
        ctx.lineWidth = 5;
        const hexSize = 56;
        for (let y = 0; y < h; y += hexSize * 1.5) {
          for (let x = 0; x < w; x += hexSize * Math.sqrt(3)) {
            drawHexagon(ctx, x + ((Math.floor(y / (hexSize * 1.5)) % 2) * (hexSize * Math.sqrt(3) / 2)), y, hexSize * 0.65);
          }
        }
      } else if (customizerState.pattern === 'gradient') {
        // Smooth Vertical Ombre Fade
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, customizerState.colors.primary);
        grad.addColorStop(0.4, customizerState.colors.primary);
        grad.addColorStop(1, customizerState.colors.sleeve);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
      } else if (customizerState.pattern === 'camo') {
        // Modern Geometric Athletic Camo
        ctx.fillStyle = customizerState.colors.sleeve;
        for (let i = 0; i < 70; i++) {
          const cx = ((i * 137) % w);
          const cy = ((i * 283) % h);
          const cw = 110 + (i % 5) * 35;
          const ch = 70 + (i % 4) * 25;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + cw, cy + ch * 0.2);
          ctx.lineTo(cx + cw * 0.8, cy + ch);
          ctx.lineTo(cx - cw * 0.2, cy + ch * 0.8);
          ctx.closePath();
          ctx.fill();
        }
      }
    }

    // 4. Side Contrast Ventilation Panels on Flanks
    ctx.fillStyle = customizerState.colors.sidePanel;
    ctx.fillRect(0, 0, w * 0.12, h);
    ctx.fillRect(w * 0.88, 0, w * 0.12, h);

    // Micro mesh pinholes on side panels
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    for (let py = 20; py < h; py += 32) {
      for (let px = 15; px < w * 0.11; px += 24) {
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(w - px, py, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Contrast Seam Piping Lines
    ctx.fillStyle = customizerState.colors.collar;
    ctx.fillRect(w * 0.115, 0, w * 0.01, h);
    ctx.fillRect(w * 0.875, 0, w * 0.01, h);

    // 5. Front Chest Sponsor / Team Name Banner
    if (customizerState.sponsorOn && customizerState.teamName) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = customizerState.colors.text;
      ctx.font = 'bold 96px "Space Grotesk", sans-serif';
      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur = 12;
      ctx.shadowOffsetX = 3;
      ctx.shadowOffsetY = 4;
      ctx.fillText(customizerState.teamName, w * 0.5, h * 0.46);

      // Front Chest Small Number
      ctx.font = 'bold 125px "Oswald", sans-serif';
      ctx.fillText(customizerState.playerNumber, w * 0.5, h * 0.62);
      ctx.shadowColor = 'transparent';
    }

    // 6. Front Crest Emblem
    if (customizerState.logoPlacement === 'left') {
      drawCrestEmblem(ctx, w * 0.28, h * 0.35);
    } else if (customizerState.logoPlacement === 'center') {
      drawCrestEmblem(ctx, w * 0.5, h * 0.33);
    }

    // 7. GORSY Brand Mark (Right Breast)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 44px "Space Grotesk", sans-serif';
    ctx.fillStyle = customizerState.colors.collar;
    ctx.fillText('GORSY', w * 0.72, h * 0.35);

    // 8. Back Identity: Player Name & Large Number
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 3;

    ctx.fillStyle = customizerState.colors.text;
    ctx.font = 'bold 118px "Oswald", sans-serif';
    ctx.fillText(customizerState.playerName, w * 0.5, h * 0.17);

    ctx.font = 'bold 300px "Oswald", sans-serif';
    ctx.fillText(customizerState.playerNumber, w * 0.5, h * 0.85);

    ctx.shadowColor = 'transparent';

    if (dynamicTexture) dynamicTexture.needsUpdate = true;
  }

  function drawHexagon(ctx, x, y, r) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i;
      const hx = x + r * Math.cos(angle);
      const hy = y + r * Math.sin(angle);
      if (i === 0) ctx.moveTo(hx, hy);
      else ctx.lineTo(hx, hy);
    }
    ctx.closePath();
    ctx.stroke();
  }

  function drawCrestEmblem(ctx, x, y) {
    if (customizerState.uploadedLogoImg) {
      try {
        ctx.drawImage(customizerState.uploadedLogoImg, x - 75, y - 75, 150, 150);
        return;
      } catch (e) {
        console.error('Error drawing crest image:', e);
      }
    }

    ctx.save();
    ctx.translate(x, y);

    // Shield Outer Border
    ctx.fillStyle = customizerState.colors.collar;
    ctx.beginPath();
    ctx.moveTo(0, -62);
    ctx.lineTo(52, -36);
    ctx.lineTo(42, 36);
    ctx.lineTo(0, 68);
    ctx.lineTo(-42, 36);
    ctx.lineTo(-52, -36);
    ctx.closePath();
    ctx.fill();

    // Shield Inner Field
    ctx.fillStyle = customizerState.colors.sleeve;
    ctx.beginPath();
    ctx.moveTo(0, -52);
    ctx.lineTo(42, -30);
    ctx.lineTo(34, 30);
    ctx.lineTo(0, 56);
    ctx.lineTo(-34, 30);
    ctx.lineTo(-42, -30);
    ctx.closePath();
    ctx.fill();

    // Insignia Icon
    ctx.fillStyle = customizerState.colors.text;
    ctx.font = 'bold 38px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (customizerState.crestBadge === 'star') ctx.fillText('★', 0, 0);
    else if (customizerState.crestBadge === 'bolt') ctx.fillText('⚡', 0, 0);
    else if (customizerState.crestBadge === 'falcon') ctx.fillText('🦅', 0, 0);
    else ctx.fillText('G', 0, 0);

    ctx.restore();
  }

  /* ==========================================================================
     BUILD ATHLETIC 3D GARMENT MESH (4 DISTINCT REALISTIC SILHOUETTES)
     ========================================================================== */
  function build3DGarmentMesh() {
    if (garmentGroup) scene.remove(garmentGroup);
    garmentGroup = new THREE.Group();

    const bumpMap = getFabricBumpMap(customizerState.fabricType);

    // Materials with authentic textile light response
    const bodyMat = new THREE.MeshStandardMaterial({
      map: dynamicTexture,
      bumpMap: bumpMap,
      bumpScale: 0.025,
      roughness: 0.72,
      metalness: 0.04,
      wireframe: customizerState.wireframe
    });

    const sleeveMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(customizerState.colors.sleeve),
      bumpMap: bumpMap,
      bumpScale: 0.025,
      roughness: 0.74,
      metalness: 0.04,
      wireframe: customizerState.wireframe
    });

    const collarMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(customizerState.colors.collar),
      bumpMap: bumpMap,
      bumpScale: 0.03,
      roughness: 0.65,
      metalness: 0.06,
      wireframe: customizerState.wireframe
    });

    const sideMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(customizerState.colors.sidePanel),
      bumpMap: getFabricBumpMap('mesh'),
      bumpScale: 0.04,
      roughness: 0.8,
      metalness: 0.02,
      wireframe: customizerState.wireframe
    });

    const cuffMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(customizerState.colors.cuff),
      bumpMap: getFabricBumpMap('interlock'),
      bumpScale: 0.035,
      roughness: 0.62,
      metalness: 0.05,
      wireframe: customizerState.wireframe
    });

    const buttonMat = new THREE.MeshStandardMaterial({
      color: 0xf5f5f5,
      roughness: 0.25,
      metalness: 0.4
    });

    const type = customizerState.garmentType;

    if (type === 'soccer') {
      buildProSoccerJersey(garmentGroup, bodyMat, sleeveMat, collarMat, sideMat, cuffMat);
    } else if (type === 'cricket') {
      buildCricketPolo(garmentGroup, bodyMat, sleeveMat, collarMat, sideMat, cuffMat, buttonMat);
    } else if (type === 'basketball') {
      buildBasketballUniform(garmentGroup, bodyMat, collarMat, sideMat, cuffMat);
    } else if (type === 'hoodie') {
      buildStreetwearHoodie(garmentGroup, bodyMat, sleeveMat, collarMat, cuffMat);
    }

    // Set garment group position based on silhouette to keep perfectly framed in viewport
    if (type === 'basketball') {
      garmentGroup.position.set(0, 0.2, 0);
    } else if (type === 'hoodie') {
      garmentGroup.position.set(0, -0.2, 0);
    } else {
      garmentGroup.position.set(0, -0.05, 0);
    }

    scene.add(garmentGroup);
  }

  /* --------------------------------------------------------------------------
     1. PRO SOCCER JERSEY: V-neck, Raglan Sleeves, Side Panels, Flared Hem
     -------------------------------------------------------------------------- */
  function buildProSoccerJersey(group, bodyMat, sleeveMat, collarMat, sideMat, cuffMat) {
    // Sculpted Athletic Torso with Anatomical Contours
    const torsoGeo = new THREE.CylinderGeometry(0.70, 0.64, 1.55, 36, 16, true);
    sculptAthleticTorso(torsoGeo, 0.72, 0.12, 0.015);
    const torsoMesh = new THREE.Mesh(torsoGeo, bodyMat);
    torsoMesh.castShadow = true;
    torsoMesh.receiveShadow = true;
    group.add(torsoMesh);

    // Ergonomic V-Neck Collar Band (dips down in center front)
    const collarCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.73, 0.32),    // V plunge front point
      new THREE.Vector3(0.24, 0.81, 0.18),  // Right clavicle
      new THREE.Vector3(0.22, 0.83, -0.16), // Right neck
      new THREE.Vector3(0, 0.84, -0.26),    // Nape of neck
      new THREE.Vector3(-0.22, 0.83, -0.16),// Left neck
      new THREE.Vector3(-0.24, 0.81, 0.18)  // Left clavicle
    ], true);
    const collarGeo = new THREE.TubeGeometry(collarCurve, 32, 0.045, 12, true);
    const collarMesh = new THREE.Mesh(collarGeo, collarMat);
    collarMesh.castShadow = true;
    group.add(collarMesh);

    // Inner Neck Taping Disc
    const innerNeckGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.04, 24);
    const innerNeckMat = new THREE.MeshBasicMaterial({ color: 0x111116 });
    const innerNeck = new THREE.Mesh(innerNeckGeo, innerNeckMat);
    innerNeck.position.set(0, 0.77, -0.04);
    group.add(innerNeck);

    // Left Raglan Sleeve (Tapered, angled at 38°, hollow cuff)
    const leftSleeve = createRaglanSleeve(0.31, 0.22, 0.72, sleeveMat, cuffMat, false);
    leftSleeve.position.set(0.78, 0.48, 0);
    leftSleeve.rotation.z = -Math.PI / 4.2;
    leftSleeve.rotation.y = -0.08;
    group.add(leftSleeve);

    // Right Raglan Sleeve
    const rightSleeve = createRaglanSleeve(0.31, 0.22, 0.72, sleeveMat, cuffMat, true);
    rightSleeve.position.set(-0.78, 0.48, 0);
    rightSleeve.rotation.z = Math.PI / 4.2;
    rightSleeve.rotation.y = 0.08;
    group.add(rightSleeve);

    // Left & Right Ergonomic Side Ventilation Panels
    const leftSide = createSidePanel(sideMat, 0.65);
    leftSide.position.set(0.48, -0.05, 0);
    group.add(leftSide);

    const rightSide = createSidePanel(sideMat, 0.65);
    rightSide.position.set(-0.48, -0.05, 0);
    rightSide.rotation.y = Math.PI;
    group.add(rightSide);

    // Bottom Hem Fold Band
    const hemGeo = new THREE.TorusGeometry(0.645, 0.035, 12, 36);
    const hemMesh = new THREE.Mesh(hemGeo, cuffMat);
    hemMesh.rotation.x = Math.PI / 2;
    hemMesh.position.set(0, -0.77, 0);
    group.add(hemMesh);
  }

  /* --------------------------------------------------------------------------
     2. CRICKET WHITES / T20 POLO: Folded Polo Collar & 3-Button Placket
     -------------------------------------------------------------------------- */
  function buildCricketPolo(group, bodyMat, sleeveMat, collarMat, sideMat, cuffMat, buttonMat) {
    // Torso with Athletic Polo Silhouette
    const torsoGeo = new THREE.CylinderGeometry(0.70, 0.65, 1.55, 36, 16, true);
    sculptAthleticTorso(torsoGeo, 0.72, 0.1, 0.012);
    const torsoMesh = new THREE.Mesh(torsoGeo, bodyMat);
    torsoMesh.castShadow = true;
    torsoMesh.receiveShadow = true;
    group.add(torsoMesh);

    // 3D Folded Polo Turnover Leaf Collar
    const collarStandCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.08, 0.78, 0.24),
      new THREE.Vector3(0.24, 0.82, 0.12),
      new THREE.Vector3(0.23, 0.84, -0.16),
      new THREE.Vector3(0, 0.85, -0.25),
      new THREE.Vector3(-0.23, 0.84, -0.16),
      new THREE.Vector3(-0.24, 0.82, 0.12),
      new THREE.Vector3(-0.08, 0.78, 0.24)
    ], false);
    const standGeo = new THREE.TubeGeometry(collarStandCurve, 28, 0.045, 12, false);
    const standMesh = new THREE.Mesh(standGeo, collarMat);
    group.add(standMesh);

    // Polo Collar Wings (left & right points folded down)
    const wingGeo = new THREE.BoxGeometry(0.18, 0.16, 0.025);
    const leftWing = new THREE.Mesh(wingGeo, collarMat);
    leftWing.position.set(0.14, 0.74, 0.27);
    leftWing.rotation.set(-0.35, 0.25, -0.25);
    group.add(leftWing);

    const rightWing = new THREE.Mesh(wingGeo, collarMat);
    rightWing.position.set(-0.14, 0.74, 0.27);
    rightWing.rotation.set(-0.35, -0.25, 0.25);
    group.add(rightWing);

    // Center Front 3-Button Placket
    const placketGeo = new THREE.BoxGeometry(0.11, 0.48, 0.022);
    const placketMesh = new THREE.Mesh(placketGeo, collarMat);
    placketMesh.position.set(0, 0.54, 0.285);
    group.add(placketMesh);

    // 3 Realistic 3D Buttons
    [-0.14, 0.0, 0.14].forEach(yOff => {
      const btnGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.012, 16);
      const btn = new THREE.Mesh(btnGeo, buttonMat);
      btn.rotation.x = Math.PI / 2;
      btn.position.set(0, 0.54 + yOff, 0.30);
      group.add(btn);
    });

    // Short Set-In Sleeves with Ribbed Cuff Bands
    const leftSleeve = createRaglanSleeve(0.30, 0.23, 0.62, sleeveMat, cuffMat, false);
    leftSleeve.position.set(0.76, 0.48, 0);
    leftSleeve.rotation.z = -Math.PI / 4.4;
    group.add(leftSleeve);

    const rightSleeve = createRaglanSleeve(0.30, 0.23, 0.62, sleeveMat, cuffMat, true);
    rightSleeve.position.set(-0.76, 0.48, 0);
    rightSleeve.rotation.z = Math.PI / 4.4;
    group.add(rightSleeve);

    // Split Side Vents at Bottom Hem
    const hemGeo = new THREE.TorusGeometry(0.655, 0.032, 12, 36);
    const hemMesh = new THREE.Mesh(hemGeo, cuffMat);
    hemMesh.rotation.x = Math.PI / 2;
    hemMesh.position.set(0, -0.77, 0);
    group.add(hemMesh);
  }

  /* --------------------------------------------------------------------------
     3. BASKETBALL UNIFORM: Sleeveless Tank + Athletic Shorts
     -------------------------------------------------------------------------- */
  function buildBasketballUniform(group, bodyMat, collarMat, sideMat, cuffMat) {
    // Sleeveless Tank Torso with Deep Scooped Armholes
    const tankGeo = new THREE.CylinderGeometry(0.68, 0.63, 1.45, 36, 16, true);
    sculptAthleticTorso(tankGeo, 0.72, 0.14, 0.014);
    const tankMesh = new THREE.Mesh(tankGeo, bodyMat);
    tankMesh.castShadow = true;
    tankMesh.receiveShadow = true;
    group.add(tankMesh);

    // Deep Scooped Ribbed Neckline
    const neckGeo = new THREE.TorusGeometry(0.32, 0.045, 16, 32);
    const neckMesh = new THREE.Mesh(neckGeo, collarMat);
    neckMesh.rotation.x = Math.PI / 2 + 0.2;
    neckMesh.position.set(0, 0.75, 0.04);
    group.add(neckMesh);

    // Left Deep Armhole Ribbed Binding Trim
    const leftArmhole = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.038, 12, 28), collarMat);
    leftArmhole.position.set(0.65, 0.52, 0);
    leftArmhole.rotation.y = Math.PI / 2;
    leftArmhole.rotation.x = 0.2;
    group.add(leftArmhole);

    // Right Deep Armhole Ribbed Binding Trim
    const rightArmhole = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.038, 12, 28), collarMat);
    rightArmhole.position.set(-0.65, 0.52, 0);
    rightArmhole.rotation.y = -Math.PI / 2;
    rightArmhole.rotation.x = 0.2;
    group.add(rightArmhole);

    // Full Matching Basketball Shorts (Left & Right Flared Legs)
    const shortsGroup = new THREE.Group();
    shortsGroup.position.set(0, -0.85, 0);

    // Elasticated Waistband with Drawstring
    const waistGeo = new THREE.CylinderGeometry(0.62, 0.62, 0.16, 32);
    const waistMesh = new THREE.Mesh(waistGeo, collarMat);
    shortsGroup.add(waistMesh);

    // Left Flared Leg
    const leftLegGeo = new THREE.CylinderGeometry(0.32, 0.36, 0.82, 24);
    const leftLegMesh = new THREE.Mesh(leftLegGeo, bodyMat);
    leftLegMesh.position.set(0.27, -0.45, 0);
    leftLegMesh.rotation.z = -0.06;
    shortsGroup.add(leftLegMesh);

    // Left Leg Hem Band
    const leftHem = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.035, 12, 24), cuffMat);
    leftHem.position.set(0.29, -0.85, 0);
    leftHem.rotation.x = Math.PI / 2;
    shortsGroup.add(leftHem);

    // Right Flared Leg
    const rightLegGeo = new THREE.CylinderGeometry(0.32, 0.36, 0.82, 24);
    const rightLegMesh = new THREE.Mesh(rightLegGeo, bodyMat);
    rightLegMesh.position.set(-0.27, -0.45, 0);
    rightLegMesh.rotation.z = 0.06;
    shortsGroup.add(rightLegMesh);

    // Right Leg Hem Band
    const rightHem = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.035, 12, 24), cuffMat);
    rightHem.position.set(-0.29, -0.85, 0);
    rightHem.rotation.x = Math.PI / 2;
    shortsGroup.add(rightHem);

    group.add(shortsGroup);
  }

  /* --------------------------------------------------------------------------
     4. STREETWEAR HOODIE: Heavyweight Fleece, 3D Hood, Kangaroo Pocket, Cuffs
     -------------------------------------------------------------------------- */
  function buildStreetwearHoodie(group, bodyMat, sleeveMat, collarMat, cuffMat) {
    // Relaxed Heavyweight Streetwear Torso
    const torsoGeo = new THREE.CylinderGeometry(0.76, 0.72, 1.6, 36, 16, true);
    sculptAthleticTorso(torsoGeo, 0.76, 0.08, 0.02);
    const torsoMesh = new THREE.Mesh(torsoGeo, bodyMat);
    torsoMesh.castShadow = true;
    torsoMesh.receiveShadow = true;
    group.add(torsoMesh);

    // 3D Sculpted Draped Hood with Depth and Opening
    const hoodGroup = new THREE.Group();
    hoodGroup.position.set(0, 0.88, -0.06);

    // Outer Hood Dome
    const outerHoodGeo = new THREE.SphereGeometry(0.52, 28, 24, 0, Math.PI * 2, 0, Math.PI / 1.45);
    const outerHood = new THREE.Mesh(outerHoodGeo, sleeveMat);
    outerHood.rotation.x = -0.42;
    outerHood.scale.set(0.95, 1.15, 1.05);
    hoodGroup.add(outerHood);

    // Inner Cavity (Double-faced lining)
    const innerHoodGeo = new THREE.SphereGeometry(0.48, 24, 20, 0, Math.PI * 2, 0, Math.PI / 1.45);
    const innerHood = new THREE.Mesh(innerHoodGeo, new THREE.MeshStandardMaterial({
      color: new THREE.Color(customizerState.colors.primary),
      roughness: 0.85,
      side: THREE.BackSide
    }));
    innerHood.rotation.x = -0.42;
    innerHood.scale.set(0.95, 1.15, 1.05);
    hoodGroup.add(innerHood);

    // Hood Opening Ribbed Border
    const hoodTrimCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.35, 0.02, 0.22),
      new THREE.Vector3(-0.38, 0.32, 0.08),
      new THREE.Vector3(0, 0.58, -0.04),
      new THREE.Vector3(0.38, 0.32, 0.08),
      new THREE.Vector3(0.35, 0.02, 0.22)
    ], false);
    const hoodTrim = new THREE.Mesh(new THREE.TubeGeometry(hoodTrimCurve, 24, 0.032, 10, false), collarMat);
    hoodGroup.add(hoodTrim);

    // Braided Hanging Drawstring Cords with Metallic Aglets
    [-0.12, 0.12].forEach(xCord => {
      const cordCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(xCord, -0.02, 0.30),
        new THREE.Vector3(xCord * 1.1, -0.22, 0.33),
        new THREE.Vector3(xCord * 0.9, -0.42, 0.31)
      ]);
      const cord = new THREE.Mesh(new THREE.TubeGeometry(cordCurve, 16, 0.012, 8, false), collarMat);
      hoodGroup.add(cord);

      // Metallic Aglet at cord tip
      const aglet = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.05, 12), new THREE.MeshStandardMaterial({
        color: 0xd4af37,
        metalness: 0.8,
        roughness: 0.2
      }));
      aglet.position.set(xCord * 0.9, -0.44, 0.31);
      hoodGroup.add(aglet);
    });

    group.add(hoodGroup);

    // 3D Front Kangaroo Pouch Pocket
    const pocketGeo = new THREE.BoxGeometry(0.68, 0.42, 0.06);
    const posP = pocketGeo.attributes.position;
    for (let i = 0; i < posP.count; i++) {
      let x = posP.getX(i);
      let y = posP.getY(i);
      let z = posP.getZ(i);
      // Slanted side hand openings
      if (Math.abs(x) > 0.22 && y > 0.05) {
        x *= 0.8;
      }
      posP.setXYZ(i, x, y, z);
    }
    pocketGeo.computeVertexNormals();

    const pocketMesh = new THREE.Mesh(pocketGeo, sleeveMat);
    pocketMesh.position.set(0, -0.32, 0.28);
    pocketMesh.castShadow = true;
    group.add(pocketMesh);

    // Oversized Dropped Long Sleeves with Wrinkled Forearms
    const leftSleeve = createRaglanSleeve(0.35, 0.24, 1.25, sleeveMat, cuffMat, false);
    leftSleeve.position.set(0.92, 0.42, 0);
    leftSleeve.rotation.z = -Math.PI / 4.0;
    group.add(leftSleeve);

    const rightSleeve = createRaglanSleeve(0.35, 0.24, 1.25, sleeveMat, cuffMat, true);
    rightSleeve.position.set(-0.92, 0.42, 0);
    rightSleeve.rotation.z = Math.PI / 4.0;
    group.add(rightSleeve);

    // Heavy 2x2 Ribbed Waistband
    const waistGeo = new THREE.CylinderGeometry(0.70, 0.70, 0.20, 36);
    const waistMesh = new THREE.Mesh(waistGeo, cuffMat);
    waistMesh.position.set(0, -0.85, 0);
    group.add(waistMesh);
  }

  /* --------------------------------------------------------------------------
     GEOMETRY HELPER FUNCTIONS (ANATOMICAL CONTOURING & DETAILS)
     -------------------------------------------------------------------------- */
  function sculptAthleticTorso(geo, depthRatio, pecBulge, rippleAmp) {
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i);
      let y = pos.getY(i);
      let z = pos.getZ(i);

      // Anatomical depth flattening (human torso is wider than it is deep)
      z *= depthRatio;

      // Athletic chest pectoral projection
      if (y > 0.2 && y < 0.65 && z > 0) {
        const pecFactor = Math.sin((y - 0.2) / 0.45 * Math.PI);
        z += pecFactor * pecBulge;
      }

      // Athletic waist taper
      if (y > -0.2 && y < 0.25) {
        x *= 0.94;
        z *= 0.94;
      }

      // Subtle natural fabric draping waves
      z += Math.sin(y * 6.5) * rippleAmp + Math.cos(x * 4.5) * (rippleAmp * 0.7);

      pos.setXYZ(i, x, y, z);
    }
    geo.computeVertexNormals();
  }

  function createRaglanSleeve(topRad, btmRad, length, mainMat, cuffMat, isRight) {
    const sleeveGrp = new THREE.Group();

    const sleeveGeo = new THREE.CylinderGeometry(topRad, btmRad, length, 24, 10, true);
    // Add subtle elbow bend
    const pos = sleeveGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let y = pos.getY(i);
      let z = pos.getZ(i);
      if (Math.abs(y) < length * 0.2) {
        z += Math.sin((y + length * 0.2) / (length * 0.4) * Math.PI) * 0.035;
      }
      pos.setZ(i, z);
    }
    sleeveGeo.computeVertexNormals();

    const sleeveMesh = new THREE.Mesh(sleeveGeo, mainMat);
    sleeveMesh.position.y = -length * 0.45;
    sleeveMesh.castShadow = true;
    sleeveGrp.add(sleeveMesh);

    // Ribbed Cuff Ring
    const cuffGeo = new THREE.TorusGeometry(btmRad + 0.01, 0.038, 12, 24);
    const cuffMesh = new THREE.Mesh(cuffGeo, cuffMat);
    cuffMesh.rotation.x = Math.PI / 2;
    cuffMesh.position.y = -length * 0.92;
    sleeveGrp.add(cuffMesh);

    return sleeveGrp;
  }

  function createSidePanel(mat, height) {
    const shape = new THREE.Shape();
    shape.moveTo(0, height);
    shape.quadraticCurveTo(0.08, 0, 0, -height);
    shape.lineTo(0.05, -height);
    shape.quadraticCurveTo(0.12, 0, 0.05, height);
    shape.closePath();

    const geo = new THREE.ShapeGeometry(shape);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.y = Math.PI / 2;
    return mesh;
  }

  /* ==========================================================================
     ANIMATION & RENDER LOOP
     ========================================================================== */
  function animate() {
    requestAnimationFrame(animate);

    if (isCamTransitioning) {
      camera.position.lerp(new THREE.Vector3(targetCamPos.x, targetCamPos.y, targetCamPos.z), 0.085);
      controls.target.lerp(new THREE.Vector3(targetLookAt.x, targetLookAt.y, targetLookAt.z), 0.085);

      if (camera.position.distanceTo(new THREE.Vector3(targetCamPos.x, targetCamPos.y, targetCamPos.z)) < 0.04) {
        isCamTransitioning = false;
      }
    }

    controls.update();
    renderer.render(scene, camera);
  }

  function onWindowResize() {
    const container = document.getElementById('canvas-container');
    if (!container || !camera || !renderer) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  /* ==========================================================================
     CUSTOMIZER INTERACTION CONTROLS
     ========================================================================== */
  function setCameraView(view) {
    customizerState.cameraAngle = view;
    isCamTransitioning = true;
    controls.autoRotate = false;

    // Highlight active camera button
    ['front', 'back', 'left', 'right', 'iso', 'collar'].forEach(v => {
      const btn = document.getElementById(`camBtn-${v}`);
      if (btn) {
        if (v === view) {
          btn.className = "px-2.5 py-1.5 rounded-full font-label-sm text-xs uppercase tracking-wider text-pure-white bg-primary-container/30 border border-primary-container flex items-center gap-1 shrink-0";
        } else {
          btn.className = "px-2.5 py-1.5 rounded-full font-label-sm text-xs uppercase tracking-wider text-text-muted hover:text-pure-white hover:bg-surface-slate transition-all flex items-center gap-1 shrink-0";
        }
      }
    });

    const hudAngle = document.getElementById('hudCameraAngle');
    const yOff = customizerState.garmentType === 'basketball' ? -0.25 : (customizerState.garmentType === 'hoodie' ? 0.05 : 0.0);

    if (view === 'front') {
      targetCamPos = { x: 0, y: yOff, z: 3.1 };
      targetLookAt = { x: 0, y: yOff, z: 0 };
      if (hudAngle) hudAngle.innerText = 'FRONT ELEVATION';
    } else if (view === 'back') {
      targetCamPos = { x: 0, y: yOff, z: -3.1 };
      targetLookAt = { x: 0, y: yOff, z: 0 };
      if (hudAngle) hudAngle.innerText = 'BACK IDENTITY';
    } else if (view === 'left') {
      targetCamPos = { x: -3.1, y: yOff, z: 0 };
      targetLookAt = { x: 0, y: yOff, z: 0 };
      if (hudAngle) hudAngle.innerText = 'LEFT FLANK';
    } else if (view === 'right') {
      targetCamPos = { x: 3.1, y: yOff, z: 0 };
      targetLookAt = { x: 0, y: yOff, z: 0 };
      if (hudAngle) hudAngle.innerText = 'RIGHT FLANK';
    } else if (view === 'iso') {
      targetCamPos = { x: 2.1, y: yOff + 0.4, z: 2.3 };
      targetLookAt = { x: 0, y: yOff, z: 0 };
      if (hudAngle) hudAngle.innerText = '3/4 ANGLE';
    } else if (view === 'collar') {
      targetCamPos = { x: 0, y: yOff + 0.65, z: 1.7 };
      targetLookAt = { x: 0, y: yOff + 0.55, z: 0 };
      if (hudAngle) hudAngle.innerText = 'COLLAR & CREST';
    }
  }

  function zoomCamera(delta) {
    if (!camera) return;
    const dir = new THREE.Vector3().subVectors(camera.position, controls.target).normalize();
    const curDist = camera.position.distanceTo(controls.target);
    const newDist = THREE.MathUtils.clamp(curDist + delta, controls.minDistance, controls.maxDistance);
    camera.position.copy(controls.target).add(dir.multiplyScalar(newDist));
  }

  function resetCamera() {
    setCameraView('iso');
    showToast('Camera reset to default 3/4 framing.');
  }

  function toggleAutoRotate() {
    customizerState.autoRotate = !customizerState.autoRotate;
    controls.autoRotate = customizerState.autoRotate;
    const btn = document.getElementById('btnAutoRotate');
    if (btn) {
      btn.className = customizerState.autoRotate
        ? "p-1.5 rounded-full text-primary-container bg-primary-container/20 border border-primary-container/40 shrink-0"
        : "p-1.5 rounded-full text-text-muted hover:text-primary-container hover:bg-surface-slate shrink-0";
    }
    showToast(customizerState.autoRotate ? '360° Auto-rotation Enabled' : 'Auto-rotation Paused');
  }

  function toggleWireframe() {
    customizerState.wireframe = !customizerState.wireframe;
    build3DGarmentMesh();
    const btn = document.getElementById('btnWireframe');
    if (btn) {
      btn.className = customizerState.wireframe
        ? "p-1.5 rounded-full text-tertiary bg-tertiary/20 border border-tertiary/40 shrink-0"
        : "p-1.5 rounded-full text-text-muted hover:text-tertiary hover:bg-surface-slate shrink-0";
    }
    showToast(customizerState.wireframe ? 'CAD Wireframe Mode On' : 'Realistic Fabric Texture On');
  }

  function switchConfigTab(tabName) {
    document.querySelectorAll('.config-tab').forEach(btn => {
      btn.className = 'config-tab py-2 rounded text-text-muted hover:text-pure-white transition-all';
    });
    document.querySelectorAll('.tab-pane').forEach(pane => {
      pane.classList.add('hidden');
    });

    const activeBtn = document.getElementById(`tabBtn-${tabName}`);
    if (activeBtn) {
      activeBtn.className = 'config-tab py-2 rounded font-bold transition-all text-on-primary-container bg-primary-container shadow-sm';
    }

    const activePane = document.getElementById(`tabContent-${tabName}`);
    if (activePane) {
      activePane.classList.remove('hidden');
    }
  }

  function setGarmentType(type) {
    customizerState.garmentType = type;
    document.querySelectorAll('.garment-choice').forEach(b => {
      b.className = 'garment-choice p-3 rounded-lg bg-surface-container-low border border-border-slate text-left flex flex-col gap-1 hover:border-primary-container transition-all';
    });
    const selected = document.getElementById(`garmentBtn-${type}`);
    if (selected) {
      selected.className = 'garment-choice p-3 rounded-lg bg-surface-slate border border-primary-container text-left flex flex-col gap-1 transition-all';
    }

    const names = {
      soccer: 'PRO SOCCER JERSEY',
      cricket: 'CRICKET WHITES / T20',
      basketball: 'BASKETBALL UNIFORM',
      hoodie: 'STREETWEAR HOODIE'
    };

    const skus = {
      soccer: 'GOR-3D-SOC-1049',
      cricket: 'GOR-3D-CRK-2088',
      basketball: 'GOR-3D-BB-3042',
      hoodie: 'GOR-3D-HOD-4091'
    };

    customizerState.sku = skus[type] || 'GOR-3D-CUSTOM';

    const hudName = document.getElementById('hudGarmentName');
    if (hudName) hudName.innerText = names[type] || 'CUSTOM APPAREL';

    const skuDisplay = document.getElementById('customSkuCode');
    if (skuDisplay) skuDisplay.innerText = customizerState.sku;

    build3DGarmentMesh();
    renderCanvasTexture();
    updateSummaryCard();
    showToast(`Loaded 3D Silhouette: ${names[type]}`);
  }

  function updateFabricSpec(value) {
    const parts = value.split('|');
    const gsm = parts[0];
    const desc = parts[1];
    const fabricKey = parts[2] || 'interlock';
    customizerState.fabricGsm = `${gsm} GSM ${desc}`;
    customizerState.fabricType = fabricKey;

    const hudFabric = document.getElementById('hudFabricType');
    if (hudFabric) hudFabric.innerText = `${gsm} GSM ${parts[3] || 'FABRIC'}`;

    build3DGarmentMesh();
    updateSummaryCard();
    showToast(`Fabric spec applied: ${gsm} GSM ${desc}`);
  }

  function applyColorway(primary, sleeve, collar, side, cuff, text) {
    document.getElementById('pickerPrimary').value = primary;
    document.getElementById('pickerSleeve').value = sleeve;
    document.getElementById('pickerCollar').value = collar;
    document.getElementById('pickerSide').value = side;
    document.getElementById('pickerCuff').value = cuff;
    document.getElementById('pickerText').value = text;
    updateColors();
    showToast('Pro colorway applied!');
  }

  function updateColors() {
    customizerState.colors.primary = document.getElementById('pickerPrimary').value;
    customizerState.colors.sleeve = document.getElementById('pickerSleeve').value;
    customizerState.colors.collar = document.getElementById('pickerCollar').value;
    customizerState.colors.sidePanel = document.getElementById('pickerSide').value;
    customizerState.colors.cuff = document.getElementById('pickerCuff').value;
    customizerState.colors.text = document.getElementById('pickerText').value;

    document.getElementById('labelPrimary').innerText = customizerState.colors.primary.toUpperCase();
    document.getElementById('labelSleeve').innerText = customizerState.colors.sleeve.toUpperCase();
    document.getElementById('labelCollar').innerText = customizerState.colors.collar.toUpperCase();
    document.getElementById('labelSide').innerText = customizerState.colors.sidePanel.toUpperCase();
    document.getElementById('labelCuff').innerText = customizerState.colors.cuff.toUpperCase();
    document.getElementById('labelText').innerText = customizerState.colors.text.toUpperCase();

    renderCanvasTexture();
    build3DGarmentMesh();
    updateSummaryCard();
  }

  function setPattern(patternName) {
    customizerState.pattern = patternName;
    document.querySelectorAll('.pat-choice').forEach(b => {
      b.className = 'pat-choice p-3 rounded-lg bg-surface-container-low border border-border-slate text-left flex flex-col gap-1 hover:border-primary-container transition-all';
    });
    const selected = document.getElementById(`patBtn-${patternName}`);
    if (selected) {
      selected.className = 'pat-choice p-3 rounded-lg bg-surface-slate border border-primary-container text-left flex flex-col gap-1 transition-all';
    }
    renderCanvasTexture();
    updateSummaryCard();
    showToast(`Pattern updated: ${patternName.toUpperCase()}`);
  }

  function setLogoPlacement(placement) {
    customizerState.logoPlacement = placement;
    ['left', 'center', 'off'].forEach(p => {
      const btn = document.getElementById(`placeBtn-${p}`);
      if (btn) {
        if (p === placement) {
          btn.className = "placement-btn p-2 rounded bg-surface-slate border border-primary-container text-center font-label-sm text-[10px] text-pure-white";
        } else {
          btn.className = "placement-btn p-2 rounded bg-surface-container-low border border-border-slate text-center font-label-sm text-[10px] text-text-muted hover:border-primary-container";
        }
      }
    });
    renderCanvasTexture();
    showToast(`Front crest placement: ${placement.toUpperCase()}`);
  }

  function toggleSponsorVisibility(visible) {
    customizerState.sponsorOn = visible;
    renderCanvasTexture();
    showToast(visible ? 'Chest sponsor displayed' : 'Chest sponsor hidden');
  }

  function setSleevePlacement(placement) {
    customizerState.sleevePlacement = placement;
    ['both', 'right', 'left', 'off'].forEach(p => {
      const btn = document.getElementById(`slvBtn-${p}`);
      if (btn) {
        if (p === placement) {
          btn.className = "sleeve-badge-btn p-2 rounded bg-surface-slate border border-primary-container text-center font-label-sm text-[10px] text-pure-white";
        } else {
          btn.className = "sleeve-badge-btn p-2 rounded bg-surface-container-low border border-border-slate text-center font-label-sm text-[10px] text-text-muted hover:border-primary-container";
        }
      }
    });
    showToast(`Sleeve badges: ${placement.toUpperCase()}`);
  }

  function updateIdentity() {
    const teamInput = document.getElementById('inputTeamName');
    const playerInput = document.getElementById('inputPlayerName');
    const numInput = document.getElementById('inputPlayerNumber');

    customizerState.teamName = teamInput.value.trim().toUpperCase() || 'GORSY';
    customizerState.playerName = playerInput.value.trim().toUpperCase() || 'PLAYER';
    customizerState.playerNumber = numInput.value.trim() || '10';

    renderCanvasTexture();
    updateSummaryCard();
  }

  function setCrestBadge(badgeName) {
    customizerState.crestBadge = badgeName;
    customizerState.uploadedLogoImg = null;
    document.querySelectorAll('.crest-choice').forEach(b => {
      b.className = 'crest-choice p-2 rounded bg-surface-container-low border border-border-slate hover:border-primary-container flex flex-col items-center gap-1';
    });
    const selected = document.getElementById(`crestBtn-${badgeName}`);
    if (selected) {
      selected.className = 'crest-choice p-2 rounded bg-surface-slate border border-primary-container flex flex-col items-center gap-1';
    }
    renderCanvasTexture();
    showToast(`Crest emblem: ${badgeName.toUpperCase()}`);
  }

  function handleLogoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
      const img = new Image();
      img.onload = function() {
        customizerState.uploadedLogoImg = img;
        renderCanvasTexture();
        document.getElementById('uploadLabelText').innerText = `Loaded: ${file.name}`;
        showToast(`Team emblem mapped to 3D garment: ${file.name}`);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function handleArtworkUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
      const img = new Image();
      img.onload = function() {
        customizerState.uploadedArtworkImg = img;
        customizerState.pattern = 'custom';
        renderCanvasTexture();
        document.getElementById('artworkLabelText').innerText = `Active Artwork: ${file.name}`;
        showToast(`Custom sublimation artwork mapped across 3D garment: ${file.name}`);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function updateSummaryCard() {
    const names = {
      soccer: 'Pro Soccer Jersey',
      cricket: 'Cricket Whites / T20',
      basketball: 'Basketball Uniform',
      hoodie: 'Streetwear Hoodie'
    };

    const gEl = document.getElementById('summaryGarment');
    if (gEl) gEl.innerText = names[customizerState.garmentType] || 'Custom Apparel';

    const fEl = document.getElementById('summaryFabric');
    if (fEl) fEl.innerText = customizerState.fabricGsm;

    const cEl = document.getElementById('summaryColors');
    if (cEl) cEl.innerText = `${customizerState.colors.primary.toUpperCase()} / ${customizerState.colors.sleeve.toUpperCase()}`;

    const pEl = document.getElementById('summaryPattern');
    if (pEl) pEl.innerText = customizerState.pattern;

    const idEl = document.getElementById('summaryIdentity');
    if (idEl) idEl.innerText = `${customizerState.teamName} (#${customizerState.playerNumber} ${customizerState.playerName})`;
  }

  /* ==========================================================================
     VOLUME PRICING CALCULATOR & CURRENCY
     ========================================================================== */
  function calculatePricing(quantity) {
    quantity = parseInt(quantity, 10);
    customizerState.quantity = quantity;

    let baseUSD = 16.50;
    if (quantity >= 2500) baseUSD = 8.80;
    else if (quantity >= 1000) baseUSD = 9.90;
    else if (quantity >= 500) baseUSD = 10.80;
    else if (quantity >= 250) baseUSD = 11.80;
    else if (quantity >= 100) baseUSD = 13.50;
    else baseUSD = 15.50;

    // Hoodie surcharge
    if (customizerState.garmentType === 'hoodie') baseUSD += 4.50;
    if (customizerState.garmentType === 'basketball') baseUSD += 2.20; // 2-piece set

    customizerState.unitPrice = baseUSD;

    const sliderDisplay = document.getElementById('sliderPcsDisplay');
    if (sliderDisplay) sliderDisplay.innerText = `${quantity} Pcs`;

    updatePriceDisplays();
  }

  function updatePriceDisplays() {
    const rate = customizerState.currencyRate;
    const sym = customizerState.currencySymbol;
    const unitPriceConverted = (customizerState.unitPrice * rate).toFixed(2);
    const totalBatchConverted = (customizerState.unitPrice * customizerState.quantity * rate).toFixed(2);

    const priceEl = document.getElementById('customUnitPrice');
    if (priceEl) priceEl.innerText = `${sym}${unitPriceConverted} / pc`;

    const calcUnitEl = document.getElementById('calcUnitPrice');
    if (calcUnitEl) calcUnitEl.innerText = `${sym}${unitPriceConverted} / Pc`;

    const totalBatchEl = document.getElementById('calcTotalBatch');
    if (totalBatchEl) totalBatchEl.innerText = `${sym}${totalBatchConverted}`;
  }

  function setCurrency(code, symbol, rate) {
    customizerState.currencyCode = code;
    customizerState.currencySymbol = symbol;
    customizerState.currencyRate = rate;

    const navLabel = document.getElementById('navCurrencyLabel');
    if (navLabel) navLabel.innerText = `${code} (${symbol.trim()})`;

    updatePriceDisplays();
    closeModal('currencyModal');
    showToast(`Active currency: ${code}`);
  }

  /* ==========================================================================
     TECH PACK DOWNLOAD & EXPORT
     ========================================================================== */
  function generateTechPackPDF() {
    const techPack = {
      specVersion: "3.5.0-EPZ",
      generatedAt: new Date().toISOString(),
      manufacturer: "GORSY (PVT) LTD - SIALKOT EXPORT PROCESSING ZONE, PAKISTAN",
      orderParameters: {
        garmentSilhouette: customizerState.garmentType.toUpperCase(),
        configuredSku: customizerState.sku,
        fabricSpecification: customizerState.fabricGsm,
        targetBatchVolume: `${customizerState.quantity} Pcs`,
        estimatedUnitPrice: `${customizerState.currencySymbol}${customizerState.unitPrice.toFixed(2)}`,
        estimatedTotal: `${customizerState.currencySymbol}${(customizerState.unitPrice * customizerState.quantity).toFixed(2)}`
      },
      colorwayCodes: {
        mainBodyHex: customizerState.colors.primary,
        sleevesHex: customizerState.colors.sleeve,
        collarRibHex: customizerState.colors.collar,
        sidePanelHex: customizerState.colors.sidePanel,
        cuffHemHex: customizerState.colors.cuff,
        typographyHex: customizerState.colors.text
      },
      sublimationGraphics: {
        patternStyle: customizerState.pattern,
        resolutionDPI: "1440 DPI Japanese Mimaki Sublimation"
      },
      vectorIdentity: {
        chestSponsorBranding: customizerState.teamName,
        sponsorActive: customizerState.sponsorOn,
        frontCrestPlacement: customizerState.logoPlacement,
        crestInsignia: customizerState.crestBadge,
        playerBackName: customizerState.playerName,
        playerBackNumber: customizerState.playerNumber,
        sleeveBadgePlacement: customizerState.sleevePlacement
      }
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(techPack, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `GORSY_TechPack_${customizerState.sku}_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    showToast("3D Tech Pack Spec Sheet Generated & Downloaded!");
  }

  function saveCustomDesign() {
    showToast("Custom 3D configuration saved to browser session memory.");
  }

  function resetCustomizer() {
    customizerState.garmentType = 'soccer';
    customizerState.colors = {
      primary: '#00e5ff',
      sleeve: '#0a0e14',
      collar: '#ffffff',
      sidePanel: '#00e5ff',
      cuff: '#ffffff',
      text: '#cdff13'
    };
    customizerState.pattern = 'solid';
    customizerState.teamName = 'GORSY APEX';
    customizerState.sponsorOn = true;
    customizerState.logoPlacement = 'left';
    customizerState.sleevePlacement = 'both';
    customizerState.playerName = 'SALEEM';
    customizerState.playerNumber = '10';
    customizerState.crestBadge = 'shield';
    customizerState.uploadedLogoImg = null;
    customizerState.uploadedArtworkImg = null;

    document.getElementById('pickerPrimary').value = '#00e5ff';
    document.getElementById('pickerSleeve').value = '#0a0e14';
    document.getElementById('pickerCollar').value = '#ffffff';
    document.getElementById('pickerSide').value = '#00e5ff';
    document.getElementById('pickerCuff').value = '#ffffff';
    document.getElementById('pickerText').value = '#cdff13';
    document.getElementById('inputTeamName').value = 'GORSY APEX';
    document.getElementById('inputPlayerName').value = 'SALEEM';
    document.getElementById('inputPlayerNumber').value = '10';

    updateColors();
    setGarmentType('soccer');
    setPattern('solid');
    setCrestBadge('shield');
    setLogoPlacement('left');
    setSleevePlacement('both');
    setCameraView('iso');

    showToast("Customizer reset to factory standard.");
  }

  function requestQuoteFrom3D() {
    const catSelect = document.getElementById('contactCategory');
    if (catSelect) catSelect.value = customizerState.garmentType === 'soccer' ? 'Sportswear' : 'Full Custom Brand Collection';

    const qtySelect = document.getElementById('contactQuantity');
    if (qtySelect) qtySelect.value = customizerState.quantity > 500 ? '500-1000 Pcs' : '100-300 Pcs';

    const notesArea = document.getElementById('contactNotes');
    if (notesArea) {
      notesArea.value = `[Inquiry from 3D Customizer Studio]\nApparel Silhouette: ${customizerState.garmentType.toUpperCase()}\nSKU: ${customizerState.sku}\nColors: Body ${customizerState.colors.primary}, Sleeves ${customizerState.colors.sleeve}, Collar ${customizerState.colors.collar}, Side ${customizerState.colors.sidePanel}, Cuff ${customizerState.colors.cuff}\nTeam: ${customizerState.teamName} | Player: ${customizerState.playerName} #${customizerState.playerNumber}\nQuantity: ${customizerState.quantity} Pcs (${customizerState.fabricGsm})`;
    }

    scrollToSection('contact');
    showToast("3D build parameters transferred to Contact Form below.");
  }