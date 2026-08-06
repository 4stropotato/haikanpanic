// v2.20 Corner fitting picker. Tap a joint and say what it actually is —
// long or short elbow, a cut-down elbow, チーズ, a wye, or a plain mitered
// weld. The take-out can be overridden for the specials a tight gemba
// forces on you, and the choice can always be handed back to the default.
import { useEffect, useState } from "react";
import { JOINT_TYPES, JOINT_LABEL, JOINT_MARK } from "../workspace/utils/joints";
import { elbowRadius } from "../workspace/workshop/pipe3d";
import { teeCentreToEnd, wyeCentreToEnd, REDUCER_TYPES, REDUCER_LABEL } from "../workspace/data/jis";

const TEXT = {
  en: {
    title: "Corner fitting",
    takeout: "Take-out",
    standard: "standard",
    none: "weld only",
    custom: "Custom take-out",
    reset: "Back to default",
    done: "Done",
    note: "Take-out is what comes off each pipe at this corner.",
    angle: "Angle needed",
    reducer: "Reducer",
    roll: "Roll",
    rollNote: "Rotate the fitting about the incoming pipe by this much.",
    rollFlat: "in the vertical plane — no roll",
    gapNote: (gap) => `A ${gap}mm root gap is allowed at each weld, including fitting to fitting.`,
  },
  jp: {
    title: "コーナーの継手",
    takeout: "取り代",
    standard: "標準",
    none: "溶接のみ",
    custom: "取り代を指定",
    reset: "既定に戻す",
    done: "完了",
    note: "取り代はこの角で各配管から差し引く長さです。",
    angle: "必要角度",
    reducer: "レジューサ",
    roll: "ころ（回転）",
    rollNote: "手前の配管を軸にこの角度だけ継手を回します。",
    rollFlat: "垂直面内 — ころ無し",
    gapNote: (gap) => `各溶接に ${gap}mm のルートギャップ（継手同士も含む）。`,
  },
};

// Take-out for a type at the angle the corner actually turns:
// R x tan(theta/2), which reduces to R for the usual 90 degrees.
export function standardTakeout(type, nominalA, deflectionDeg = 90) {
  if (type === "weld") return 0;
  if (type === "tee") return Math.round(teeCentreToEnd(nominalA));
  if (type === "wye") return Math.round(wyeCentreToEnd(nominalA));
  const radius = elbowRadius(nominalA, type === "elbowSR" ? "elbowSR" : "elbowLR");
  const half = (Math.max(1, Math.min(179, deflectionDeg)) / 2) * (Math.PI / 180);
  const takeout = radius * Math.tan(half);
  return Math.round(type === "elbowCut" ? takeout / 2 : takeout);
}

// Which stock fitting this angle comes from, and whether it must be cut.
export function fittingFor(deflectionDeg, lang) {
  const stock = [90, 45, 22.5, 11.25];
  const near = stock.find((angle) => Math.abs(angle - deflectionDeg) < 0.6);
  if (near) return lang === "jp" ? `${near}° 定尺` : `stock ${near}°`;
  const from = deflectionDeg > 45 ? 90 : 45;
  return lang === "jp"
    ? `${from}° を ${deflectionDeg}° に切詰`
    : `cut from ${from}° to ${deflectionDeg}°`;
}

export default function JointSheet({
  nominalA, setting, deflectionDeg = 90, rollDeg = 0, gapMm = 2, hasReducer = false,
  lang, onChange, onReset, onClose,
}) {
  const t = TEXT[lang === "jp" ? "jp" : "en"];
  const labels = JOINT_LABEL[lang === "jp" ? "jp" : "en"];
  const type = setting?.type ?? "elbowLR";
  const [text, setText] = useState(setting?.takeoutMm ? String(setting.takeoutMm) : "");
  useEffect(() => {
    setText(setting?.takeoutMm ? String(setting.takeoutMm) : "");
  }, [setting?.takeoutMm, type]);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-scroll">
          <div className="sheet-handle" />
          <div className="sheet-title">{t.title} · {nominalA}A</div>
          <div className="sheet-row">
            <span>{t.angle}</span>
            <strong className="joint-angle">{deflectionDeg}°</strong>
            <span className="joint-stock">{fittingFor(deflectionDeg, lang)}</span>
          </div>
          <div className="sheet-row">
            <span>{t.roll}</span>
            <strong className="joint-angle">{rollDeg}°</strong>
            <span className="joint-stock">{rollDeg < 0.6 ? t.rollFlat : ""}</span>
          </div>
          {rollDeg >= 0.6 && <div className="sheet-hint">{t.rollNote}</div>}

          {JOINT_TYPES.map((item) => (
            <button
              key={item}
              className={"joint-option" + (type === item ? " on" : "")}
              onClick={() => onChange({ type: item, takeoutMm: setting?.takeoutMm })}
            >
              <span className="joint-mark">{JOINT_MARK[item]}</span>
              <span className="joint-name">{labels[item]}</span>
              <span className="joint-take">
                {item === "weld"
                  ? t.none
                  : `${t.takeout} ${standardTakeout(item, nominalA, deflectionDeg)}mm`}
              </span>
            </button>
          ))}

          {type !== "weld" && (
            <>
              <div className="sheet-row">
                <span>{t.custom}</span>
                <input
                  type="number"
                  min="0"
                  step="5"
                  placeholder={`${standardTakeout(type, nominalA, deflectionDeg)} (${t.standard})`}
                  value={text}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => {
                    setText(e.target.value);
                    const value = Number(e.target.value);
                    onChange({
                      type,
                      takeoutMm: e.target.value.trim() === "" || !(value > 0) ? undefined : value,
                    });
                  }}
                />
                <span>mm</span>
              </div>
              <div className="sheet-hint">{t.note}</div>
              <div className="sheet-hint">{t.gapNote(gapMm)}</div>
            </>
          )}

          {hasReducer && (
            <div className="sheet-row">
              <span>{t.reducer}</span>
              <div className="seg-group">
                {REDUCER_TYPES.map((item) => (
                  <button
                    key={item}
                    className={"seg-btn" + ((setting?.reducer ?? "concentric") === item ? " on" : "")}
                    onClick={() => onChange({ ...setting, type, reducer: item })}
                  >
                    {REDUCER_LABEL[lang === "jp" ? "jp" : "en"][item]}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button className="sheet-btn" onClick={onReset}>{t.reset}</button>
        </div>

        <div className="sheet-actions">
          <button className="sheet-action solid" onClick={onClose}>{t.done}</button>
        </div>
      </div>
    </div>
  );
}
