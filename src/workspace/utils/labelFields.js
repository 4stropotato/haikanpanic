// v2.51 What a run's label says is the fitter's choice: a busy sketch reads
// better with size alone, a fabrication print wants schedule and elevation.
// where a label sits when nobody has moved it: clear of the run, above it
export const LABEL_HOME = { along: 0, across: -13 };

export const LABEL_FIELDS = ["length", "size", "sch", "joint", "angle", "rise", "el"];

export const LABEL_DEFAULT = {
  length: true, size: true, sch: false, joint: false, angle: true, rise: true, el: false,
};

export const LABEL_TEXT = {
  en: { length: "Length", size: "Size", sch: "Schedule", joint: "Joint", angle: "Angle", rise: "Rise ↑", el: "EL" },
  jp: { length: "長さ", size: "呼び径", sch: "スケジュール", joint: "継手", angle: "角度", rise: "立上り ↑", el: "EL" },
};

export function loadLabelFields() {
  try {
    const saved = JSON.parse(localStorage.getItem("haikan-label-fields"));
    if (saved && typeof saved === "object") return { ...LABEL_DEFAULT, ...saved };
  } catch { /* first run, or a stale value — the default is always valid */ }
  return { ...LABEL_DEFAULT };
}
