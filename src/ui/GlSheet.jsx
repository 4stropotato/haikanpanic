// v2.19 Datum editor. A site has several levels, so this edits one plane out
// of a list and can add or remove them. Every control applies as you touch
// it — nothing waits on an Apply press. Number fields keep their own text
// while you type, so clearing a field to retype it cannot snap back.
import { useEffect, useState } from "react";
import { DATUM_NAMES, WALL_NAMES, CEILING_NAMES } from "../workspace/utils/datums";

const TEXT = {
  en: {
    title: "Datums",
    primary: "primary",
    name: "Name",
    colour: "Colour",
    kind: "Surface",
    rename: "Label",
    floor: "Floor",
    wall: "Wall",
    ceiling: "Ceiling",
    facing: "Runs along",
    stands: "Held by",
    free: "Free",
    bottom: "Bottom",
    top: "Top",
    bottomAt: "Bottom at",
    topAt: "Top at",
    offsetWall: (name) => `${name} distance`,
    wallNote: "A wall stands up. Its offset is how far it sits from the drawing,"
      + " and its depth becomes its height.",
    height: (name) => `${name} elevation`,
    width: "Width",
    depth: "Depth",
    wallHeight: "Height",
    auto: "auto",
    mode: "Extent",
    area: "Area",
    cont: "Continuous",
    reset: "Refit size to drawing",
    add: "Add datum",
    makePrimary: "Measure EL from this datum",
    remove: "Delete this datum",
    done: "Done",
    note: (name) => `Pipe elevations are measured from ${name}.`,
    noteOther: "Reference level only.",
  },
  jp: {
    title: "基準面",
    primary: "主基準",
    name: "名称",
    colour: "色",
    kind: "面の種類",
    rename: "表示名",
    floor: "床",
    wall: "壁",
    ceiling: "天井",
    facing: "方向",
    stands: "固定",
    free: "自由",
    bottom: "下端",
    top: "上端",
    bottomAt: "下端の高さ",
    topAt: "上端の高さ",
    offsetWall: (name) => `${name} の離れ`,
    wallNote: "壁は立ちます。オフセットは図面からの離れ、奥行は高さになります。",
    height: (name) => `${name} の高さ`,
    width: "幅",
    depth: "奥行",
    wallHeight: "高さ",
    auto: "自動",
    mode: "範囲",
    area: "範囲指定",
    cont: "連続",
    reset: "図面に合わせ直す",
    add: "基準面を追加",
    makePrimary: "この基準面から EL を測る",
    remove: "この基準面を削除",
    done: "完了",
    note: (name) => `配管の EL は ${name} からの高さです。`,
    noteOther: "参照レベルのみ。",
  },
};

// Numbers keep local text so an empty field stays empty while you retype.
function NumberRow({ label, value, step, min, placeholder, onCommit, suffix = "mm", zeroIsValue = false }) {
  const show = (v) => (zeroIsValue || v ? String(v ?? "") : "");
  const [text, setText] = useState(show(value));
  useEffect(() => { setText(show(value)); }, [value, zeroIsValue]);
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

// v3.04 Turning a floor into a wall left a wall still called GL, which read
// as a bug — the name follows the surface unless it has been typed by hand.
const NAMES_FOR = { floor: DATUM_NAMES, wall: WALL_NAMES, ceiling: CEILING_NAMES };
function renameFor(kind, current) {
  const known = [...DATUM_NAMES, ...WALL_NAMES, ...CEILING_NAMES];
  if (!known.includes(current)) return {};              // a typed name is the fitter's
  return { name: NAMES_FOR[kind][0] };
}

export default function GlSheet({
  datums, index, lang, onChange, onSelect, onAdd, onRemove, onRefit, onMakePrimary, onClose,
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
              {(plane.kind === "wall" ? WALL_NAMES
                : plane.kind === "ceiling" ? CEILING_NAMES : DATUM_NAMES).map((item) => (
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

          {/* v3.00 A job with a 1FL and a 2FL, or three walls, cannot be
              described by four fixed names — so the name can be typed. */}
          <div className="sheet-row">
            <span>{t.rename}</span>
            <input
              type="text"
              maxLength={10}
              value={plane.name}
              onFocus={(e) => e.target.select()}
              onChange={(e) => onChange({ name: e.target.value })}
            />
          </div>

          <div className="sheet-row">
            <span>{t.kind}</span>
            <div className="seg-group">
              <button
                className={"seg-btn" + ((plane.kind ?? "floor") === "floor" ? " on" : "")}
                onClick={() => onChange({ kind: "floor", ...renameFor("floor", plane.name) })}
              >
                {t.floor}
              </button>
              <button
                className={"seg-btn" + (plane.kind === "wall" ? " on" : "")}
                onClick={() => onChange({ kind: "wall", ...renameFor("wall", plane.name) })}
              >
                {t.wall}
              </button>
              <button
                className={"seg-btn" + (plane.kind === "ceiling" ? " on" : "")}
                onClick={() => onChange({ kind: "ceiling", ...renameFor("ceiling", plane.name) })}
              >
                {t.ceiling}
              </button>
            </div>
          </div>
          {plane.kind === "wall" && (
            <>
              <div className="sheet-row">
                <span>{t.facing}</span>
                <div className="seg-group">
                  {["u", "v"].map((dir) => (
                    <button
                      key={dir}
                      className={"seg-btn" + ((plane.facing ?? "u") === dir ? " on" : "")}
                      onClick={() => onChange({ facing: dir })}
                    >
                      {dir === "u" ? "◤" : "◥"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="sheet-row">
                <span>{t.stands}</span>
                <div className="seg-group">
                  {["free", "bottom", "top"].map((mode) => (
                    <button
                      key={mode}
                      className={"seg-btn" + ((plane.vAnchor ?? "free") === mode ? " on" : "")}
                      onClick={() => onChange({ vAnchor: mode })}
                    >
                      {t[mode]}
                    </button>
                  ))}
                </div>
              </div>
              {(plane.vAnchor ?? "free") !== "free" && (
                <NumberRow
                  label={plane.vAnchor === "top" ? t.topAt : t.bottomAt}
                  value={plane.vMm}
                  step="100"
                  zeroIsValue
                  onCommit={(v) => onChange({ vMm: v })}
                />
              )}
              <div className="sheet-hint">{t.wallNote}</div>
            </>
          )}

          <div className="sheet-row">
            <span>{t.colour}</span>
            <input
              type="color"
              className="tone-pick"
              aria-label={t.colour}
              value={plane.color ?? (index === 0 ? "#f5ba66" : "#7cc4ff")}
              onChange={(e) => onChange({ color: e.target.value })}
            />
          </div>

          <NumberRow
            label={plane.kind === "wall" ? t.offsetWall(plane.name) : t.height(plane.name)}
            value={plane.offsetMm}
            step="100"
            zeroIsValue
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
                label={plane.kind === "wall" ? t.wallHeight : t.depth}
                value={plane.sizeVMm}
                step="500"
                min="0"
                placeholder={t.auto}
                onCommit={(v) => onChange({ sizeVMm: Math.max(0, v), fitted: true })}
              />
              <button className="sheet-btn" onClick={onRefit}>{t.reset}</button>
            </>
          )}

          {!isPrimary && (
            <button className="sheet-btn" onClick={onMakePrimary}>{t.makePrimary}</button>
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
