// v2.18 Datum editor. Every control applies as you touch it — nothing waits
// for an Apply press, so a missed tap can never leave the datum half-edited.
// The height field is labelled with the datum you picked, because GL and FL
// are the names a fitter reads off the drawing.
const TEXT = {
  en: {
    title: "Datum",
    name: "Datum",
    height: (name) => `${name} elevation`,
    width: "Width",
    depth: "Depth",
    auto: "auto",
    mode: "Extent",
    area: "Area",
    cont: "Continuous",
    reset: "Reset size to fit",
    done: "Done",
    note: (name) => `Pipe elevations are read from ${name}. Workshop lifts the model to match.`,
  },
  jp: {
    title: "基準面",
    name: "基準",
    height: (name) => `${name} の高さ`,
    width: "幅",
    depth: "奥行",
    auto: "自動",
    mode: "範囲",
    area: "範囲指定",
    cont: "連続",
    reset: "サイズを自動に戻す",
    done: "完了",
    note: (name) => `配管の EL は ${name} からの高さです。3Dも同じだけ持ち上がります。`,
  },
};

export default function GlSheet({ value, lang, onChange, onReset, onClose }) {
  const t = TEXT[lang === "jp" ? "jp" : "en"];
  const name = value.name ?? "GL";

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-scroll">
          <div className="sheet-handle" />
          <div className="sheet-title">{t.title} · {name}</div>

          <div className="sheet-row">
            <span>{t.name}</span>
            <div className="seg-group">
              {["GL", "FL", "TOS"].map((item) => (
                <button
                  key={item}
                  className={"seg-btn" + (name === item ? " on" : "")}
                  onClick={() => onChange({ name: item })}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="sheet-row">
            <span>{t.height(name)}</span>
            <input
              type="number"
              step="100"
              value={value.offsetMm}
              onFocus={(e) => e.target.select()}
              onChange={(e) => onChange({ offsetMm: Number(e.target.value) || 0 })}
            />
            <span>mm</span>
          </div>
          <div className="sheet-hint">{t.note(name)}</div>

          <div className="sheet-row">
            <span>{t.mode}</span>
            <div className="seg-group">
              <button
                className={"seg-btn" + (value.continuous ? "" : " on")}
                onClick={() => onChange({ continuous: false })}
              >
                {t.area}
              </button>
              <button
                className={"seg-btn" + (value.continuous ? " on" : "")}
                onClick={() => onChange({ continuous: true })}
              >
                {t.cont}
              </button>
            </div>
          </div>

          {!value.continuous && (
            <>
              <div className="sheet-row">
                <span>{t.width}</span>
                <input
                  type="number"
                  min="0"
                  step="500"
                  placeholder={t.auto}
                  value={value.sizeMm || ""}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => onChange({ sizeMm: Math.max(0, Number(e.target.value) || 0) })}
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
                  value={value.sizeVMm || ""}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => onChange({ sizeVMm: Math.max(0, Number(e.target.value) || 0) })}
                />
                <span>mm</span>
              </div>
              <button className="sheet-btn" onClick={onReset}>{t.reset}</button>
            </>
          )}
        </div>

        <div className="sheet-actions">
          <button className="sheet-action solid" onClick={onClose}>{t.done}</button>
        </div>
      </div>
    </div>
  );
}
