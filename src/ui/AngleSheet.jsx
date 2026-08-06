// v2.43 Slope editor. A run between two levels has an angle, and a fitter
// works from that angle as often as from the rise. Setting it has to say
// which measurement is being held: the horizontal the run was drawn along,
// or the centre-to-centre length that has to be cut.
import { useState } from "react";

const TEXT = {
  en: {
    title: "Slope",
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
    title: "勾配",
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
            })}
          >
            {t.apply}
          </button>
        </div>
      </div>
    </div>
  );
}
