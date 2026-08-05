// v2.13 Datum editor — the GL/FL plane gets the same treatment as a pipe:
// tap it and type the numbers instead of only dragging.
import { useState } from "react";

const TEXT = {
  en: {
    title: "Datum plane", name: "Name", height: "Height above pipe base",
    width: "Width", depth: "Depth", auto: "auto", mode: "Extent",
    area: "Area", cont: "Continuous", reset: "Reset to fit",
    apply: "Apply", cancel: "Cancel",
    note: "Height lifts the whole model in Workshop by the same amount.",
  },
  jp: {
    title: "基準面 (GL/FL)", name: "名称", height: "配管下端からの高さ",
    width: "幅", depth: "奥行", auto: "自動", mode: "範囲",
    area: "範囲指定", cont: "連続", reset: "自動に戻す",
    apply: "適用", cancel: "キャンセル",
    note: "高さの分だけ Workshop の3Dも持ち上がります。",
  },
};

export default function GlSheet({ value, lang, onApply, onReset, onClose }) {
  const t = TEXT[lang === "jp" ? "jp" : "en"];
  const [name, setName] = useState(value.name ?? "GL");
  const [height, setHeight] = useState(String(value.offsetMm ?? 0));
  const [width, setWidth] = useState(String(value.sizeMm || ""));
  const [depth, setDepth] = useState(String(value.sizeVMm || ""));
  const [continuous, setContinuous] = useState(!!value.continuous);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-title">{t.title}</div>

        <div className="sheet-row">
          <span>{t.name}</span>
          <div className="seg-group">
            {["GL", "FL", "TOS"].map((item) => (
              <button
                key={item}
                className={"seg-btn" + (name === item ? " on" : "")}
                onClick={() => setName(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="sheet-row">
          <span>{t.height}</span>
          <input
            type="number"
            step="100"
            value={height}
            onFocus={(e) => e.target.select()}
            onChange={(e) => setHeight(e.target.value)}
          />
          <span>mm</span>
        </div>
        <div className="sheet-hint">{t.note}</div>

        <div className="sheet-row">
          <span>{t.mode}</span>
          <div className="seg-group">
            <button
              className={"seg-btn" + (continuous ? "" : " on")}
              onClick={() => setContinuous(false)}
            >
              {t.area}
            </button>
            <button
              className={"seg-btn" + (continuous ? " on" : "")}
              onClick={() => setContinuous(true)}
            >
              {t.cont}
            </button>
          </div>
        </div>

        {!continuous && (
          <>
            <div className="sheet-row">
              <span>{t.width}</span>
              <input
                type="number"
                min="0"
                step="500"
                placeholder={t.auto}
                value={width}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setWidth(e.target.value)}
              />
              <span>mm</span>
            </div>
            <div className="sheet-row">
              <span>{t.depth}</span>
              <input
                type="number"
                min="0"
                step="500"
                placeholder={t.auto}
                value={depth}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setDepth(e.target.value)}
              />
              <span>mm</span>
            </div>
            <button className="sheet-btn" onClick={onReset}>{t.reset}</button>
          </>
        )}

        <div className="sheet-actions">
          <button className="sheet-action ghost" onClick={onClose}>{t.cancel}</button>
          <button
            className="sheet-action solid"
            onClick={() => onApply({
              name,
              offsetMm: Number(height) || 0,
              sizeMm: Math.max(0, Number(width) || 0),
              sizeVMm: Math.max(0, Number(depth) || 0),
              continuous,
            })}
          >
            {t.apply}
          </button>
        </div>
      </div>
    </div>
  );
}
