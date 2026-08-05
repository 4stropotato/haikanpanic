// v2.05 WORKSHOP — the 3D view inside Draw. Renders the fabrication model
// from pipe3d.js: straight runs, swept long-radius elbows, and concentric
// reducers where the size changes. CAD camera: orbit / pinch-zoom / pan.
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { buildPipeModel } from "./pipe3d";

const V = (p) => new THREE.Vector3(p.x, p.y, p.z);

// Size label as a cheap canvas sprite so pipes are identifiable in 3D.
function makeLabel(text) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "rgba(10,14,20,0.82)";
  ctx.fillRect(6, 8, 244, 48);
  ctx.strokeStyle = "#7cc4ff";
  ctx.lineWidth = 2;
  ctx.strokeRect(6, 8, 244, 48);
  ctx.fillStyle = "#eaf0f7";
  ctx.font = "bold 30px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 128, 33);
  const texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false }));
  sprite.renderOrder = 10;
  return sprite;
}

export default function Workshop({ lines, mmPerPoint, onClose }) {
  const hostRef = useRef(null);
  const apiRef = useRef(null);
  const [warnings, setWarnings] = useState([]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    const model = buildPipeModel(lines, mmPerPoint);
    setWarnings(model.warnings);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(host.clientWidth || 1, host.clientHeight || 1);
    // input must reach the canvas: no browser gestures, no parent handlers
    Object.assign(renderer.domElement.style, {
      display: "block", width: "100%", height: "100%", touchAction: "none",
    });
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0e14);

    scene.add(new THREE.HemisphereLight(0xbcd4ff, 0x1a2230, 1.0));
    const sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.position.set(1, 2, 1.4);
    scene.add(sun);
    const rim = new THREE.DirectionalLight(0x7cc4ff, 0.6);
    rim.position.set(-1.5, 0.6, -1);
    scene.add(rim);

    const steel = new THREE.MeshStandardMaterial({
      color: 0xaebbc9, metalness: 0.72, roughness: 0.32,
    });
    const fittingMat = new THREE.MeshStandardMaterial({
      color: 0xf0a94a, metalness: 0.6, roughness: 0.38,
    });

    const group = new THREE.Group();
    const bounds = new THREE.Box3();
    const up = new THREE.Vector3(0, 1, 0);
    const labels = [];

    const addTube = (p1, p2, odTop, odBottom, material) => {
      const a = V(p1);
      const b = V(p2);
      const dir = b.clone().sub(a);
      const height = dir.length();
      if (height < 0.5) return;
      const geometry = new THREE.CylinderGeometry(odTop / 2, odBottom / 2, height, 32, 1);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(a).add(dir.clone().multiplyScalar(0.5));
      mesh.quaternion.setFromUnitVectors(up, dir.normalize());
      group.add(mesh);
      bounds.expandByPoint(a);
      bounds.expandByPoint(b);
    };

    for (const run of model.runs) {
      addTube(run.p1, run.p2, run.od, run.od, steel);
      if (run.nominalA) {
        const label = makeLabel(`${run.nominalA}A`);
        const mid = V(run.p1).add(V(run.p2)).multiplyScalar(0.5);
        label.position.copy(mid).add(new THREE.Vector3(0, (run.od * 0.9) + 40, 0));
        labels.push({ sprite: label });
        group.add(label);
      }
    }

    // elbows: sweep the pipe section along the bend path
    for (const elbow of model.elbows) {
      const curve = new THREE.CatmullRomCurve3(elbow.path.map(V));
      const geometry = new THREE.TubeGeometry(curve, 24, elbow.od / 2, 32, false);
      group.add(new THREE.Mesh(geometry, fittingMat));
      elbow.path.forEach((p) => bounds.expandByPoint(V(p)));
    }

    for (const reducer of model.reducers) {
      addTube(reducer.p1, reducer.p2, reducer.od2, reducer.od1, fittingMat);
    }

    scene.add(group);

    const size = bounds.isEmpty()
      ? 2000
      : Math.max(2000, bounds.getSize(new THREE.Vector3()).length() * 1.5);
    const grid = new THREE.GridHelper(size, 24, 0x2b4a66, 0x1a2635);
    grid.position.y = (bounds.isEmpty() ? 0 : bounds.min.y) - Math.max(size * 0.04, 60);
    scene.add(grid);

    const camera = new THREE.PerspectiveCamera(
      48, (host.clientWidth || 1) / (host.clientHeight || 1), 1, size * 40,
    );
    const center = bounds.isEmpty()
      ? new THREE.Vector3()
      : bounds.getCenter(new THREE.Vector3());
    const radius = bounds.isEmpty()
      ? 1200
      : Math.max(bounds.getSize(new THREE.Vector3()).length() * 0.9, 600);
    const home = new THREE.Vector3(
      center.x + (radius * 0.9), center.y + (radius * 0.55), center.z + (radius * 0.9),
    );
    camera.position.copy(home);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(center);
    controls.enableDamping = true;
    controls.dampingFactor = 0.09;
    controls.enableRotate = true;
    controls.enableZoom = true;
    controls.enablePan = true;
    controls.zoomSpeed = 1.1;
    controls.rotateSpeed = 0.9;
    controls.minDistance = 60;
    controls.maxDistance = size * 12;
    // one finger orbits, two fingers pinch-zoom and pan
    controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN,
    };
    controls.update();

    apiRef.current = {
      dolly: (factor) => {
        const offset = camera.position.clone().sub(controls.target);
        const distance = THREE.MathUtils.clamp(
          offset.length() * factor, controls.minDistance, controls.maxDistance,
        );
        camera.position.copy(controls.target).add(offset.setLength(distance));
        controls.update();
      },
      home: () => {
        camera.position.copy(home);
        controls.target.copy(center);
        controls.update();
      },
    };

    let alive = true;
    const tick = () => {
      if (!alive) return;
      // keep labels a constant on-screen size
      const distance = camera.position.distanceTo(controls.target);
      for (const { sprite } of labels) {
        const scale = distance * 0.06;
        sprite.scale.set(scale, scale * 0.25, 1);
      }
      controls.update();
      renderer.render(scene, camera);
      requestAnimationFrame(tick);
    };
    tick();

    const resize = () => {
      const w = host.clientWidth || 1;
      const h = host.clientHeight || 1;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);

    return () => {
      alive = false;
      observer.disconnect();
      controls.dispose();
      apiRef.current = null;
      scene.traverse((obj) => {
        obj.geometry?.dispose?.();
        const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const material of materials) {
          material?.map?.dispose?.();
          material?.dispose?.();
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement);
    };
  }, [lines, mmPerPoint]);

  return (
    <div className="workshop">
      <div className="workshop-canvas" ref={hostRef} />
      <div className="workshop-chrome">
        <span className="workshop-title">WORKSHOP</span>
        <button className="workshop-close" onClick={onClose}>✕</button>
      </div>
      <div className="workshop-tools">
        <button onClick={() => apiRef.current?.dolly(0.75)} aria-label="zoom in">＋</button>
        <button onClick={() => apiRef.current?.dolly(1.33)} aria-label="zoom out">－</button>
        <button onClick={() => apiRef.current?.home()} aria-label="reset view">⌂</button>
      </div>
      {warnings.length > 0 && (
        <div className="workshop-warn">
          {warnings.slice(0, 3).map((warning) => <div key={warning}>⚠ {warning}</div>)}
        </div>
      )}
    </div>
  );
}
