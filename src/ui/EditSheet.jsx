// v2.02 Segment spec editor: length + JIS size + connection type in one
// bottom sheet. This data is what makes the Workshop 3D view possible —
// without diameter/schedule/connection the isometric cannot become pipes.
import { useState } from "react";
import { SGP } from "../workspace/data/jis";
import { segmentLengthMm } from "../workspace/draw/DrawLayer";

const CONN_TYPES = ["BW", "SW", "ねじ"];

export default function EditSheet({ line, mmPerPoint, lang, onApply, onClose }) {
  const [mm, setMm] = useState(String(line.lengthMm ?? segmentLengthMm(line, mmPerPoint)));
  const [nominalA, setNominalA] = useState(line.spec?.a ?? 100);
  const [conn, setConn] = useState(line.spec?.conn ?? "BW");

  const t = lang === "jp"
    ? { title: "配管の編集", length: "長さ", size: "サイズ", conn: "接続", apply: "適用", cancel: "キャンセル" }
    : { title: "Edit pipe", length: "Length", size: "Size", conn: "Joint", apply: "Apply", cancel: "Cancel" };

  const apply = () => {
    const value = Number(mm);
    if (!Number.isFinite(value) || value <= 0) return;
    onApply({ mm: value, a: nominalA, conn });
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
            onChange={(e) => setMm(e.target.value)}
          />
          <span>mm</span>
        </div>
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
        <div className="sheet-actions">
          <button className="sheet-action ghost" onClick={onClose}>{t.cancel}</button>
          <button className="sheet-action solid" onClick={apply}>{t.apply}</button>
        </div>
      </div>
    </div>
  );
}
