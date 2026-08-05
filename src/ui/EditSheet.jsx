// v2.07 Segment spec editor: everything the shop needs to know about one
// run — length, size, material, schedule, joint type, 裏波 root gap and
// flanges. This record is what makes Workshop 3D and the cut list possible.
import { useState } from "react";
import {
  SGP, pipeSpec, MATERIALS, SCHEDULES,
  material as materialOf, wallThickness, massPerMetre,
} from "../workspace/data/jis";
import { segmentLengthMm } from "../workspace/utils/lengths";

const CONN_TYPES = ["BW", "SW", "ねじ"];
const FLANGE_MODES = ["none", "start", "end", "both"];

const TEXT = {
  en: {
    title: "Edit pipe",
    length: "Length",
    size: "Size",
    material: "Material",
    schedule: "Schedule",
    conn: "Joint",
    gap: "Root gap",
    flange: "Flange",
    apply: "Apply",
    cancel: "Cancel",
    gapNote: "裏波 back-bead gap — comes off the cut length",
    tooShort: (od) => `Shorter than the ${od}mm outside diameter — it will not read as pipe in 3D`,
    flangeLabels: { none: "None", start: "Start", end: "End", both: "Both" },
  },
  jp: {
    title: "配管の編集",
    length: "長さ",
    size: "サイズ",
    material: "材質",
    schedule: "スケジュール",
    conn: "継手",
    gap: "ルートギャップ",
    flange: "フランジ",
    apply: "適用",
    cancel: "キャンセル",
    gapNote: "裏波用の開先ギャップ — 切断長から差し引き",
    tooShort: (od) => `外径 ${od}mm より短いので3Dでは管に見えません`,
    flangeLabels: { none: "なし", start: "始", end: "終", both: "両端" },
  },
};

export default function EditSheet({ line, mmPerPoint, lang, onApply, onClose }) {
  const spec = line.spec ?? {};
  const [mm, setMm] = useState(String(line.lengthMm ?? segmentLengthMm(line, mmPerPoint)));
  const [nominalA, setNominalA] = useState(spec.a ?? 100);
  const [materialId, setMaterialId] = useState(spec.material ?? "SGP");
  const [schedule, setSchedule] = useState(
    spec.schedule ?? materialOf(spec.material ?? "SGP").defaultSchedule,
  );
  const [conn, setConn] = useState(spec.conn ?? "BW");
  const [gap, setGap] = useState(String(spec.gap ?? materialOf(spec.material ?? "SGP").gap));
  const [flange, setFlange] = useState(spec.flange ?? "none");

  const t = TEXT[lang === "jp" ? "jp" : "en"];
  const od = pipeSpec(nominalA)?.od ?? 0;
  const wall = wallThickness(nominalA, schedule);
  const kgm = massPerMetre(nominalA, schedule, materialId);
  const tooShort = Number(mm) > 0 && Number(mm) < od;

  // Switching material moves the schedule and gap to that material's usual
  // ones, so stainless never silently stays on a carbon-steel schedule.
  const changeMaterial = (id) => {
    setMaterialId(id);
    setSchedule(materialOf(id).defaultSchedule);
    setGap(String(materialOf(id).gap));
  };

  const apply = () => {
    const value = Number(mm);
    if (!Number.isFinite(value) || value <= 0) return;
    onApply({
      mm: value,
      a: nominalA,
      conn,
      flange,
      material: materialId,
      schedule,
      gap: Number(gap) || 0,
    });
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-title">{t.title}</div>

        <div className="sheet-row">
          <span>{t.length}</span>
          <input
            type="number"
            min="1"
            value={mm}
            onFocus={(e) => e.target.select()}
            onChange={(e) => setMm(e.target.value)}
          />
          <span>mm</span>
        </div>
        {tooShort && <div className="sheet-hint warn">⚠ {t.tooShort(od)}</div>}

        <div className="sheet-row">
          <span>{t.size}</span>
          <select value={nominalA} onChange={(e) => setNominalA(Number(e.target.value))}>
            {SGP.map((row) => (
              <option key={row.a} value={row.a}>{row.a}A ({row.b}B)</option>
            ))}
          </select>
        </div>

        <div className="sheet-row">
          <span>{t.material}</span>
          <select value={materialId} onChange={(e) => changeMaterial(e.target.value)}>
            {MATERIALS.map((row) => (
              <option key={row.id} value={row.id}>{row.label}</option>
            ))}
          </select>
        </div>

        <div className="sheet-row">
          <span>{t.schedule}</span>
          <div className="seg-group">
            {SCHEDULES.map((item) => (
              <button
                key={item}
                className={"seg-btn" + (schedule === item ? " on" : "")}
                onClick={() => setSchedule(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        <div className="sheet-hint">
          OD {od}mm · t {wall ?? "-"}mm · {kgm ?? "-"} kg/m · {materialOf(materialId).spec}
        </div>

        <div className="sheet-row">
          <span>{t.conn}</span>
          <div className="seg-group">
            {CONN_TYPES.map((type) => (
              <button
                key={type}
                className={"seg-btn" + (conn === type ? " on" : "")}
                onClick={() => setConn(type)}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {conn === "BW" && (
          <>
            <div className="sheet-row">
              <span>{t.gap}</span>
              <input
                type="number"
                min="0"
                step="0.5"
                value={gap}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setGap(e.target.value)}
              />
              <span>mm</span>
            </div>
            <div className="sheet-hint">{t.gapNote}</div>
          </>
        )}

        <div className="sheet-row">
          <span>{t.flange}</span>
          <div className="seg-group">
            {FLANGE_MODES.map((mode) => (
              <button
                key={mode}
                className={"seg-btn" + (flange === mode ? " on" : "")}
                onClick={() => setFlange(mode)}
              >
                {t.flangeLabels[mode]}
              </button>
            ))}
          </div>
        </div>

        <div className="sheet-actions">
          <button className="sheet-action ghost" onClick={onClose}>{t.cancel}</button>
          <button className="sheet-action solid" onClick={apply}>{t.apply}</button>
        </div>
      </div>
    </div>
  );
}
