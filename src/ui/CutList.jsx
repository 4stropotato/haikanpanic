// v2.07 材料表 / cut list — every pipe in the sketch with its true cut
// length (centre length minus fitting take-outs minus 裏波 root gaps), plus
// totals per size and a fitting count. This is the sheet you carry to the saw.
import { buildPipeModel } from "../workspace/workshop/pipe3d";
import { material as materialOf } from "../workspace/data/jis";

const TEXT = {
  en: {
    title: "Cut list",
    empty: "Draw something first.",
    no: "#", size: "Size", spec: "Spec", center: "Centre", cut: "CUT", kg: "kg",
    totals: "Totals by size", fittings: "Fittings", weight: "Total weight",
    elbow: "elbow", reducer: "reducer", flange: "flange", tee: "tee",
    note: "Cut = centre length − fitting take-out − root gaps",
    close: "Close", copy: "Copy",
  },
  jp: {
    title: "材料表",
    empty: "先に描いてください。",
    no: "番", size: "呼び径", spec: "材質", center: "芯々", cut: "切断", kg: "kg",
    totals: "呼び径別 合計", fittings: "継手", weight: "総重量",
    elbow: "エルボ", reducer: "レジューサ", flange: "フランジ", tee: "チーズ",
    note: "切断長 = 芯々 − 継手の取り代 − ルートギャップ",
    close: "閉じる", copy: "コピー",
  },
};

export default function CutList({ lines, mmPerPoint, jointTypes = {}, lang, onClose }) {
  const t = TEXT[lang === "jp" ? "jp" : "en"];
  const model = buildPipeModel(lines, mmPerPoint, { jointTypes });
  const runs = model.runs;

  const totals = new Map();
  let totalWeight = 0;
  for (const run of runs) {
    const key = `${run.nominalA ?? "?"}A ${specLabel(run)}`;
    const weight = run.kgm ? (run.kgm * run.cutLengthMm) / 1000 : 0;
    totalWeight += weight;
    const entry = totals.get(key) ?? { count: 0, mm: 0, kg: 0 };
    entry.count += 1;
    entry.mm += run.cutLengthMm;
    entry.kg += weight;
    totals.set(key, entry);
  }

  const fittings = [];
  const elbowsBySize = new Map();
  for (const elbow of model.elbows) {
    const key = `${elbow.od}|${elbow.kind === "elbowSR" ? "SR" : "LR"}`;
    elbowsBySize.set(key, (elbowsBySize.get(key) ?? 0) + 1);
  }
  for (const [key, count] of elbowsBySize) {
    const [odKey, kind] = key.split("|");
    fittings.push(`${count} × ${t.elbow} ${kind} ${elbow90Label(Number(odKey))}`);
  }
  for (const [size, count] of countBy(model.tees, (tee) => tee.nominalA)) {
    fittings.push(`${count} × ${t.tee} ${size}A`);
  }
  if (model.reducers.length) fittings.push(`${model.reducers.length} × ${t.reducer}`);
  for (const [size, count] of countBy(model.flanges, (f) => f.nominalA)) {
    fittings.push(`${count} × ${t.flange} ${size}A 10K`);
  }

  const copyText = () => {
    const rows = runs.map((run, index) => (
      `${index + 1}\t${run.nominalA}A\t${run.materialId} ${run.schedule}`
      + `\t${run.lengthMm}\t${run.cutLengthMm}`
    ));
    navigator.clipboard?.writeText(
      [`${t.no}\t${t.size}\t${t.spec}\t${t.center}\t${t.cut}`, ...rows].join("\n"),
    );
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet cutlist" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-scroll">
        <div className="sheet-handle" />
        <div className="sheet-title">{t.title}</div>

        {runs.length === 0 ? (
          <div className="sheet-hint">{t.empty}</div>
        ) : (
          <>
            <table className="cut-table">
              <thead>
                <tr>
                  <th>{t.no}</th><th>{t.size}</th><th>{t.spec}</th>
                  <th className="num">{t.center}</th><th className="num">{t.cut}</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run, index) => (
                  <tr key={run.lineIndex}>
                    <td>{index + 1}</td>
                    <td>{run.nominalA}A</td>
                    <td className="dim">
                      {run.materialId}
                      <br />
                      <span className="sub">
                        {run.schedule === run.materialId ? `t${run.wall}` : `${run.schedule} · t${run.wall}`}
                      </span>
                    </td>
                    <td className="num dim">{run.lengthMm}</td>
                    <td className="num strong">{run.cutLengthMm}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="sheet-hint">{t.note}</div>

            <div className="cut-section">{t.totals}</div>
            {[...totals].map(([key, entry]) => (
              <div className="cut-total" key={key}>
                <span>{key}</span>
                <span>{entry.count} pcs · {Math.round(entry.mm)}mm · {entry.kg.toFixed(1)}kg</span>
              </div>
            ))}
            <div className="cut-total strong">
              <span>{t.weight}</span>
              <span>{totalWeight.toFixed(1)} kg</span>
            </div>

            {fittings.length > 0 && (
              <>
                <div className="cut-section">{t.fittings}</div>
                {fittings.map((item) => (
                  <div className="cut-total" key={item}><span>{item}</span></div>
                ))}
              </>
            )}
          </>
        )}

        </div>

        <div className="sheet-actions">
          <button className="sheet-action ghost" onClick={onClose}>{t.close}</button>
          <button className="sheet-action solid" onClick={copyText}>{t.copy}</button>
        </div>
      </div>
    </div>
  );
}

function countBy(items, pick) {
  const map = new Map();
  for (const item of items) {
    const key = pick(item);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}

// Schedule repeats the material name for SGP; say it once.
function specLabel(run) {
  return run.schedule === run.materialId ? run.materialId : `${run.materialId} ${run.schedule}`;
}

// Elbows are keyed by outside diameter; show the nominal size the fitter uses.
function elbow90Label(od) {
  const table = {
    21.7: "15A", 27.2: "20A", 34: "25A", 42.7: "32A", 48.6: "40A", 60.5: "50A",
    76.3: "65A", 89.1: "80A", 101.6: "90A", 114.3: "100A", 139.8: "125A",
    165.2: "150A", 216.3: "200A", 267.4: "250A", 318.5: "300A", 355.6: "350A",
    406.4: "400A", 457.2: "450A", 508: "500A",
  };
  if (table[od]) return table[od];
  const near = Object.keys(table).find((key) => Math.abs(Number(key) - od) < 0.6);
  return near ? table[near] : `${od}mm`;
}
