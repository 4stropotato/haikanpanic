// v2.02 Segment spec editor: length + JIS size + connection type in one
// bottom sheet. This data is what makes the Workshop 3D view possible —
// without diameter/schedule/connection the isometric cannot become pipes.
import { useState } from "react";
import { SGP, pipeSpec } from "../workspace/data/jis";
import { segmentLengthMm } from "../workspace/utils/lengths";

const CONN_TYPES = ["BW", "SW", "ねじ"];
const FLANGE_MODES = ["none", "start", "end", "both"];

export default function EditSheet({ line, mmPerPoint, lang, onApply, onClose }) {
  const [mm, setMm] = useState(String(line.lengthMm ?? segmentLengthMm(line, mmPerPoint)));
  const [nominalA, setNominalA] = useState(line.spec?.a ?? 100);
  const [conn, setConn] = useState(line.spec?.conn ?? "BW");
  const [flange, setFlange] = useState(line.spec?.flange ?? "none");

  const t = lang === "jp"
    ? {
      title: "配管の編集", length: "長さ", size: "サイズ", conn: "接続",
      apply: "適用", cancel: "キャンセル", flange: "フランジ",
      flangeLabels: { none: "なし", start: "始", end: "終", both: "両端" },
      tooShort: (od) => `外径 ${od}mm より短いので3Dでは管に見えません`,
    }
    : {
      title: "Edit pipe", length: "Length", size: "Size", conn: "Joint",
      apply: "Apply", cancel: "Cancel", flange: "Flange",
      flangeLabels: { none: "None", start: "Start", end: "End", both: "Both" },
      tooShort: (od) => `Shorter than the ${od}mm outside diameter — it will not read as pipe in 3D`,
    };

  // A run shorter than its own diameter is the #1 cause of blobby 3D, so
  // say it here, where the number is being typed.
  const od = pipeSpec(nominalA)?.od ?? 0;
  const tooShort = Number(mm) > 0 && Number(mm) < od;

  const apply = () => {
    const value = Number(mm);
    if (!Number.isFinite(value) || value <= 0) return;
    onApply({ mm: value, a: nominalA, conn, flange });
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
            autoFocus
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
              <option key={row.a} value={row.a}>
                {row.a}A ({row.b}B) — OD {row.od}
              </option>
            ))}
          </select>
        </div>
        <div className="sheet-hint">OD {od}mm · t {pipeSpec(nominalA)?.t ?? "-"}mm · {pipeSpec(nominalA)?.kgm ?? "-"} kg/m</div>
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
