// v2.19 Datum editor. A site has several levels, so this edits one plane out
// of a list and can add or remove them. Every control applies as you touch
// it — nothing waits on an Apply press. Number fields keep their own text
// while you type, so clearing a field to retype it cannot snap back.
import { useEffect, useState } from "react";
import { DATUM_NAMES } from "../workspace/utils/datums";

const TEXT = {
  en: {
    title: "Datums",
    primary: "primary",
    name: "Name",
    height: (name) => `${name} elevation`,
    width: "Width",
    depth: "Depth",
    auto: "auto",
    mode: "Extent",
    area: "Area",
    cont: "Continuous",
    reset: "Refit size to drawing",
    add: "Add datum",
    remove: "Delete this datum",
    done: "Done",
    note: (name) => `Pipe elevations are measured from ${name}.`,
    noteOther: "Reference level only.",
  },
  jp: {
    title: "基準面",
    primary: "主基準",
    name: "名称",
    height: (name) => `${name} の高さ`,
    width: "幅",
    depth: "奥行",
    auto: "自動",
    mode: "範囲",
    area: "範囲指定",
    cont: "連続",
    reset: "図面に合わせ直す",
    add: "基準面を追加",
    remove: "この基準面を削除",
    done: "完了",
    note: (name) => `配管の EL は ${name} からの高さです。`,
    noteOther: "参照レベルのみ。",
  },
};

// Numbers keep local text so an empty field stays empty while you retype.
function NumberRow({ label, value, step, min, placeholder, onCommit, suffix = "mm" }) {
  const [text, setText] = useState(String(value ?? ""));
  useEffect(() => { setText(value ? String(value) : ""); }, [value]);
  return (
    <div className="sheet-row">
      <span>{label}</span>
      <input
        type="number"
        step={step}
        min={min}
        placeholder={placeholder}
        value={text}
        onFocus={(e) => e.target.select()}
        onChange={(e) => {
          setText(e.target.value);
          if (e.target.value.trim() !== "") onCommit(Number(e.target.value) || 0);
        }}
        onBlur={() => { if (text.trim() === "") onCommit(0); }}
      />
      <span>{suffix}</span>
    </div>
  );
}

export default function GlSheet({
  datums, index, lang, onChange, onSelect, onAdd, onRemove, onRefit, onClose,
}) {
  const t = TEXT[lang === "jp" ? "jp" : "en"];
  const plane = datums[index] ?? datums[0];
  const isPrimary = index === 0;

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-scroll">
          <div className="sheet-handle" />
          <div className="sheet-title">{t.title}</div>

          {/* every datum on the job, tap to edit */}
          <div className="datum-tabs">
            {datums.map((item, i) => (
              <button
                key={item.id}
                className={"datum-tab" + (i === index ? " on" : "")}
                onClick={() => onSelect(i)}
              >
                {item.name}
                <span className="datum-el">{item.offsetMm >= 0 ? `+${item.offsetMm}` : item.offsetMm}</span>
              </button>
            ))}
            <button className="datum-tab add" onClick={onAdd}>＋</button>
          </div>

          <div className="sheet-row">
            <span>{t.name}</span>
            <div className="seg-group">
              {DATUM_NAMES.map((item) => (
                <button
                  key={item}
                  className={"seg-btn" + (plane.name === item ? " on" : "")}
                  onClick={() => onChange({ name: item })}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <NumberRow
            label={t.height(plane.name)}
            value={plane.offsetMm}
            step="100"
            onCommit={(v) => onChange({ offsetMm: v })}
          />
          <div className="sheet-hint">
            {isPrimary ? `${t.note(plane.name)} (${t.primary})` : t.noteOther}
          </div>

          <div className="sheet-row">
            <span>{t.mode}</span>
            <div className="seg-group">
              <button
                className={"seg-btn" + (plane.continuous ? "" : " on")}
                onClick={() => onChange({ continuous: false })}
              >
                {t.area}
              </button>
              <button
                className={"seg-btn" + (plane.continuous ? " on" : "")}
                onClick={() => onChange({ continuous: true })}
              >
                {t.cont}
              </button>
            </div>
          </div>

          {!plane.continuous && (
            <>
              <NumberRow
                label={t.width}
                value={plane.sizeMm}
                step="500"
                min="0"
                placeholder={t.auto}
                onCommit={(v) => onChange({ sizeMm: Math.max(0, v), fitted: true })}
              />
              <NumberRow
                label={t.depth}
                value={plane.sizeVMm}
                step="500"
                min="0"
                placeholder={t.auto}
                onCommit={(v) => onChange({ sizeVMm: Math.max(0, v), fitted: true })}
              />
              <button className="sheet-btn" onClick={onRefit}>{t.reset}</button>
            </>
          )}

          {datums.length > 1 && (
            <button className="sheet-btn danger" onClick={onRemove}>{t.remove}</button>
          )}
        </div>

        <div className="sheet-actions">
          <button className="sheet-action ghost" onClick={onAdd}>{t.add}</button>
          <button className="sheet-action solid" onClick={onClose}>{t.done}</button>
        </div>
      </div>
    </div>
  );
}
