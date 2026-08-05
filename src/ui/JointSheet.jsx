// v2.20 Corner fitting picker. Tap a joint and say what it actually is —
// long or short elbow, a cut-down elbow, チーズ, a wye, or a plain mitered
// weld. The take-out can be overridden for the specials a tight gemba
// forces on you, and the choice can always be handed back to the default.
import { useEffect, useState } from "react";
import { JOINT_TYPES, JOINT_LABEL, JOINT_MARK } from "../workspace/utils/joints";
import { elbowRadius } from "../workspace/workshop/pipe3d";
import { teeCentreToEnd, wyeCentreToEnd } from "../workspace/data/jis";

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
  },
};

// Standard take-out for a type, used as the placeholder when not overridden.
export function standardTakeout(type, nominalA) {
  if (type === "weld") return 0;
  if (type === "tee") return Math.round(teeCentreToEnd(nominalA));
  if (type === "wye") return Math.round(wyeCentreToEnd(nominalA));
  const lr = elbowRadius(nominalA, type === "elbowSR" ? "elbowSR" : "elbowLR");
  return Math.round(type === "elbowCut" ? lr / 2 : lr);
}

export default function JointSheet({ nominalA, setting, lang, onChange, onReset, onClose }) {
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

          {JOINT_TYPES.map((item) => (
            <button
              key={item}
              className={"joint-option" + (type === item ? " on" : "")}
              onClick={() => onChange({ type: item, takeoutMm: setting?.takeoutMm })}
            >
              <span className="joint-mark">{JOINT_MARK[item]}</span>
              <span className="joint-name">{labels[item]}</span>
              <span className="joint-take">
                {item === "weld" ? t.none : `${t.takeout} ${standardTakeout(item, nominalA)}mm`}
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
                  placeholder={`${standardTakeout(type, nominalA)} (${t.standard})`}
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
            </>
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
