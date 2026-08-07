// v2.51 What a run's label says is the fitter's choice: a busy sketch reads
// better with size alone, a fabrication print wants schedule and elevation.
// where a label sits when nobody has moved it: clear of the run, above it
export const LABEL_HOME = { along: 0, across: -13 };

export const LABEL_FIELDS = ["length", "size", "sch", "joint", "angle", "rise", "el"];

// v3.03 A new sketch says nothing until the fitter asks it to. Drawing is
// the whole of the app at its simplest; every annotation is opt-in, and once
// switched on it stays on.
export const LABEL_DEFAULT = {
  length: false, size: false, sch: false, joint: false, angle: false, rise: false, el: false,
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

// v2.99 Presets. What a label should say changes with what the drawing is
// for — a quick field sketch wants the size and nothing else, a fabrication
// print wants all of it — so the common sets are one tap rather than seven.
export const LABEL_PRESETS = {
  none: { length: false, size: false, sch: false, joint: false, angle: false, rise: false, el: false },
  size: { length: false, size: true, sch: false, joint: false, angle: false, rise: false, el: false },
  standard: { length: true, size: true, sch: false, joint: false, angle: true, rise: true, el: false },
  full: { length: true, size: true, sch: true, joint: true, angle: true, rise: true, el: true },
};

export const PRESET_TEXT = {
  en: { none: "None", size: "Size only", standard: "Standard", full: "Everything" },
  jp: { none: "なし", size: "呼び径のみ", standard: "標準", full: "全部" },
};

export function presetOf(fields) {
  for (const [name, set] of Object.entries(LABEL_PRESETS)) {
    if (LABEL_FIELDS.every((f) => !!fields[f] === !!set[f])) return name;
  }
  return null;
}
