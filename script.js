/* =============================================================
   ICB — script.js
   Site interactions + Three.js Bible
   
   BOOK COORDINATE SYSTEM:
   - Book lies flat on an imaginary table (the XZ plane)
   - Y axis points UP (away from the table)
   - Camera sits above-front, looking down at the book
   - Spine runs along the X axis
   - Pages/covers extend in the +Z direction (away from spine)
   
   HOW OPENING WORKS:
   - The spine edge of each cover/page sits at Z=0
   - The far edge extends to Z = DEPTH (away from camera)
   - To open: rotate around the X axis at Z=0
     * rotation.x = 0     → flat on table (closed)
     * rotation.x = +PI   → flipped all the way over (open)
   - Cover opens first, then pages flip one by one
============================================================= */

// ─── SITE: navbar ────────────────────────────────────────────
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 60);
}, { passive: true });

// ─── SITE: hamburger ─────────────────────────────────────────
const HB = document.getElementById('hamburger');
const MM = document.getElementById('mobileMenu');
HB.addEventListener('click', () => {
  HB.classList.toggle('open');
  MM.classList.toggle('open');
  document.body.style.overflow = MM.classList.contains('open') ? 'hidden' : '';
});
document.querySelectorAll('.ml').forEach(l => l.addEventListener('click', () => {
  HB.classList.remove('open'); MM.classList.remove('open');
  document.body.style.overflow = '';
}));

// ─── SITE: hero video ────────────────────────────────────────
const heroVid = document.getElementById('heroVideo');
if (heroVid) heroVid.addEventListener('ended', () => heroVid.pause());

// ─── SITE: scroll reveal ─────────────────────────────────────
// ─── SITE: scroll reveal ─────────────────────────────────────
// Elements start blurred, shifted down, transparent.
// Observer fires once when element enters viewport — never re-hides.
const revObs = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('visible');
      revObs.unobserve(e.target); // trigger once only
    }
  });
}, {
  threshold: 0.10,                  // trigger when 10% visible
  rootMargin: '0px 0px -40px 0px'   // fire slightly before bottom edge
});
document.querySelectorAll('.reveal, .reveal-card').forEach(el => revObs.observe(el));

// ─── SITE: smooth scroll ─────────────────────────────────────
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const t = document.querySelector(a.getAttribute('href'));
    if (t) { e.preventDefault(); window.scrollTo({ top: t.getBoundingClientRect().top + window.scrollY - 70, behavior: 'smooth' }); }
  });
});



// ════════════════════════════════════════════════════════════════
//   3D BIBLE — Y-AXIS HINGE (upright book, cover swings left)
//
//   The book stands upright, spine on the LEFT.
//   Camera looks straight at the FRONT COVER from slightly above.
//
//   COORDINATE SYSTEM:
//     X = left/right   Y = up/down   Z = toward/away from camera
//
//   The spine hinge runs along the Y axis at X = 0.
//   Every piece of geometry has its LEFT EDGE at X = 0
//   and extends to X = +W (to the right).
//   Achieved with: geo.translate(W/2, 0, 0)
//
//   OPENING: rotate each piece around Y at X = 0
//     rotation.y = 0      → cover facing camera (closed)
//     rotation.y = +PI    → cover swung to the left (open)
//
//   Pages flip the same way after cover is open.
// ════════════════════════════════════════════════════════════════
(function () {
  const canvas = document.getElementById('bible-canvas');
  const track  = document.getElementById('bible-track');
  if (!canvas || !track || typeof THREE === 'undefined') return;

  // ── Book dimensions ─────────────────────────────────────────
  const BW    = 1.6;    // width  of one side (X, spine→right edge)
  const BH    = 2.3;    // height (Y)
  const T_CVR = 0.06;   // cover thickness (Z)
  const N_PG  = 10;     // number of flippable pages (one per chapter)
  const T_PG  = 0.007;  // single page thickness (Z)
  const STACK = N_PG * T_PG; // total page block depth

  // ── Renderer ────────────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();

  // Camera centred on the middle of the open book
  // When open, content spans from -BW (left) to +BW (right) of hinge
  // so we target X = 0, pull back enough to see full width
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 30);
  camera.position.set(0, 0.3, 6.5);
  camera.lookAt(0, 0, 0);

  function resize() {
    const w = canvas.clientWidth  || track.clientWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  // ── Lighting ────────────────────────────────────────────────
  // Soft warm key light from upper right
  const key = new THREE.DirectionalLight(0xfff8f0, 2.2);
  key.position.set(3, 5, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -3; key.shadow.camera.right = 3;
  key.shadow.camera.top  =  3; key.shadow.camera.bottom = -3;
  key.shadow.camera.far  = 14;
  key.shadow.radius = 5;
  scene.add(key);

  // Gentle neutral fill from left
  const fill = new THREE.DirectionalLight(0xdde8f0, 0.5);
  fill.position.set(-4, 1, 2);
  scene.add(fill);

  // Very soft rim from behind
  const rim = new THREE.DirectionalLight(0xfff0e0, 0.25);
  rim.position.set(0, 2, -4);
  scene.add(rim);

  scene.add(new THREE.AmbientLight(0x8090a0, 0.9));

  // ── Textures ────────────────────────────────────────────────
  function makeLeather() {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 1024;
    const c = cv.getContext('2d');

    // Muted dark navy-slate base
    const base = c.createRadialGradient(512, 400, 0, 512, 512, 720);
    base.addColorStop(0,   '#1e2e40');
    base.addColorStop(0.5, '#172438');
    base.addColorStop(1,   '#101c2c');
    c.fillStyle = base;
    c.fillRect(0, 0, 1024, 1024);

    // Fine pebbled grain
    for (let i = 0; i < 18000; i++) {
      const x = Math.random() * 1024;
      const y = Math.random() * 1024;
      const r = 0.4 + Math.random() * 1.8;
      const a = Math.random() * 0.09;
      c.fillStyle = Math.random() > 0.5
        ? `rgba(0,0,0,${a})`
        : `rgba(255,255,255,${a * 0.25})`;
      c.beginPath();
      c.ellipse(x, y, r, r * (0.5 + Math.random() * 0.9),
        Math.random() * Math.PI, 0, Math.PI * 2);
      c.fill();
    }

    // Horizontal leather grain lines
    for (let i = 0; i < 180; i++) {
      const y = Math.random() * 1024;
      const dy = (Math.random() - 0.5) * 5;
      c.beginPath();
      c.moveTo(0, y);
      c.bezierCurveTo(250, y + dy, 750, y - dy, 1024, y + (Math.random()-0.5)*3);
      c.strokeStyle = `rgba(0,0,0,${0.015 + Math.random() * 0.035})`;
      c.lineWidth = 0.3 + Math.random() * 0.5;
      c.stroke();
    }

    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1, 1.3);
    return t;
  }

  // NIV chapter data — opening verses, one chapter per page
  const CHAPTERS = [
    { num:1,  title:"A Church Divided Over Leaders",
      v:[['1','Paul, called to be an apostle of Christ Jesus by the will of God, and our brother Sosthenes,'],
         ['2','To the church of God in Corinth, to those sanctified in Christ Jesus and called to be his holy people, together with all those everywhere who call on the name of our Lord Jesus Christ.'],
         ['3','Grace and peace to you from God our Father and the Lord Jesus Christ.'],
         ['10','I appeal to you, brothers and sisters, in the name of our Lord Jesus Christ, that all of you agree with one another in what you say and that there be no divisions among you.'],
         ['18','For the message of the cross is foolishness to those who are perishing, but to us who are being saved it is the power of God.']]},
    { num:2,  title:"Wisdom From the Spirit",
      v:[['1','And so it was with me, brothers and sisters. When I came to you, I did not come with eloquence or human wisdom as I proclaimed to you the testimony about God.'],
         ['2','For I resolved to know nothing while I was with you except Jesus Christ and him crucified.'],
         ['9','"What no eye has seen, what no ear has heard, and what no human mind has conceived—the things God has prepared for those who love him."'],
         ['16','"Who has known the mind of the Lord so as to instruct him?" But we have the mind of Christ.']]},
    { num:3,  title:"On Divisions in the Church",
      v:[['6','I planted the seed, Apollos watered it, but God has been making it grow.'],
         ['9','For we are co-workers in God\'s service; you are God\'s field, God\'s building.'],
         ['11','For no one can lay any foundation other than the one already laid, which is Jesus Christ.'],
         ['16','Don\'t you know that you yourselves are God\'s temple and that God\'s Spirit dwells in your midst?']]},
    { num:4,  title:"The Nature of True Apostleship",
      v:[['1','This, then, is how you ought to regard us: as servants of Christ and as those entrusted with the mysteries God has revealed.'],
         ['5','Therefore judge nothing before the appointed time; wait until the Lord comes.'],
         ['20','For the kingdom of God is not a matter of talk but of power.']]},
    { num:5,  title:"Dealing With Sexual Immorality",
      v:[['7','Get rid of the old yeast, so that you may be a new unleavened batch—as you really are. For Christ, our Passover lamb, has been sacrificed.'],
         ['8','Therefore let us keep the Festival, not with the old bread leavened with malice and wickedness, but with the unleavened bread of sincerity and truth.']]},
    { num:6,  title:"Lawsuits Among Believers",
      v:[['11','And that is what some of you were. But you were washed, you were sanctified, you were justified in the name of the Lord Jesus Christ and by the Spirit of our God.'],
         ['19','Do you not know that your bodies are temples of the Holy Spirit, who is in you, whom you have received from God? You are not your own;'],
         ['20','you were bought at a price. Therefore honor God with your bodies.']]},
    { num:7,  title:"Concerning Marriage",
      v:[['7','I wish that all of you were as I am. But each of you has your own gift from God; one has this gift, another has that.'],
         ['17','Nevertheless, each person should live as a believer in whatever situation the Lord has assigned to them, just as God has called them.'],
         ['31','For this world in its present form is passing away.']]},
    { num:8,  title:"Food Sacrificed to Idols",
      v:[['1','"We all possess knowledge." But knowledge puffs up while love builds up.'],
         ['6','yet for us there is but one God, the Father, from whom all things came and for whom we live; and there is but one Lord, Jesus Christ.'],
         ['9','Be careful, however, that the exercise of your rights does not become a stumbling block to the weak.']]},
    { num:9,  title:"Paul\'s Rights as an Apostle",
      v:[['19','Though I am free and belong to no one, I have made myself a slave to everyone, to win as many as possible.'],
         ['22','I have become all things to all people so that by all possible means I might save some.'],
         ['24','Do you not know that in a race all the runners run, but only one gets the prize? Run in such a way as to get the prize.']]},
    { num:10, title:"Warnings From Israel\'s History",
      v:[['13','No temptation has overtaken you except what is common to mankind. And God is faithful; he will not let you be tempted beyond what you can bear.'],
         ['31','So whether you eat or drink or whatever you do, do it all for the glory of God.'],
         ['33','For I am not seeking my own good but the good of many, so that they may be saved.']]},
  ];

  function wrapText(c, text, x, y, maxW, lineH) {
    const words = text.split(' ');
    let line = '';
    words.forEach(w => {
      const test = line ? line + ' ' + w : w;
      if (c.measureText(test).width > maxW && line) {
        c.fillText(line, x, y); line = w; y += lineH;
      } else { line = test; }
    });
    if (line) { c.fillText(line, x, y); y += lineH; }
    return y;
  }

  function makePage(idx) {
    const ch = CHAPTERS[idx] || CHAPTERS[0];
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 680;
    const c = cv.getContext('2d');
    const grad = c.createLinearGradient(0,0,512,680);
    grad.addColorStop(0,'#f7f2e5'); grad.addColorStop(.5,'#efe9d6'); grad.addColorStop(1,'#e7dfca');
    c.fillStyle = grad; c.fillRect(0,0,512,680);
    for (let i=0;i<3500;i++){c.fillStyle=`rgba(0,0,0,${Math.random()*.016})`;c.fillRect(Math.random()*512,Math.random()*680,1,1);}
    const L=30,R=482,CW=R-L;
    // Header
    c.font='bold 13px Georgia,serif'; c.fillStyle='#2c1a0a'; c.textAlign='center';
    c.fillText('1 CORINTHIANS',256,30);
    c.strokeStyle='rgba(44,26,10,0.3)'; c.lineWidth=0.6;
    c.beginPath();c.moveTo(L,38);c.lineTo(R,38);c.stroke();
    // Chapter number
    c.font='bold 58px Georgia,serif'; c.fillStyle='#2c1a0a'; c.textAlign='left';
    c.fillText(String(ch.num),L,100);
    // Chapter title
    c.font='italic 11.5px Georgia,serif'; c.fillStyle='#4a2e14';
    const tx = ch.num>=10 ? L+72 : L+50;
    wrapText(c, ch.title, tx, 68, CW-(tx-L), 16);
    // Rule
    c.strokeStyle='rgba(44,26,10,0.2)'; c.lineWidth=0.6;
    c.beginPath();c.moveTo(L,112);c.lineTo(R,112);c.stroke();
    // Verses
    c.textAlign='left'; let y=128;
    ch.v.forEach(([vn,vt])=>{
      if(y>645) return;
      c.font='bold 8.5px Georgia,serif'; c.fillStyle='#7a4010';
      c.fillText(vn,L,y);
      c.font='11px Georgia,serif'; c.fillStyle='#1c0e04';
      y = wrapText(c, vt, L+(vn.length>1?22:17), y, CW-22, 15);
      y+=4;
    });
    // Page number
    c.font='9.5px Georgia,serif'; c.fillStyle='rgba(44,26,10,0.35)'; c.textAlign='center';
    c.fillText(String(1670+ch.num),256,668);
    // Column divider
    c.strokeStyle='rgba(44,26,10,0.055)'; c.lineWidth=0.7;
    c.beginPath();c.moveTo(256,42);c.lineTo(256,658);c.stroke();
    return new THREE.CanvasTexture(cv);
  }

  function makeGold() {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const c = cv.getContext('2d');
    const g = c.createLinearGradient(0,0,64,64);
    g.addColorStop(0,'#f4e080'); g.addColorStop(.4,'#c9a84c'); g.addColorStop(.75,'#8c6020'); g.addColorStop(1,'#c9a84c');
    c.fillStyle=g; c.fillRect(0,0,64,64);
    return new THREE.CanvasTexture(cv);
  }

  // ── Materials ────────────────────────────────────────────────
  const mCover = new THREE.MeshStandardMaterial({
    map: makeLeather(),
    roughness: 0.88,
    metalness: 0.0,
    color: new THREE.Color(0x1a2e44),
  });
  // mPage is created per-page below with chapter-specific textures
  const mEdge  = new THREE.MeshStandardMaterial({ color:0xd8cfb0,    roughness:.90, metalness:0 });
  const mGold  = new THREE.MeshStandardMaterial({ map:makeGold(),    roughness:.15, metalness:.90, color:0xc9a84c });
  const mSpine = new THREE.MeshStandardMaterial({ color:0x0c1c2e,    roughness:.88, metalness:.04 });

  // ── Build geometry helper ────────────────────────────────────
  // Returns a Group whose local X=0 is the spine (hinge line).
  // The mesh extends to the RIGHT (+X) from there.
  // geo.translate(BW/2, 0, 0) shifts a centred box so left edge = X=0.
  function hingedBox(w, h, d, mat, zPos) {
    const grp = new THREE.Group();
    const geo = new THREE.BoxGeometry(w, h, d);
    geo.translate(w / 2, 0, 0);     // ← LEFT EDGE NOW AT X=0 (HINGE)
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    grp.add(mesh);
    grp.position.z = zPos;
    return grp;
  }

  // ── BACK COVER ──────────────────────────────────────────────
  // Sits at the back (most negative Z)
  const backZ = -(STACK / 2 + T_CVR / 2);
  const backGroup = hingedBox(BW, BH, T_CVR, mCover, backZ);
  scene.add(backGroup);

  // ── PAGE EDGE BLOCK (static visual) ─────────────────────────
  // Cream-coloured block showing the page edges on the right side
  const edgeGeo = new THREE.BoxGeometry(BW, BH, STACK * 0.96);
  edgeGeo.translate(BW / 2, 0, 0);
  const edgeMesh = new THREE.Mesh(edgeGeo, mEdge);
  edgeMesh.receiveShadow = true;
  scene.add(edgeMesh); // does NOT rotate

  // ── INDIVIDUAL PAGES ─────────────────────────────────────────
  // Each page is a pivot Group at X=0.
  // The page plane extends to the right (+X from X=0).
  // rotation.y = 0  → page flat, facing camera
  // rotation.y = PI → page flipped to the left (read)
  const pages = [];
  for (let i = 0; i < N_PG; i++) {
    const grp = new THREE.Group();
    const zPos = STACK / 2 - (i + 0.5) * T_PG;
    grp.position.z = zPos;

    // Many horizontal subdivisions so the page can curve realistically
    const geo = new THREE.PlaneGeometry(BW - 0.05, BH - 0.06, 24, 2);
    geo.translate((BW - 0.05) / 2, 0, 0);

    const pgMat = new THREE.MeshStandardMaterial({
      map: makePage(i),
      roughness: 0.92,
      metalness: 0.0,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, pgMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    grp.add(mesh);
    scene.add(grp);
    pages.push({ grp, mesh, geo });
  }

  // Pre-store original X positions so we can morph them each frame
  pages.forEach(({ geo }) => {
    const pos = geo.attributes.position;
    const orig = new Float32Array(pos.array.length);
    orig.set(pos.array);
    geo._origPositions = orig;
  });

  // ── FRONT COVER ─────────────────────────────────────────────
  // Sits at the front (most positive Z, facing camera)
  const frontZ = STACK / 2 + T_CVR / 2;
  const frontGroup = hingedBox(BW, BH, T_CVR, mCover, frontZ);
  scene.add(frontGroup);

  // Gold embossing — children of frontGroup so they rotate with cover
  function addGold(w, h, d, lx, ly) {
    const geo = new THREE.BoxGeometry(w, h, d);
    // Offset right from hinge
    geo.translate(lx + w / 2, ly, T_CVR / 2 + d / 2);
    const m = new THREE.Mesh(geo, mGold);
    frontGroup.children[0].add(m); // add to the cover mesh's parent (the box mesh)
  }

  // Cross on cover face
  const frontMesh = frontGroup.children[0];
  function addGoldToFront(w, h, d, cx, cy) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const m   = new THREE.Mesh(geo, mGold);
    // Position relative to cover mesh centre
    m.position.set(BW / 2 + cx, cy, T_CVR / 2 + d / 2 + 0.001);
    frontMesh.add(m);
  }

  addGoldToFront(0.07,  0.40, 0.012,  0,    0.08);  // cross vertical
  addGoldToFront(0.26,  0.07, 0.012,  0,    0.22);  // cross horizontal
  addGoldToFront(0.65,  0.045, 0.010, 0,   -0.60);  // title bar
  addGoldToFront(0.42,  0.028, 0.010, 0,   -0.70);  // subtitle bar
  // Border
  const bi = 0.09;
  addGoldToFront(BW - bi*2, 0.012, 0.008,  0,  BH/2 - bi);
  addGoldToFront(BW - bi*2, 0.012, 0.008,  0, -BH/2 + bi);
  addGoldToFront(0.012, BH - bi*2,  0.008,  BW/2 - bi, 0);
  addGoldToFront(0.012, BH - bi*2,  0.008, -BW/2 + bi, 0);

  // ── SPINE CYLINDER (static — never rotates) ──────────────────
  const spineC = new THREE.Mesh(
    new THREE.CylinderGeometry(0.065, 0.065, BH, 20),
    mSpine
  );
  spineC.castShadow = true;

  // Gold spine bands
  const spineBands = [];
  [-0.5, -0.16, 0.16, 0.5].forEach(yf => {
    const b = new THREE.Mesh(
      new THREE.CylinderGeometry(0.072, 0.072, 0.048, 20),
      mGold
    );
    b.position.y = yf * BH;
    spineBands.push(b);
  });

  // ── Centre the whole book ─────────────────────────────────────
  // The hinge sits at X=0 and the book extends to X=+BW.
  // Shift everything left by BW/2 so the hinge is at X=-BW/2.
  // When open the left cover swings to X=-BW and the right pages
  // sit at X=0..+BW/2, making the total span -BW..+BW/2 roughly
  // centred on screen.  Use BW*0.45 so open book is visible.
  const bookGroup = new THREE.Group();
  bookGroup.position.x = -BW * 0.45;
  scene.add(bookGroup);

  bookGroup.add(backGroup);
  bookGroup.add(edgeMesh);
  pages.forEach(({ grp }) => bookGroup.add(grp));
  bookGroup.add(frontGroup);
  bookGroup.add(spineC);
  spineBands.forEach(b => bookGroup.add(b));

  // ── Scroll progress ──────────────────────────────────────────
  let raw = 0, smooth = 0;

  function calcRaw() {
    const rect = track.getBoundingClientRect();
    const scrollable = track.offsetHeight - window.innerHeight;
    if (scrollable <= 0) return 0;
    // Animation starts the moment the section appears at the bottom of screen
    // rect.top goes from +winH (just entered) to 0 (top of section at top of screen)
    // We map: rect.top = winH → progress 0,  rect.top = -scrollable → progress 1
    const total = scrollable + window.innerHeight;
    return Math.min(1, Math.max(0, (window.innerHeight - rect.top) / total));
  }

  window.addEventListener('scroll', () => { raw = calcRaw(); }, { passive: true });

  function ease(t) {
    return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2;
  }

  // ── Render loop ──────────────────────────────────────────────
  let raf;
  function animate() {
    raf = requestAnimationFrame(animate);

    smooth += (raw - smooth) * 0.055;

    // ── COVER OPENS  (smooth 0 → 0.30) ──────────────────────
    // frontGroup.rotation.y goes 0 → -PI
    // 0   = cover facing camera (closed)
    // -PI = cover swung to the LEFT (open), revealing pages
    const coverT = Math.min(1, smooth / 0.30);
    frontGroup.rotation.y = ease(coverT) * -Math.PI;

    // ── PAGES FLIP  (smooth 0.30 → 1.0) ─────────────────────
    // Each page flips right-to-left on its own Y pivot.
    // Mid-flip the page bows (arc peaks at rotation = PI/2).
    const flipPhase = Math.max(0, (smooth - 0.30) / 0.70);
    pages.forEach(({ grp, geo }, i) => {
      const t0  = (i / N_PG) * 0.75;
      const t1  = t0 + 0.32;
      const loc = Math.min(1, Math.max(0, (flipPhase - t0) / (t1 - t0)));
      grp.rotation.y = ease(loc) * -Math.PI;

      // Dynamic bow: peaks at loc=0.5 (mid-flip), zero at 0 and 1
      const bow = Math.sin(loc * Math.PI) * 0.18;
      const pos  = geo.attributes.position;
      const orig = geo._origPositions;
      if (orig) {
        for (let v = 0; v < pos.count; v++) {
          const ox = orig[v * 3];       // original X (0..BW)
          const nx = ox / (BW - 0.05); // normalised 0..1
          // Arc peaks in the middle of the page width
          pos.setZ(v, Math.sin(nx * Math.PI) * bow);
        }
        pos.needsUpdate = true;
        geo.computeVertexNormals();
      }
    });

    // Gentle idle float on the whole group
    const t = performance.now() * 0.0005;
    bookGroup.position.y = Math.sin(t) * 0.015;

    renderer.render(scene, camera);
  }

  raw = calcRaw();
  animate();
})();
