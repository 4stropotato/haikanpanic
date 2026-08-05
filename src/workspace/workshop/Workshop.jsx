// v2.02 WORKSHOP — the 3D view inside Draw. The isometric sketch becomes
// real pipes in real time: diameters come from each line's JIS spec, joints
// become elbows. CAD-style orbit/zoom/pan camera. Scene units are mm.
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { isoDirectionTo3D } from "../utils/handoff";
import { segmentLengthMm } from "../draw/DrawLayer";
import { pipeSpec } from "../data/jis";
import { pointStep } from "../utils/constants";

const key2D = (p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`;

// Walk the sketch in draw order and place every 2D endpoint in 3D mm-space.
// Iso axes map: sketch Z (vertical) -> three.js Y (up).
function buildSegments3D(lines, mmPerPoint) {
  const pos = new Map();
  const segments = [];
  const scale = mmPerPoint / pointStep;

  // v2.04 adaptive default: unspecified lines get an OD proportional to the
  // sketch (12% of median run) so short sketches still read as pipes; a real
  // JIS spec always wins.
  const lens = lines.map((l) => l.lengthMm ?? segmentLengthMm(l, mmPerPoint)).sort((a, b) => a - b);
  const median = lens.length ? lens[Math.floor(lens.length / 2)] : 500;
  const defaultOd = Math.min(Math.max(median * 0.12, 4), 114.3);

  for (const line of lines) {
    const dir = isoDirectionTo3D(line.end.x - line.start.x, line.end.y - line.start.y);
    const lenMm = line.lengthMm ?? segmentLengthMm(line, mmPerPoint);
    const startKey = key2D(line.start);
    const endKey = key2D(line.end);
    if (!pos.has(startKey)) {
      // v2.04 disconnected piece: anchor from its sketch position (mm-scaled)
      // instead of piling everything onto the origin.
      pos.set(startKey, new THREE.Vector3(line.start.x * scale, -line.start.y * scale, 0));
    }
    const p1 = pos.get(startKey);
    const p2 = pos.has(endKey)
      ? pos.get(endKey)
      : p1.clone().add(new THREE.Vector3(dir[0], dir[2], -dir[1]).multiplyScalar(lenMm));
    pos.set(endKey, p2);
    const od = line.spec ? (pipeSpec(line.spec.a)?.od ?? defaultOd) : defaultOd;
    segments.push({ p1, p2, od, spec: line.spec });
  }
  return segments;
}

export default function Workshop({ lines, mmPerPoint, onClose }) {
  const hostRef = useRef(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(host.clientWidth, host.clientHeight);
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0e14);
    scene.fog = new THREE.Fog(0x0a0e14, 4000, 12000);

    scene.add(new THREE.HemisphereLight(0xbcd4ff, 0x1a2230, 0.9));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(1200, 2200, 900);
    scene.add(sun);

    const pipeMaterial = new THREE.MeshStandardMaterial({
      color: 0xb9c6d4, metalness: 0.75, roughness: 0.3,
    });
    const jointMaterial = new THREE.MeshStandardMaterial({
      color: 0xf5ba66, metalness: 0.6, roughness: 0.35,
    });

    const segments = buildSegments3D(lines, mmPerPoint);
    const group = new THREE.Group();
    const up = new THREE.Vector3(0, 1, 0);
    const bounds = new THREE.Box3();

    for (const seg of segments) {
      const dir = seg.p2.clone().sub(seg.p1);
      const length = dir.length();
      if (length < 1) continue;
      const geometry = new THREE.CylinderGeometry(seg.od / 2, seg.od / 2, length, 28, 1);
      const mesh = new THREE.Mesh(geometry, pipeMaterial);
      mesh.position.copy(seg.p1).add(dir.clone().multiplyScalar(0.5));
      mesh.quaternion.setFromUnitVectors(up, dir.normalize());
      group.add(mesh);
      bounds.expandByPoint(seg.p1);
      bounds.expandByPoint(seg.p2);
    }

    // joints: sphere slightly larger than the biggest pipe meeting there
    const jointRadius = new Map();
    for (const seg of segments) {
      const segLen = seg.p2.clone().sub(seg.p1).length();
      for (const p of [seg.p1, seg.p2]) {
        const k = `${p.x.toFixed(1)},${p.y.toFixed(1)},${p.z.toFixed(1)}`;
        const entry = jointRadius.get(k);
        if (!entry) jointRadius.set(k, { p, r: seg.od / 2, minLen: segLen, count: 1 });
        else {
          entry.r = Math.max(entry.r, seg.od / 2);
          entry.minLen = Math.min(entry.minLen, segLen);
          entry.count += 1;
        }
      }
    }
    for (const { p, r, minLen, count } of jointRadius.values()) {
      if (count < 2) continue;
      // v2.03 cap: the elbow ball may never swallow a short pipe — it stays
      // under 45% of the shortest adjacent run.
      const radius = Math.min(r * 1.18, Math.max(minLen * 0.45, 1));
      if (radius < r * 0.35) continue;
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 18), jointMaterial);
      mesh.position.copy(p);
      group.add(mesh);
    }
    scene.add(group);

    // floor grid under the lowest point
    const size = Math.max(3000, bounds.getSize(new THREE.Vector3()).length() * 1.6 || 3000);
    const grid = new THREE.GridHelper(size, 30, 0x2b4a66, 0x1a2635);
    grid.position.y = (bounds.min.y || 0) - 120;
    scene.add(grid);

    const camera = new THREE.PerspectiveCamera(
      50, host.clientWidth / host.clientHeight, 1, 50000,
    );
    const center = bounds.isEmpty() ? new THREE.Vector3() : bounds.getCenter(new THREE.Vector3());
    const radius = bounds.isEmpty() ? 800 : Math.max(bounds.getSize(new THREE.Vector3()).length() * 0.75, 600);
    camera.position.set(center.x + radius, center.y + radius * 0.7, center.z + radius);
    camera.lookAt(center);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(center);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;

    let alive = true;
    const tick = () => {
      if (!alive) return;
      controls.update();
      renderer.render(scene, camera);
      requestAnimationFrame(tick);
    };
    tick();

    const onResize = () => {
      camera.aspect = host.clientWidth / host.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(host.clientWidth, host.clientHeight);
    };
    window.addEventListener("resize", onResize);

    return () => {
      alive = false;
      window.removeEventListener("resize", onResize);
      controls.dispose();
      scene.traverse((obj) => {
        obj.geometry?.dispose?.();
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        else obj.material?.dispose?.();
      });
      renderer.dispose();
      host.removeChild(renderer.domElement);
    };
  }, [lines, mmPerPoint]);

  return (
    <div className="workshop">
      <div className="workshop-canvas" ref={hostRef} />
      <div className="workshop-chrome">
        <span className="workshop-title">WORKSHOP</span>
        <button className="workshop-close" onClick={onClose}>✕</button>
      </div>
    </div>
  );
}
