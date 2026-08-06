// v2.39 Level editor. The height callout on the drawing is the number a
// fitter reads, so it is also the number they can change: tap it in Edit
// and type. The datum it is quoted against is named, and picking another
// datum re-quotes the same absolute height rather than moving the pipe.
import { useState } from "react";
import { datumFor } from "../workspace/utils/datums";

const TEXT = {
  en: {
    title: "Level", height: "Height", from: "Measured from",
    absolute: "Absolute", apply: "Apply", cancel: "Cancel",
  },
  jp: {
    title: "高さ", height: "高さ", from: "基準",
    absolute: "絶対値", apply: "適用", cancel: "キャンセル",
  },
};

export default function LevelSheet({ value, datums, lang, onApply, onClose }) {
  const t = TEXT[lang === "jp" ? "jp" : "en"];
  const [ref, setRef] = useState(() => datumFor(value, datums));
  const [text, setText] = useState(String(Math.round(value - datumFor(value, datums).offsetMm)));

  const absolute = (Number(text) || 0) + (ref?.offsetMm ?? 0);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-scroll">
          <div className="sheet-handle" />
          <div className="sheet-title">{t.title}</div>

          <div className="sheet-row">
            <span>{t.from}</span>
            <div className="seg-group">
              {datums.map((d) => (
                <button
                  key={d.id ?? d.name}
                  className={"seg-btn" + (ref?.name === d.name ? " on" : "")}
                  onClick={() => {
                    // keep the same real height, just quote it differently
                    setText(String(Math.round(absolute - d.offsetMm)));
                    setRef(d);
                  }}
                >
                  {d.name}
                </button>
              ))}
            </div>
          </div>

          <div className="sheet-row">
            <span>{ref?.name ?? "GL"} {t.height}</span>
            <input
              type="number"
              step="10"
              value={text}
              onFocus={(e) => e.target.select()}
              onChange={(e) => setText(e.target.value)}
            />
            <span>mm</span>
          </div>
          <div className="sheet-hint">
            {t.absolute}: {absolute >= 0 ? "+" : ""}{absolute}mm
          </div>
        </div>

        <div className="sheet-actions">
          <button className="sheet-action ghost" onClick={onClose}>{t.cancel}</button>
          <button className="sheet-action solid" onClick={() => onApply(absolute)}>
            {t.apply}
          </button>
        </div>
      </div>
    </div>
  );
}
