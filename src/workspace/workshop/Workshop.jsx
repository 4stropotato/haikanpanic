// v2.06 WORKSHOP — the 3D mode of the isometric. Renders the fabrication
// model from pipe3d.js (runs, swept elbows, reducers, JIS 10K flanges) with
// a GL datum, elevation callouts and length dimensions, and stays editable:
// tapping a pipe opens the same spec sheet as the 2D view.
//
// Camera control is hand-written on touch/mouse events rather than
// OrbitControls: it has to work on the phone, so nothing is left to a
// library's gesture assumptions.
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { buildPipeModel } from "./pipe3d";

const V = (p) => new THREE.Vector3(p.x, p.y, p.z);

// Text label as a canvas sprite. `tone` picks the accent colour.
function makeLabel(text, tone = "size") {
  const palette = {
    size: { border: "#7cc4ff", fill: "#eaf0f7" },
    elev: { border: "#f5ba66", fill: "#f5ba66" },
  }[tone];
  const probe = document.createElement("canvas").getContext("2d");
  probe.font = "bold 32px system-ui, sans-serif";
  const width = Math.ceil(probe.measureText(text).width) + 32;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = 56;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "rgba(10,14,20,0.85)";
  ctx.fillRect(1, 1, width - 2, 54);
  ctx.strokeStyle = palette.border;
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, width - 2, 54);
  ctx.fillStyle = palette.fill;
  ctx.font = "bold 32px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, width / 2, 29);
  const texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false }));
  sprite.renderOrder = 10;
  sprite.userData.aspect = width / 56;
  return sprite;
}

export default function Workshop({
  lines, mmPerPoint, glOffsetMm = 0, jointTypes = {}, onEditSegment, onClose,
}) {
  const hostRef = useRef(null);
  const apiRef = useRef(null);
  const [warnings, setWarnings] = useState([]);
  const [showDims, setShowDims] = useState(true);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    // A geometry fault must never blank the view: report it and carry on
    // with whatever could be built.
    let model;
    try {
      model = buildPipeModel(lines, mmPerPoint, { glOffsetMm, jointTypes });
      setWarnings(model.warnings);
    } catch (error) {
      setWarnings([`geometry: ${String(error?.message ?? error).slice(0, 120)}`]);
      model = { runs: [], elbows: [], reducers: [], tees: [], flanges: [], points: [], warnings: [] };
    }

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(host.clientWidth || 1, host.clientHeight || 1);
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
    const flangeMat = new THREE.MeshStandardMaterial({
      color: 0x9fb0c4, metalness: 0.8, roughness: 0.28,
    });
    const boltMat = new THREE.MeshStandardMaterial({
      color: 0x2e3844, metalness: 0.9, roughness: 0.45,
    });

    const group = new THREE.Group();
    const bounds = new THREE.Box3();
    const up = new THREE.Vector3(0, 1, 0);
    const sprites = [];
    const dimObjects = [];
    const pickable = [];

    const addTube = (p1, p2, odTop, odBottom, material, meta) => {
      const a = V(p1);
      const b = V(p2);
      const dir = b.clone().sub(a);
      const height = dir.length();
      if (height < 0.5) return null;
      const geometry = new THREE.CylinderGeometry(odTop / 2, odBottom / 2, height, 32, 1);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(a).add(dir.clone().multiplyScalar(0.5));
      mesh.quaternion.setFromUnitVectors(up, dir.normalize());
      if (meta) mesh.userData = meta;
      group.add(mesh);
      bounds.expandByPoint(a);
      bounds.expandByPoint(b);
      return mesh;
    };

    const addSprite = (sprite, position) => {
      sprite.position.copy(position);
      sprites.push({ sprite });
      group.add(sprite);
      return sprite;
    };

    for (const run of model.runs) {
      const mesh = addTube(run.p1, run.p2, run.od, run.od, steel, { lineIndex: run.lineIndex });
      if (mesh) pickable.push(mesh);
      const mid = V(run.p1).add(V(run.p2)).multiplyScalar(0.5);
      const label = makeLabel(`${run.nominalA ? `${run.nominalA}A` : "pipe"} · ${run.lengthMm}`);
      addSprite(label, mid.clone().add(new THREE.Vector3(0, (run.od * 0.8) + 60, 0)));
      dimObjects.push(label);
    }

    for (const elbow of model.elbows) {
      const curve = new THREE.CatmullRomCurve3(elbow.path.map(V));
      const geometry = new THREE.TubeGeometry(curve, 24, elbow.od / 2, 32, false);
      group.add(new THREE.Mesh(geometry, fittingMat));
      elbow.path.forEach((p) => bounds.expandByPoint(V(p)));
    }

    for (const reducer of model.reducers) {
      addTube(reducer.p1, reducer.p2, reducer.od2, reducer.od1, fittingMat);
    }

    // チーズ: one arm per port, all meeting at the joint centre
    for (const tee of model.tees ?? []) {
      for (const arm of tee.arms) {
        addTube(
          tee.p,
          { x: tee.p.x + arm.x, y: tee.p.y + arm.y, z: tee.p.z + arm.z },
          tee.od, tee.od, fittingMat,
        );
      }
    }

    // JIS 10K flanges: face disc plus bolts around the bolt circle
    for (const flange of model.flanges) {
      const dir = V(flange.dir).normalize();
      const face = V(flange.p);
      const back = face.clone().add(dir.clone().multiplyScalar(flange.t));
      addTube(face, back, flange.od, flange.od, flangeMat);
      const quat = new THREE.Quaternion().setFromUnitVectors(up, dir);
      const boltGeom = new THREE.CylinderGeometry(
        flange.boltDia / 2, flange.boltDia / 2, flange.t * 1.9, 10, 1,
      );
      for (let i = 0; i < flange.boltCount; i += 1) {
        const angle = (i / flange.boltCount) * Math.PI * 2;
        const offset = new THREE.Vector3(
          Math.cos(angle) * (flange.boltCircle / 2), 0, Math.sin(angle) * (flange.boltCircle / 2),
        ).applyQuaternion(quat);
        const bolt = new THREE.Mesh(boltGeom, boltMat);
        bolt.quaternion.copy(quat);
        bolt.position.copy(face).add(dir.clone().multiplyScalar(flange.t / 2)).add(offset);
        group.add(bolt);
      }
    }

    scene.add(group);

    const modelSize = bounds.isEmpty()
      ? 2000
      : Math.max(1500, bounds.getSize(new THREE.Vector3()).length());

    // --- GL datum: ground plane at y = 0 with elevation callouts ---
    const grid = new THREE.GridHelper(modelSize * 2.2, 20, 0x35597a, 0x1b2836);
    grid.position.y = 0;
    scene.add(grid);
    addSprite(makeLabel("GL ±0", "elev"), new THREE.Vector3(
      bounds.isEmpty() ? 0 : bounds.min.x - (modelSize * 0.14),
      0,
      bounds.isEmpty() ? 0 : bounds.max.z,
    ));

    const leaderMat = new THREE.LineDashedMaterial({
      color: 0xf5ba66,
      dashSize: modelSize * 0.02,
      gapSize: modelSize * 0.014,
      opacity: 0.75,
      transparent: true,
    });
    const seenElevations = new Set();
    for (const point of model.points) {
      const elevation = Math.round(point.y);
      if (elevation <= 1 || seenElevations.has(elevation)) continue;
      seenElevations.add(elevation);
      const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(point.x, 0, point.z),
        new THREE.Vector3(point.x, point.y, point.z),
      ]);
      const line = new THREE.Line(geometry, leaderMat);
      line.computeLineDistances();
      group.add(line);
      dimObjects.push(line);
      const label = makeLabel(`EL +${elevation}`, "elev");
      addSprite(label, new THREE.Vector3(point.x, point.y * 0.5, point.z));
      dimObjects.push(label);
    }

    const camera = new THREE.PerspectiveCamera(
      48, (host.clientWidth || 1) / (host.clientHeight || 1), 1, modelSize * 60,
    );
    const target = bounds.isEmpty()
      ? new THREE.Vector3()
      : bounds.getCenter(new THREE.Vector3());
    const homeTarget = target.clone();

    // --- hand-written orbit camera ---
    const state = {
      radius: Math.max(modelSize * 1.35, 900),
      theta: Math.PI * 0.25,
      phi: Math.PI * 0.36,
    };
    const homeState = { ...state };
    const applyCamera = () => {
      state.phi = THREE.MathUtils.clamp(state.phi, 0.06, Math.PI - 0.06);
      state.radius = THREE.MathUtils.clamp(state.radius, 120, modelSize * 24);
      camera.position.set(
        target.x + (state.radius * Math.sin(state.phi) * Math.sin(state.theta)),
        target.y + (state.radius * Math.cos(state.phi)),
        target.z + (state.radius * Math.sin(state.phi) * Math.cos(state.theta)),
      );
      camera.lookAt(target);
    };
    applyCamera();

    const el = renderer.domElement;
    const drag = { active: false, x: 0, y: 0, moved: 0, pinch: 0, mode: "none" };
    const raycaster = new THREE.Raycaster();

    const pickAt = (clientX, clientY) => {
      if (!onEditSegment) return;
      const rect = el.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        (((clientX - rect.left) / rect.width) * 2) - 1,
        (-((clientY - rect.top) / rect.height) * 2) + 1,
      );
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.intersectObjects(pickable, false)[0];
      if (hit?.object?.userData?.lineIndex != null) {
        onEditSegment(hit.object.userData.lineIndex);
      }
    };

    const panBy = (dx, dy) => {
      const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0);
      const upVec = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 1);
      const scale = state.radius * 0.0016;
      target.add(right.multiplyScalar(-dx * scale)).add(upVec.multiplyScalar(dy * scale));
    };
    const rotateBy = (dx, dy) => {
      state.theta -= dx * 0.007;
      state.phi -= dy * 0.007;
    };
    const touchInfo = (touches) => {
      const [a, b] = touches;
      return {
        dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
        mx: (a.clientX + b.clientX) / 2,
        my: (a.clientY + b.clientY) / 2,
      };
    };

    const onTouchStart = (event) => {
      event.preventDefault();
      if (event.touches.length === 1) {
        drag.active = true;
        drag.mode = "rotate";
        drag.x = event.touches[0].clientX;
        drag.y = event.touches[0].clientY;
        drag.moved = 0;
      } else if (event.touches.length === 2) {
        const info = touchInfo(event.touches);
        drag.active = true;
        drag.mode = "pinch";
        drag.pinch = info.dist;
        drag.x = info.mx;
        drag.y = info.my;
        drag.moved = 999;
      }
    };
    const onTouchMove = (event) => {
      if (!drag.active) return;
      event.preventDefault();
      if (drag.mode === "rotate" && event.touches.length === 1) {
        const dx = event.touches[0].clientX - drag.x;
        const dy = event.touches[0].clientY - drag.y;
        drag.x = event.touches[0].clientX;
        drag.y = event.touches[0].clientY;
        drag.moved += Math.abs(dx) + Math.abs(dy);
        rotateBy(dx, dy);
      } else if (drag.mode === "pinch" && event.touches.length === 2) {
        const info = touchInfo(event.touches);
        if (drag.pinch > 0) state.radius *= drag.pinch / Math.max(info.dist, 1);
        panBy(info.mx - drag.x, info.my - drag.y);
        drag.pinch = info.dist;
        drag.x = info.mx;
        drag.y = info.my;
      }
      applyCamera();
    };
    const onTouchEnd = (event) => {
      if (drag.mode === "rotate" && drag.moved < 12) {
        const touch = event.changedTouches[0];
        if (touch) pickAt(touch.clientX, touch.clientY);
      }
      drag.active = event.touches.length > 0;
      drag.mode = event.touches.length === 1 ? "rotate" : "none";
      if (event.touches.length === 1) {
        drag.x = event.touches[0].clientX;
        drag.y = event.touches[0].clientY;
        drag.moved = 999;
      }
    };

    const onMouseDown = (event) => {
      drag.active = true;
      drag.mode = event.button === 2 ? "pan" : "rotate";
      drag.x = event.clientX;
      drag.y = event.clientY;
      drag.moved = 0;
    };
    const onMouseMove = (event) => {
      if (!drag.active) return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      drag.x = event.clientX;
      drag.y = event.clientY;
      drag.moved += Math.abs(dx) + Math.abs(dy);
      if (drag.mode === "pan") panBy(dx, dy); else rotateBy(dx, dy);
      applyCamera();
    };
    const onMouseUp = (event) => {
      if (drag.active && drag.mode === "rotate" && drag.moved < 6) {
        pickAt(event.clientX, event.clientY);
      }
      drag.active = false;
    };
    const onWheel = (event) => {
      event.preventDefault();
      state.radius *= event.deltaY > 0 ? 1.12 : 0.89;
      applyCamera();
    };
    const onContextMenu = (event) => event.preventDefault();

    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchEnd);
    el.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("contextmenu", onContextMenu);

    apiRef.current = {
      dolly: (factor) => { state.radius *= factor; applyCamera(); },
      home: () => {
        Object.assign(state, homeState);
        target.copy(homeTarget);
        applyCamera();
      },
      setDims: (visible) => { for (const obj of dimObjects) obj.visible = visible; },
    };

    let alive = true;
    const tick = () => {
      if (!alive) return;
      const distance = camera.position.distanceTo(target);
      for (const { sprite } of sprites) {
        const height = distance * 0.035;
        sprite.scale.set(height * (sprite.userData.aspect || 4), height, 1);
      }
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
      apiRef.current = null;
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
      el.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("contextmenu", onContextMenu);
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
  }, [lines, mmPerPoint, glOffsetMm, jointTypes, onEditSegment]);

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
        <button
          className={showDims ? "on" : ""}
          onClick={() => {
            const next = !showDims;
            setShowDims(next);
            apiRef.current?.setDims(next);
          }}
          aria-label="toggle dimensions"
        >
          寸
        </button>
      </div>
      {warnings.length > 0 && (
        <div className="workshop-warn">
          {warnings.slice(0, 3).map((warning) => <div key={warning}>⚠ {warning}</div>)}
        </div>
      )}
    </div>
  );
}
