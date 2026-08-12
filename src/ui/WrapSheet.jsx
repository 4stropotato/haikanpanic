// v4.43 展開 / Wrap — an angled cut on a round pipe, printed 1:1 on A3.
//
// It lives inside Draw because it is not a different app: the pipe, its size
// and its angle are already on the sketch. Opening a separate tool and typing
// the same numbers again is how a wrong diameter gets used.
//
// Nothing is drawn until Print is pressed. The paper is five A3 sheets of
// millimetre-accurate SVG, which is not something to keep in memory while
// somebody is deciding on an angle — it is built, printed, and thrown away.
import { useMemo, useState } from "react";
import { pipeSpec } from "../workspace/data/jis";

const TEXT = {
  en: {
    title: "Wrap", sub: "An angled cut, printed 1:1 on A3.",
    od: "Outside diameter", circ: "Circumference",
    byAngle: "By angle", byEnds: "By two measurements",
    angle: "Cut angle from square", longest: "Longest, from the pipe end",
    shortest: "Shortest, from the pipe end",
    outLong: "Longest", outShort: "Shortest", diff: "Difference",
    cutAngle: "Cut angle", lowAt: "Shortest sits at", around: "around",
    from: "From the end", arc: "Around",
    print: "Print the template", done: "Done",
    sheets: "sheets of A3", tip:
      "Set the print scale to 100% or Actual size — never Fit to page. "
      + "Every sheet carries a 100 mm bar: measure it before cutting. If it is "
      + "not 100 mm the print is scaled and nothing on it can be trusted.",
    lineUp: "line this edge up with the end of the pipe",
    check: "measure this: it must be exactly 100 mm, or the print is scaled",
    next: "next sheet starts here — overlap and tape",
    sheet: "sheet", of: "of",
  },
  jp: {
    title: "展開", sub: "斜め切り、A3に原寸で印刷。",
    od: "外径", circ: "円周",
    byAngle: "角度から", byEnds: "実測2点から",
    angle: "直角からの切り角", longest: "最長（管端から）",
    shortest: "最短（管端から）",
    outLong: "最長", outShort: "最短", diff: "差",
    cutAngle: "切り角", lowAt: "最短の位置", around: "周",
    from: "管端から", arc: "周",
    print: "型紙を印刷", done: "完了",
    sheets: "枚（A3）", tip:
      "印刷倍率は100%（原寸）に。用紙に合わせるは不可。各シートの100mmバーを"
      + "必ず実測してください。100mmでなければ縮尺がかかっています。",
    lineUp: "この辺を管端に合わせる",
    check: "ここを実測：ちょうど100mmでなければ縮尺がかかっている",
    next: "次のシートはここから — 重ねて貼る",
    sheet: "シート", of: "/",
  },
};

const SHEET_W = 420;   // A3 landscape, mm
const SHEET_H = 297;
const TAB = 20;        // glue tab carried onto the next sheet
const BASE_Y = 268;    // the pipe-end line, mm from the top of the sheet

export default function WrapSheet({ onClose, lang = "en", spec = null }) {
  const t = TEXT[lang] ?? TEXT.en;
  const seed = pipeSpec(spec?.a ?? 100)?.od ?? 114.3;

  const [od, setOd] = useState(seed);
  const [mode, setMode] = useState("angle");
  const [angle, setAngle] = useState(45);
  // a first guess that is a real cut rather than a degenerate one: at 45 the
  // rise is a whole diameter, so a longest of one and a half leaves something
  // on the short side to measure
  const [longest, setLongest] = useState(Math.round(seed * 1.5));
  const [shortest, setShortest] = useState(Math.round(seed * 0.5));

  const m = useMemo(() => {
    const C = Math.PI * (Number(od) || 0);
    const R = C / (2 * Math.PI);
    const peak = mode === "angle"
      ? R * Math.tan(((Number(angle) || 0) * Math.PI) / 180)
      : ((Number(longest) || 0) - (Number(shortest) || 0)) / 2;
    const long = Number(longest) || 0;
    const mid = long - peak;
    return {
      C, R, peak, long, mid,
      short: long - (2 * peak),
      deg: (Math.atan(peak / (R || 1)) * 180) / Math.PI,
      at: (arc) => mid + (peak * Math.cos((2 * Math.PI * arc) / (C || 1))),
      sheets: C > 0 ? Math.ceil(C / (SHEET_W - TAB)) : 0,
    };
  }, [od, mode, angle, longest, shortest]);

  const stations = useMemo(() => {
    if (!(m.C > 0)) return [];
    const out = [];
    for (let a = 0; a <= m.C; a += 100) out.push([a, m.at(a)]);
    out.push([m.C, m.at(m.C)]);
    return out;
  }, [m]);

  // built only when asked for, and taken away again the moment printing ends
  const print = () => {
    const host = document.createElement("div");
    host.className = "wrap-paper";
    host.innerHTML = paper(m, t, Number(od));
    document.body.appendChild(host);
    document.body.classList.add("printing-wrap");
    const clean = () => {
      document.body.classList.remove("printing-wrap");
      host.remove();
      window.removeEventListener("afterprint", clean);
    };
    window.addEventListener("afterprint", clean);
    window.print();
    setTimeout(clean, 60000);            // in case afterprint never arrives
  };

  const num = (label, value, set, step = "0.1") => (
    <div className="sheet-row">
      <span>{label}</span>
      <input type="number" step={step} inputMode="decimal" value={value}
        onChange={(e) => set(e.target.value)} />
      <span className="unit">mm</span>
    </div>
  );

  return (
    <div className="sheet-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet">
        <div className="sheet-scroll">
          <div className="sheet-handle" />
          <h2 className="sheet-title">{t.title}</h2>
          <div className="sheet-hint">{t.sub}</div>

          {num(t.od, od, setOd, "0.001")}
          <div className="sheet-row">
            <span>{t.circ}</span>
            <input type="number" step="0.1" inputMode="decimal"
              value={m.C ? m.C.toFixed(1) : ""}
              onChange={(e) => setOd(((Number(e.target.value) || 0) / Math.PI).toFixed(3))} />
            <span className="unit">mm</span>
          </div>

          <div className="seg">
            {["angle", "ends"].map((k) => (
              <button key={k} className={"seg-btn" + (mode === k ? " on" : "")}
                onClick={() => setMode(k)}>{k === "angle" ? t.byAngle : t.byEnds}</button>
            ))}
          </div>

          {mode === "angle" && (
            <div className="sheet-row">
              <span>{t.angle}</span>
              <input type="number" step="0.0001" inputMode="decimal" value={angle}
                onChange={(e) => setAngle(e.target.value)} />
              <span className="unit">°</span>
            </div>
          )}
          {num(t.longest, longest, setLongest)}
          {mode === "ends" && num(t.shortest, shortest, setShortest)}

          <div className="sheet-group">{t.outLong}</div>
          <div className="sheet-row"><span>{t.outLong}</span><b>{m.long.toFixed(1)} mm</b></div>
          <div className="sheet-row"><span>{t.outShort}</span><b>{m.short.toFixed(1)} mm</b></div>
          <div className="sheet-row"><span>{t.diff}</span><b>{(2 * m.peak).toFixed(2)} mm</b></div>
          <div className="sheet-row"><span>{t.cutAngle}</span><b>{m.deg.toFixed(4)}°</b></div>
          <div className="sheet-row">
            <span>{t.lowAt}</span><b>{(m.C / 2).toFixed(1)} mm {t.around}</b>
          </div>

          <table className="wrap-table">
            <thead><tr><th>{t.arc}</th><th>{t.from}</th></tr></thead>
            <tbody>
              {stations.map(([a, v], i) => (
                <tr key={i}><td>{a % 1 ? a.toFixed(1) : a}</td><td>{v.toFixed(1)}</td></tr>
              ))}
            </tbody>
          </table>

          <div className="sheet-hint">{t.tip}</div>
        </div>
        <div className="btnrow">
          <button id="cancelBtn" onClick={onClose}>{t.done}</button>
          <button id="saveBtn" onClick={print} disabled={!(m.C > 0)}>
            {t.print} · {m.sheets} {t.sheets}
          </button>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ the paper
function paper(m, t, od) {
  const usable = SHEET_W - TAB;
  const n = Math.ceil(m.C / usable);
  let html = "";
  for (let s = 0; s < n; s++) {
    const from = s * usable;
    const to = Math.min(m.C, from + usable + TAB);
    html += `<div class="wrap-sheet">${sheet(m, t, od, s + 1, n, from, to)}</div>`;
  }
  return html;
}

function sheet(m, t, od, index, total, from, to) {
  const f = (v) => v.toFixed(2);
  let g = "";

  // the curve — a point every 2mm is smooth at full size and cheap to build
  let d = "";
  for (let a = from; a <= to; a += 2) d += (d ? "L" : "M") + f(a - from) + " " + f(BASE_Y - m.at(a)) + " ";
  d += "L" + f(to - from) + " " + f(BASE_Y - m.at(to));
  g += `<path d="${d}" fill="none" stroke="#000" stroke-width="0.4"/>`;

  g += `<line x1="0" y1="${BASE_Y}" x2="${f(to - from)}" y2="${BASE_Y}" stroke="#000" stroke-width="0.6"/>`;
  g += `<text x="3" y="${BASE_Y - 3}" font-size="4" font-family="sans-serif">${t.lineUp}</text>`;

  for (let a = Math.ceil(from / 10) * 10; a <= to; a += 10) {
    const x = a - from, big = a % 100 === 0, y = BASE_Y - m.at(a);
    g += `<line x1="${f(x)}" y1="${f(y)}" x2="${f(x)}" y2="${f(BASE_Y)}" stroke="#000"`
      + ` stroke-width="${big ? 0.35 : 0.15}"${big ? "" : ' stroke-dasharray="1 2"'}/>`;
    if (big) {
      g += `<text x="${f(x)}" y="${f(BASE_Y + 6)}" font-size="3.6" text-anchor="middle" font-family="sans-serif">${a}</text>`;
      g += `<text x="${f(x)}" y="${f(y - 3)}" font-size="3.6" text-anchor="middle" font-family="sans-serif">${m.at(a).toFixed(1)}</text>`;
    }
  }

  if (to - from > SHEET_W - TAB) {
    const x = SHEET_W - TAB;
    g += `<line x1="${f(x)}" y1="10" x2="${f(x)}" y2="${f(SHEET_H - 10)}" stroke="#000" stroke-width="0.3" stroke-dasharray="4 3"/>`;
    g += `<text x="${f(x + 2)}" y="18" font-size="4" font-family="sans-serif">${t.next}</text>`;
  }

  // the one mark that says whether the printer told the truth
  g += `<g transform="translate(14,${SHEET_H - 26})">`
    + `<line x1="0" y1="0" x2="100" y2="0" stroke="#000" stroke-width="0.6"/>`
    + `<line x1="0" y1="-3" x2="0" y2="3" stroke="#000" stroke-width="0.6"/>`
    + `<line x1="100" y1="-3" x2="100" y2="3" stroke="#000" stroke-width="0.6"/>`
    + `<line x1="50" y1="-2" x2="50" y2="2" stroke="#000" stroke-width="0.3"/>`
    + `<text x="0" y="8" font-size="4" font-family="sans-serif">${t.check}</text></g>`;

  g += `<text x="${SHEET_W - 14}" y="${SHEET_H - 14}" font-size="4.5" text-anchor="end" font-family="sans-serif">`
    + `${t.sheet} ${index} ${t.of} ${total} · OD ${od.toFixed(1)} · ${m.deg.toFixed(4)}° · ${from.toFixed(0)}–${to.toFixed(0)} mm</text>`;

  return `<svg viewBox="0 0 ${SHEET_W} ${SHEET_H}" width="${SHEET_W}mm" height="${SHEET_H}mm">${g}</svg>`;
}
