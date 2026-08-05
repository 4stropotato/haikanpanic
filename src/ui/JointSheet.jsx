// v2.10 Corner fitting picker: tap a joint in Edit mode and say what it
// actually is — long elbow, short elbow, チーズ, or a mitered weld. The
// choice drives the 3D body, the take-out and the cut list.
import { JOINT_TYPES, JOINT_LABEL, JOINT_MARK } from "../workspace/utils/joints";
import { elbowRadius } from "../workspace/workshop/pipe3d";
import { teeCentreToEnd } from "../workspace/data/jis";

const TEXT = {
  en: { title: "Corner fitting", takeout: "take-out", none: "weld only", cancel: "Cancel" },
  jp: { title: "コーナーの継手", takeout: "取り代", none: "溶接のみ", cancel: "キャンセル" },
};

export default function JointSheet({ nominalA, current, lang, onPick, onClose }) {
  const t = TEXT[lang === "jp" ? "jp" : "en"];
  const labels = JOINT_LABEL[lang === "jp" ? "jp" : "en"];

  const takeout = (type) => {
    if (type === "weld") return t.none;
    if (type === "tee") return `${t.takeout} ${teeCentreToEnd(nominalA)}mm`;
    return `${t.takeout} ${Math.round(elbowRadius(nominalA, type))}mm`;
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-scroll">
        <div className="sheet-handle" />
        <div className="sheet-title">{t.title} · {nominalA}A</div>
        {JOINT_TYPES.map((type) => (
          <button
            key={type}
            className={"joint-option" + (current === type ? " on" : "")}
            onClick={() => onPick(type)}
          >
            <span className="joint-mark">{JOINT_MARK[type]}</span>
            <span className="joint-name">{labels[type]}</span>
            <span className="joint-take">{takeout(type)}</span>
          </button>
        ))}
        </div>

        <div className="sheet-actions">
          <button className="sheet-action ghost" onClick={onClose}>{t.cancel}</button>
        </div>
      </div>
    </div>
  );
}
