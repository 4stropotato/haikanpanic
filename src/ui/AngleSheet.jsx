// v2.53 Run angle editor: the rise between two levels, and the turn in plan.
// A drawing has six directions, but pipe does not — a branch that leaves at
// 45° in plan is as ordinary as one that rises, and both belong here.
// v2.43 Slope editor. A run between two levels has an angle, and a fitter
// works from that angle as often as from the rise. Setting it has to say
// which measurement is being held: the horizontal the run was drawn along,
// or the centre-to-centre length that has to be cut.
import { useState } from "react";

const TEXT = {
  en: {
    title: "Run angle",
    slope: "Rise",
    plan: "Turn in plan",
    planNote: "Swings the far end off the drawing's six directions. The length is held.",
    angle: "Angle",
    keep: "Hold",
    keepRun: "Run",
    keepLength: "Length",
    keepRunNote: "Horizontal stays; the pipe gets longer.",
    keepLengthNote: "Length stays; the run reaches less far.",
    result: "Result",
    length: "length",
    rise: "rise",
    apply: "Apply",
    cancel: "Cancel",
  },
  jp: {
    title: "配管角度",
    slope: "勾配",
    plan: "平面角",
    planNote: "図面の6方向から先端を振ります。管長はそのまま。",
    angle: "角度",
    keep: "固定",
    keepRun: "水平",
    keepLength: "管長",
    keepRunNote: "水平寸法はそのまま、管が長くなります。",
    keepLengthNote: "管長はそのまま、届く距離が短くなります。",
    result: "結果",
    length: "管長",
    rise: "上り",
    apply: "適用",
    cancel: "キャンセル",
  },
};

export default function AngleSheet({
  horizontalMm: horizontalRaw, trueLengthMm, slopeDeg, lang, onApply, onClose,
}) {
  const [planText, setPlanText] = useState("0");
  const horizontalMm = horizontalRaw > 0 ? horizontalRaw : (trueLengthMm || 1000);
  const t = TEXT[lang === "jp" ? "jp" : "en"];
  const [text, setText] = useState(String(Math.abs(slopeDeg || 0)));
  const [hold, setHold] = useState("run");

  const deg = Math.max(0, Math.min(89, Number(text) || 0));
  const rad = (deg * Math.PI) / 180;
  const held = hold === "run" ? horizontalMm : (trueLengthMm || horizontalMm);
  const nextHorizontal = hold === "run" ? horizontalMm : held * Math.cos(rad);
  const nextLength = hold === "run" ? horizontalMm / Math.cos(rad) : held;
  const nextRise = nextHorizontal * Math.tan(rad);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-scroll">
          <div className="sheet-handle" />
          <div className="sheet-title">{t.title}</div>

          <div className="sheet-title-sub">{t.slope}</div>
          <div className="sheet-row">
            <span>{t.angle}</span>
            <input
              type="number"
              step="0.5"
              min="0"
              max="89"
              value={text}
              onFocus={(e) => e.target.select()}
              onChange={(e) => setText(e.target.value)}
            />
            <span>°</span>
          </div>

          <div className="sheet-row">
            <span>{t.keep}</span>
            <div className="seg-group">
              <button
                className={"seg-btn" + (hold === "run" ? " on" : "")}
                onClick={() => setHold("run")}
              >
                {t.keepRun}
              </button>
              <button
                className={"seg-btn" + (hold === "length" ? " on" : "")}
                onClick={() => setHold("length")}
              >
                {t.keepLength}
              </button>
            </div>
          </div>
          <div className="sheet-hint">
            {hold === "run" ? t.keepRunNote : t.keepLengthNote}
          </div>

          {/* v2.53 the horizontal half of the same question */}
          <div className="sheet-title-sub">{t.plan}</div>
          <div className="sheet-row">
            <span>{t.angle}</span>
            <input
              type="number"
              step="5"
              min="-180"
              max="180"
              value={planText}
              onFocus={(e) => e.target.select()}
              onChange={(e) => setPlanText(e.target.value)}
            />
            <span>°</span>
          </div>
          <div className="sheet-row">
            <span />
            <div className="seg-group wrap">
              {[-45, -30, -15, 15, 30, 45].map((step) => (
                <button
                  key={step}
                  className="seg-btn"
                  onClick={() => setPlanText(String((Number(planText) || 0) + step))}
                >
                  {step > 0 ? `+${step}` : step}
                </button>
              ))}
            </div>
          </div>
          <div className="sheet-hint">{t.planNote}</div>

          <div className="sheet-row">
            <span>{t.result}</span>
            <strong className="ends-el">
              {t.length} {Math.round(nextLength * 10) / 10} · {t.rise} {Math.round(nextRise)}
            </strong>
          </div>
        </div>

        <div className="sheet-actions">
          <button className="sheet-action ghost" onClick={onClose}>{t.cancel}</button>
          <button
            className="sheet-action solid"
            disabled={!(nextHorizontal > 0)}
            onClick={() => onApply({
              horizontalMm: Math.max(1, Math.round(nextHorizontal)),
              riseMm: Math.round(nextRise),
              planTurnDeg: Number(planText) || 0,
            })}
          >
            {t.apply}
          </button>
        </div>
      </div>
    </div>
  );
}
