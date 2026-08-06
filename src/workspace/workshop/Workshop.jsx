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

// How many times the 3D scene has been built this page load. A camera that
// snaps back to the same angle no matter what you do is the signature of a
// scene being rebuilt under you, so this number is the first thing to read.
let sceneBuilds = 0;

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

// v2.57 The directional label: the same text on a plane that lies along the
// pipe. A sprite always squares up to the screen, which is the traditional
// reading; this one is set on the run the way text is lettered on a drawn
// isometric, and turns about the pipe axis to stay legible.
function makeAxisLabel(text, tone, axis) {
  const sprite = makeLabel(text, tone);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      map: sprite.material.map,
      transparent: true,
      depthTest: false,
      side: THREE.DoubleSide,
    }),
  );
  mesh.renderOrder = 10;
  mesh.userData.aspect = sprite.userData.aspect;
  mesh.userData.axis = axis.clone().normalize();
  return mesh;
}

export default function Workshop({
  lines, mmPerPoint, glOffsetMm = 0, jointTypes = {}, detail = "normal",
  labelFlat = false, onEditSegment, onClose,
}) {
  const hostRef = useRef(null);
  const apiRef = useRef(null);
  const debugRef = useRef(null);
  const [warnings, setWarnings] = useState([]);
  const [showDims, setShowDims] = useState(true);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    sceneBuilds += 1;

    // v2.33 Eco trades annotation and mesh density for memory and frame
    // time — the same model, drawn cheaply.
    const eco = detail === "eco";
    const full = detail === "full";
    const radial = eco ? 14 : 32;

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
      const geometry = new THREE.CylinderGeometry(odTop / 2, odBottom / 2, height, radial, 1);
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

    // one call site for both readings, so every label answers the setting
    const addLabel = (text, tone, position, axis = null) => addSprite(
      (labelFlat || !axis || axis.lengthSq() < 1e-9)
        ? makeLabel(text, tone)
        : makeAxisLabel(text, tone, axis),
      position,
    );

    for (const run of model.runs) {
      const mesh = addTube(run.p1, run.p2, run.od, run.od, steel, { lineIndex: run.lineIndex });
      if (mesh) pickable.push(mesh);
      // beside the run, offset along its own perpendicular so the text
      // follows the pipe instead of floating over the scene
      const mid = V(run.p1).add(V(run.p2)).multiplyScalar(0.5);
      const dir = V(run.p2).sub(V(run.p1)).normalize();
      let perp = new THREE.Vector3().crossVectors(dir, up);
      if (perp.lengthSq() < 1e-6) perp = new THREE.Vector3(1, 0, 0);
      perp.normalize().multiplyScalar((run.od * 0.75) + 90);
      // a slope is worth reading off the model, a plumb or level run is not
      const sloped = Math.abs(run.slopeDeg) > 0.4 && Math.abs(run.slopeDeg) < 89.6;
      const slopeText = sloped
        ? ` · ∠${Math.abs(run.slopeDeg)}° ${run.riseMm > 0 ? "↑" : "↓"}${Math.abs(run.riseMm)}`
        : "";
      if (!eco) {
        // full detail names the material and schedule the way a spec line does
        const grade = full && run.materialId && run.materialId !== "SGP"
          ? ` ${run.materialId.replace("TP", "")}` : "";
        const sch = full && run.schedule && run.schedule !== run.materialId
          ? ` ${run.schedule}` : "";
        const size = run.nominalA ? `${run.nominalA}A${grade}${sch}` : "pipe";
        dimObjects.push(addLabel(
          `${size} · ${run.lengthMm}${slopeText}`, "size", mid.clone().add(perp),
          V(run.p2).sub(V(run.p1)),
        ));
      }
    }

    for (const elbow of model.elbows) {
      const curve = new THREE.CatmullRomCurve3(elbow.path.map(V));
      const geometry = new THREE.TubeGeometry(curve, eco ? 12 : 24, elbow.od / 2, radial, false);
      group.add(new THREE.Mesh(geometry, fittingMat));
      elbow.path.forEach((p) => bounds.expandByPoint(V(p)));
    }

    for (const reducer of model.reducers) {
      if (reducer.kind === "eccentric") {
        // the small end drops so the crowns line up, which is the whole
        // point of an eccentric on a pump suction or a drained line
        const drop = (reducer.od1 - reducer.od2) / 2;
        addTube(
          reducer.p1,
          { x: reducer.p2.x, y: reducer.p2.y - drop, z: reducer.p2.z },
          reducer.od2, reducer.od1, fittingMat,
        );
      } else {
        addTube(reducer.p1, reducer.p2, reducer.od2, reducer.od1, fittingMat);
      }
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

    // v2.34 Flange faces. The face disc is common to all of them; what
    // differs is what sits behind it — a hub for a slip-on, a taper for a
    // weld neck, and nothing at all for a blind, which closes the line.
    for (const flange of model.flanges) {
      const dir = V(flange.dir).normalize();
      const face = V(flange.p);
      const back = face.clone().add(dir.clone().multiplyScalar(-flange.t));
      addTube(back, face, flange.od, flange.od, flangeMat);

      const hubOd = Math.min(flange.od * 0.72, flange.pipeOd * 1.6);
      if (flange.type === "WN") {
        const neck = back.clone().add(dir.clone().multiplyScalar(-flange.t * 2.2));
        addTube(neck, back, flange.pipeOd * 1.05, hubOd, flangeMat);
      } else if (flange.type !== "BL") {
        const hub = back.clone().add(dir.clone().multiplyScalar(-flange.t * 0.9));
        addTube(hub, back, hubOd, hubOd, flangeMat);
      }

      if (eco) continue;                                                    // bolts are detail
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
        bolt.position.copy(face).add(dir.clone().multiplyScalar(-flange.t / 2)).add(offset);
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
    for (const point of eco ? [] : model.points) {
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
      dimObjects.push(addLabel(
        `EL +${elevation}`, "elev",
        new THREE.Vector3(point.x, point.y * 0.5, point.z),
        new THREE.Vector3(0, 1, 0),
      ));
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

    // --- input ---
    // Pointer events drive the camera. Move/up are bound to the WINDOW
    // rather than using setPointerCapture: capture on a touch pointer is
    // unreliable on iOS and can stop pointermove being delivered at all.
    // Touch events act as a fallback for any engine that skips pointers.
    const el = renderer.domElement;
    const raycaster = new THREE.Raycaster();
    const pointers = new Map();
    let gesture = null;
    let sawPointer = false;
    const stats = { down: 0, move: 0, touch: 0, tmove: 0, cam: 0, doc: 0 };
    // If the canvas sees nothing, something is on top of it. Ask the browser
    // what is actually at the centre of the screen, and count touches that
    // reach the document at all.
    const docTouch = () => { stats.doc += 1; };
    document.addEventListener("touchstart", docTouch, true);
    document.addEventListener("pointerdown", docTouch, true);

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

    // shared gesture core, fed by either event family
    const beginGesture = (points, button = 0) => {
      if (points.length === 1) {
        gesture = { mode: button === 2 ? "pan" : "rotate", moved: 0, x: points[0].x, y: points[0].y };
      } else if (points.length >= 2) {
        const [a, b] = points;
        gesture = {
          mode: "pinch", moved: 999,
          dist: Math.hypot(a.x - b.x, a.y - b.y),
          x: (a.x + b.x) / 2, y: (a.y + b.y) / 2,
        };
      }
    };

    const moveGesture = (points) => {
      if (!gesture) return;
      if (gesture.mode === "pinch" && points.length >= 2) {
        const [a, b] = points;
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        if (gesture.dist > 0) state.radius *= gesture.dist / Math.max(dist, 1);
        panBy(mx - gesture.x, my - gesture.y);
        gesture.dist = dist;
        gesture.x = mx;
        gesture.y = my;
      } else if (points.length === 1) {
        const dx = points[0].x - gesture.x;
        const dy = points[0].y - gesture.y;
        gesture.x = points[0].x;
        gesture.y = points[0].y;
        gesture.moved += Math.abs(dx) + Math.abs(dy);
        if (gesture.mode === "pan") panBy(dx, dy); else rotateBy(dx, dy);
      }
      stats.cam += 1;
      applyCamera();
    };

    const onPointerDown = (event) => {
      sawPointer = true;
      stats.down += 1;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      beginGesture([...pointers.values()], event.button);
    };
    const onPointerMove = (event) => {
      if (!pointers.has(event.pointerId) || !gesture) return;
      stats.move += 1;
      if (event.cancelable) event.preventDefault();
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      moveGesture([...pointers.values()]);
    };
    const onPointerUp = (event) => {
      if (!pointers.has(event.pointerId)) return;
      const finished = gesture;
      pointers.delete(event.pointerId);
      if (pointers.size === 0) {
        if (finished?.mode === "rotate" && finished.moved < 8) {
          pickAt(event.clientX, event.clientY);
        }
        gesture = null;
      } else {
        beginGesture([...pointers.values()]);
      }
    };

    const touchPoints = (event) => [...event.touches].map((t) => ({ x: t.clientX, y: t.clientY }));
    const onTouchStart = (event) => {
      stats.touch += 1;
      if (sawPointer) return;
      if (event.cancelable) event.preventDefault();
      beginGesture(touchPoints(event));
    };
    const onTouchMove = (event) => {
      stats.tmove += 1;
      if (sawPointer) return;
      if (event.cancelable) event.preventDefault();
      moveGesture(touchPoints(event));
    };
    const onTouchEnd = (event) => {
      if (sawPointer) return;
      if (event.touches.length === 0) gesture = null;
      else beginGesture(touchPoints(event));
    };

    const onWheel = (event) => {
      event.preventDefault();
      state.radius *= event.deltaY > 0 ? 1.12 : 0.89;
      stats.cam += 1;
      applyCamera();
    };
    const onContextMenu = (event) => event.preventDefault();

    el.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
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

    const topElement = () => {
      const found = document.elementFromPoint(
        Math.round(window.innerWidth / 2), Math.round(window.innerHeight / 2),
      );
      if (!found) return "none";
      const cls = typeof found.className === "string" && found.className
        ? `.${found.className.split(" ")[0]}` : "";
      return `${found.tagName.toLowerCase()}${cls}`;
    };

    let alive = true;
    const tick = () => {
      if (!alive) return;
      const distance = camera.position.distanceTo(target);
      for (const { sprite } of sprites) {
        const height = distance * 0.018;
        sprite.scale.set(height * (sprite.userData.aspect || 4), height, 1);
        const axis = sprite.userData.axis;
        if (!axis) continue;
        // spin about the pipe so the face is as square to the camera as the
        // axis allows, and never let it read upside down
        const toEye = camera.position.clone().sub(sprite.position);
        const normal = toEye.sub(axis.clone().multiplyScalar(toEye.dot(axis)));
        if (normal.lengthSq() < 1e-9) continue;
        normal.normalize();
        // reading direction is decided in the camera's own frame: projecting
        // a direction as if it were a point gives a meaningless answer
        const x = axis.clone();
        if (axis.clone().transformDirection(camera.matrixWorldInverse).x < 0) x.negate();
        const y = normal.clone().cross(x).normalize();
        sprite.matrixAutoUpdate = false;
        sprite.matrix.makeBasis(x, y, normal);
        sprite.matrix.scale(sprite.scale);
        sprite.matrix.setPosition(sprite.position);
        sprite.matrixWorldNeedsUpdate = true;
      }
      renderer.render(scene, camera);
      if (debugRef.current) {
        debugRef.current.textContent =
          `b${sceneBuilds} pd${stats.down} pm${stats.move} ts${stats.touch}`
          + ` tm${stats.tmove} cam${stats.cam} doc${stats.doc}\ntop: ${topElement()}`;
      }
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
      el.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("wheel", onWheel);
      document.removeEventListener("touchstart", docTouch, true);
      document.removeEventListener("pointerdown", docTouch, true);
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
  }, [lines, mmPerPoint, glOffsetMm, jointTypes, detail, onEditSegment]);

  return (
    <div className="workshop">
      <div className="workshop-canvas" ref={hostRef} />
      <div className="workshop-chrome">
        {/* v2.63 The brand leads, the mode follows underneath — Workshop is
            a room inside Haikanpanic, not a separate app. */}
        <span className="workshop-brand">
          <span className="workshop-mark">ハイカンパニック!</span>
          <span className="workshop-title">WORKSHOP</span>
        </span>
        <button className="workshop-close" onClick={onClose}>✕</button>
      </div>
      {new URLSearchParams(window.location.search).has("debug") && (
        <div className="workshop-debug" ref={debugRef} />
      )}
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
