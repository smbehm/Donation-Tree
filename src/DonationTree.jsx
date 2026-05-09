/**
 * DonationTree.jsx
 * Drop this file into your Bolt project.
 * Requires: npm install three
 * Add to your index.html <head>:
 *   <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,400&family=Jost:wght@300;400&display=swap" rel="stylesheet">
 *
 * Usage in your routes/pages:
 *   import DonationTree from './DonationTree';
 *   export default function Page() { return <DonationTree />; }
 */

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

/* ─── Config ─────────────────────────────────────────── */
const TARGET_AMOUNT = 1000;
const TARGET_LABEL  = "Plumbing Repairs";
const VINE_MIN_Y    = 0.0;
const VINE_MAX_Y    = 4.65;

/* ─── GLSL Shaders ───────────────────────────────────── */
const VERT_SHADER = /* glsl */`
  varying float vLocalY;
  void main() {
    vLocalY = position.y;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG_SHADER = /* glsl */`
  varying float vLocalY;
  uniform float uFillLevel;
  uniform float uMinY;
  uniform float uMaxY;

  void main() {
    float range    = uMaxY - uMinY;
    float fillNorm = clamp((uFillLevel - uMinY) / range, 0.0, 1.0);
    float height   = clamp((vLocalY   - uMinY) / range, 0.0, 1.0);

    /* vine colours */
    vec3 emptyColor = vec3(0.055, 0.038, 0.022);
    vec3 deepGreen  = vec3(0.04,  0.30,  0.09);
    vec3 emerald    = vec3(0.12,  0.74,  0.28);
    vec3 brightTip  = vec3(0.55,  1.0,   0.35);

    /* gradient inside the filled region: dark root → bright growing tip */
    float localT     = (fillNorm > 0.001) ? clamp(height / fillNorm, 0.0, 1.0) : 0.0;
    vec3 filledColor = mix(deepGreen, mix(emerald, brightTip, localT * localT), localT);

    /* luminous glow exactly at the growing edge */
    float edgeDist = abs(vLocalY - uFillLevel);
    float glow     = exp(-edgeDist * edgeDist * 20.0);
    filledColor   += vec3(0.55, 1.0, 0.12) * glow * 2.4;

    /* smooth transition at fill boundary */
    float blend = smoothstep(uFillLevel + 0.12, uFillLevel - 0.12, vLocalY);
    gl_FragColor  = vec4(mix(emptyColor, filledColor, blend), 1.0);
  }
`;

/* ─── Component ──────────────────────────────────────── */
export default function DonationTree() {
  const mountRef   = useRef(null);
  const vineUniRef = useRef(null);
  const rafRef     = useRef(null);

  const [donation, setDonation] = useState("");

  const raw        = parseFloat(donation) || 0;
  const pct        = Math.min(raw / TARGET_AMOUNT, 1);
  const displayPct = Math.round(pct * 100);
  const capped     = Math.min(raw, TARGET_AMOUNT);
  const remaining  = TARGET_AMOUNT - capped;

  /* ── Build Three.js scene once ── */
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const W = mount.clientWidth;
    const H = mount.clientHeight;

    /* Renderer */
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    /* Scene */
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x040b06);
    scene.fog = new THREE.FogExp2(0x040b06, 0.065);

    /* Camera */
    const camera = new THREE.PerspectiveCamera(46, W / H, 0.1, 100);
    camera.position.set(0, 2.8, 6.8);
    camera.lookAt(0, 2.5, 0);

    /* Lights */
    scene.add(new THREE.AmbientLight(0x0c1e0c, 0.9));

    const sun = new THREE.DirectionalLight(0xffe8a0, 1.7);
    sun.position.set(4, 8, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    scene.add(sun);

    const fillLight = new THREE.PointLight(0x44ff88, 1.0, 24);
    fillLight.position.set(-3, 4, 3);
    scene.add(fillLight);

    const rimLight = new THREE.PointLight(0x001a44, 0.45, 18);
    rimLight.position.set(2, 2, -4);
    scene.add(rimLight);

    /* Tree group — rotates in animation loop */
    const treeGroup = new THREE.Group();
    scene.add(treeGroup);

    const barkMat = new THREE.MeshStandardMaterial({ color: 0x271203, roughness: 0.97 });
    const rng = (a, b) => a + Math.random() * (b - a);

    /* ── Trunk ── */
    const trunkGeo = new THREE.CylinderGeometry(0.11, 0.24, 4.65, 14, 7);
    {
      const pos = trunkGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const t = (pos.getY(i) + 2.325) / 4.65;
        const n = 0.038 * (1 - t * 0.6);
        pos.setX(i, pos.getX(i) + rng(-n, n));
        pos.setZ(i, pos.getZ(i) + rng(-n, n));
      }
      trunkGeo.computeVertexNormals();
    }
    const trunk = new THREE.Mesh(trunkGeo, barkMat);
    trunk.position.y = 2.325;
    trunk.castShadow = trunk.receiveShadow = true;
    treeGroup.add(trunk);

    /* ── Branches ── */
    const addBranch = (len, tr, br, py, rz, ry) => {
      const m = new THREE.Mesh(
        new THREE.CylinderGeometry(tr, br, len, 7),
        barkMat
      );
      m.position.set(Math.sin(ry) * 0.09, py, Math.cos(ry) * 0.09);
      m.rotation.z = rz;
      m.rotation.y = ry;
      m.castShadow = true;
      treeGroup.add(m);
    };
    addBranch(1.10, 0.019, 0.052, 2.60,  0.45, 0.20);
    addBranch(0.95, 0.017, 0.046, 2.90, -0.40, 2.40);
    addBranch(0.85, 0.015, 0.040, 3.30,  0.37, 4.50);
    addBranch(0.75, 0.013, 0.035, 3.60, -0.31, 1.20);
    addBranch(0.62, 0.011, 0.029, 3.90,  0.27, 3.70);
    addBranch(0.50, 0.009, 0.023, 4.20, -0.21, 5.50);

    /* ── Foliage ── */
    const leafCols = [0x0f2f0c, 0x133812, 0x0c270a, 0x183e11, 0x0a2008];
    [
      [0,    4.40,  0,     1.00],
      [0.75, 4.10,  0.30,  0.74],
      [-0.6, 4.20, -0.40,  0.70],
      [0.40, 4.75, -0.50,  0.64],
      [-0.5, 4.50,  0.50,  0.60],
      [0,    5.10,  0,     0.54],
      [0.30, 3.90,  0.65,  0.50],
      [-0.3, 4.00, -0.62,  0.46],
    ].forEach(([x, y, z, r], i) => {
      const g = new THREE.SphereGeometry(r, 7, 5);
      const p = g.attributes.position;
      for (let j = 0; j < p.count; j++) {
        p.setX(j, p.getX(j) + rng(-0.13, 0.13));
        p.setY(j, p.getY(j) + rng(-0.13, 0.13));
        p.setZ(j, p.getZ(j) + rng(-0.13, 0.13));
      }
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({
        color: leafCols[i % leafCols.length],
        roughness: 1.0,
        transparent: true,
        opacity: 0.87,
      }));
      m.position.set(x, y, z);
      treeGroup.add(m);
    });

    /* ── Ground disc ── */
    const ground = new THREE.Mesh(
      new THREE.CylinderGeometry(3.0, 3.0, 0.06, 32),
      new THREE.MeshStandardMaterial({ color: 0x050d03, roughness: 1.0 })
    );
    ground.position.y = -0.03;
    ground.receiveShadow = true;
    treeGroup.add(ground);

    /* ── Roots ── */
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2 + rng(-0.25, 0.25);
      const pts = [];
      for (let j = 0; j <= 18; j++) {
        const t = j / 18;
        pts.push(new THREE.Vector3(
          Math.cos(ang) * (0.21 + t * rng(0.55, 0.90)),
          Math.sin(t * Math.PI) * 0.13 * (1 - t * 0.55),
          Math.sin(ang) * (0.21 + t * rng(0.55, 0.90))
        ));
      }
      treeGroup.add(new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 18, 0.022, 5, false),
        barkMat
      ));
    }

    /* ── Vines with custom GLSL ── */
    const vineUniforms = {
      uFillLevel: { value: VINE_MIN_Y - 0.6 },
      uMinY:      { value: VINE_MIN_Y },
      uMaxY:      { value: VINE_MAX_Y },
    };
    vineUniRef.current = vineUniforms;

    const vineMat = new THREE.ShaderMaterial({
      vertexShader:   VERT_SHADER,
      fragmentShader: FRAG_SHADER,
      uniforms:       vineUniforms,
    });

    [
      { s: 0,              turns: 2.5, off: 0.015 },
      { s: Math.PI * 0.50, turns: 2.8, off: 0.018 },
      { s: Math.PI * 1.15, turns: 2.3, off: 0.014 },
      { s: Math.PI * 1.72, turns: 3.0, off: 0.017 },
    ].forEach(({ s, turns, off }) => {
      const pts = [];
      for (let i = 0; i <= 110; i++) {
        const t   = i / 110;
        const y   = VINE_MIN_Y + t * (VINE_MAX_Y - VINE_MIN_Y);
        const ang = s + t * turns * Math.PI * 2;
        const tr  = 0.24 - t * 0.13; /* match trunk taper */
        const r   = tr + off;
        const wav = Math.sin(t * 22) * 0.005;
        pts.push(new THREE.Vector3(
          Math.cos(ang) * (r + wav),
          y,
          Math.sin(ang) * (r + wav)
        ));
      }
      treeGroup.add(new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 0.0065, 5, false),
        vineMat
      ));
    });

    /* ── Firefly particles ── */
    const PC  = 150;
    const pGeo = new THREE.BufferGeometry();
    const pBuf = new Float32Array(PC * 3);
    const pSp  = new Float32Array(PC);
    const pPh  = new Float32Array(PC);
    for (let i = 0; i < PC; i++) {
      pBuf[i * 3]     = rng(-6, 6);
      pBuf[i * 3 + 1] = rng(0, 7);
      pBuf[i * 3 + 2] = rng(-6, 6);
      pSp[i] = rng(0.3, 1.0);
      pPh[i] = rng(0, Math.PI * 2);
    }
    pGeo.setAttribute("position", new THREE.BufferAttribute(pBuf, 3));
    const pMat = new THREE.PointsMaterial({
      color: 0x99ffaa, size: 0.05, transparent: true, opacity: 0.65,
    });
    scene.add(new THREE.Points(pGeo, pMat));

    /* ── Animation loop ── */
    let tick = 0;
    const animate = () => {
      rafRef.current = requestAnimationFrame(animate);
      tick += 0.007;

      treeGroup.rotation.y = tick * 0.22;

      const pp = pGeo.attributes.position;
      for (let i = 0; i < PC; i++) {
        pp.setY(i, pp.getY(i) + Math.sin(tick * pSp[i] + pPh[i]) * 0.003);
        pp.setX(i, pp.getX(i) + Math.cos(tick * pSp[i] * 0.4 + pPh[i]) * 0.002);
        if (pp.getY(i) > 7) pp.setY(i, 0);
      }
      pp.needsUpdate = true;

      fillLight.intensity = 1.0 + Math.sin(tick * 1.4) * 0.13;
      pMat.opacity        = 0.50 + Math.sin(tick * 1.8) * 0.18;

      renderer.render(scene, camera);
    };
    animate();

    /* ── Resize handler ── */
    const onResize = () => {
      const nw = mount.clientWidth, nh = mount.clientHeight;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(rafRef.current);
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, []);

  /* ── Sync vine fill level with donation % ── */
  useEffect(() => {
    if (!vineUniRef.current) return;
    vineUniRef.current.uFillLevel.value = VINE_MIN_Y + pct * (VINE_MAX_Y - VINE_MIN_Y);
  }, [pct]);

  return (
    <>
      {/* Hide number input spinners */}
      <style>{`
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
        .dt-input:focus { border-color: rgba(61,186,96,0.65) !important; }
      `}</style>

      <div style={{
        position:   "relative",
        width:      "100vw",
        height:     "100vh",
        overflow:   "hidden",
        background: "#040b06",
        fontFamily: "'Cormorant Garamond', Georgia, serif",
      }}>
        {/* Three.js canvas mount */}
        <div ref={mountRef} style={{ width: "100%", height: "100%" }} />

        {/* ── UI overlay ── */}
        <div style={{
          position:   "absolute",
          bottom:     0,
          left:       0,
          right:      0,
          padding:    "2.5rem 2rem 2.2rem",
          background: "linear-gradient(to top, rgba(4,11,6,0.97) 52%, rgba(4,11,6,0.62) 78%, transparent)",
          display:    "flex",
          flexDirection: "column",
          alignItems: "center",
          gap:        "0.8rem",
        }}>

          {/* Eyebrow */}
          <p style={{
            margin:         0,
            color:          "#3dba60",
            fontSize:       "0.67rem",
            letterSpacing:  "0.38em",
            textTransform:  "uppercase",
            fontFamily:     "system-ui, sans-serif",
            fontWeight:     400,
          }}>
            Community Fundraiser
          </p>

          {/* Campaign title */}
          <h1 style={{
            margin:        0,
            color:         "#dceadc",
            fontSize:      "clamp(1.7rem, 4vw, 2.4rem)",
            fontWeight:    400,
            letterSpacing: "0.05em",
          }}>
            {TARGET_LABEL}
          </h1>

          {/* Goal */}
          <p style={{
            margin:     0,
            color:      "#5a7a5a",
            fontSize:   "0.88rem",
            fontFamily: "system-ui, sans-serif",
            fontWeight: 300,
          }}>
            Funding target:&nbsp;
            <span style={{ color: "#c8b870", fontWeight: 400 }}>
              ${TARGET_AMOUNT.toLocaleString()}
            </span>
          </p>

          {/* Dollar input */}
          <div style={{ position: "relative", width: "100%", maxWidth: "290px" }}>
            <span style={{
              position:       "absolute",
              left:           "1rem",
              top:            "50%",
              transform:      "translateY(-50%)",
              color:          "#3dba60",
              fontSize:       "1.2rem",
              pointerEvents:  "none",
              fontFamily:     "system-ui, sans-serif",
            }}>
              $
            </span>
            <input
              className="dt-input"
              type="number"
              min="0"
              max={TARGET_AMOUNT}
              value={donation}
              onChange={e => setDonation(e.target.value)}
              placeholder="Enter donation amount"
              style={{
                width:        "100%",
                boxSizing:    "border-box",
                padding:      "0.9rem 1rem 0.9rem 2.5rem",
                background:   "rgba(255,255,255,0.045)",
                border:       "1px solid rgba(61,186,96,0.20)",
                borderRadius: "4px",
                color:        "#dceadc",
                fontSize:     "1.1rem",
                fontFamily:   "system-ui, sans-serif",
                outline:      "none",
                transition:   "border-color 0.2s",
              }}
            />
          </div>

          {/* Stats row — only visible when a value is entered */}
          {raw > 0 && (
            <div style={{
              display:    "flex",
              gap:        "2.2rem",
              alignItems: "center",
              marginTop:  "0.1rem",
            }}>
              <StatPill value={`${displayPct}%`}  label="of goal"    color="#3dba60" />
              <Pip />
              <StatPill value={`$${capped.toLocaleString()}`}     label="your gift"  color="#c8b870" />
              {remaining > 0 && (
                <>
                  <Pip />
                  <StatPill value={`$${remaining.toLocaleString()}`} label="remaining" color="#5a7a6a" />
                </>
              )}
            </div>
          )}

          {/* Thin progress bar */}
          <div style={{
            width:        "100%",
            maxWidth:     "290px",
            height:       "2px",
            background:   "rgba(255,255,255,0.07)",
            borderRadius: "1px",
            overflow:     "hidden",
          }}>
            <div style={{
              width:        `${displayPct}%`,
              height:       "100%",
              background:   "linear-gradient(to right, #0d4a1f, #3dba60)",
              borderRadius: "1px",
              transition:   "width 0.35s ease",
            }} />
          </div>

          {/* Goal reached celebration */}
          {pct >= 1 && (
            <p style={{
              margin:        "0.2rem 0 0",
              color:         "#c8b870",
              fontSize:      "1.05rem",
              fontStyle:     "italic",
              letterSpacing: "0.07em",
            }}>
              ✦ Goal Fully Funded — Thank You! ✦
            </p>
          )}
        </div>
      </div>
    </>
  );
}

/* ── Small helper components ────────────────────────── */
function StatPill({ value, label, color }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ color, fontSize: "1.75rem", lineHeight: 1, fontWeight: 300 }}>
        {value}
      </div>
      <div style={{
        color:          "#3a5c3a",
        fontSize:       "0.60rem",
        letterSpacing:  "0.18em",
        textTransform:  "uppercase",
        fontFamily:     "system-ui, sans-serif",
        marginTop:      "3px",
      }}>
        {label}
      </div>
    </div>
  );
}

function Pip() {
  return (
    <div style={{ width: "1px", height: "34px", background: "rgba(255,255,255,0.08)" }} />
  );
}
