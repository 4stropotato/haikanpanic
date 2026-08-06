// v2.83 A drawing marks up what is being done to each run: red for what
// comes out, green for what goes in. That is how the job is read on site,
// so it belongs on the line itself rather than in a legend.
export const TONES = ["none", "new", "strip", "existing"];

export const TONE_COLOR = {
  new: "#5fd08a",
  strip: "#ff6b6b",
  existing: "#8b98a8",
};

export const TONE_TEXT = {
  en: { none: "Default", new: "New", strip: "Remove", existing: "Existing" },
  jp: { none: "既定", new: "新設", strip: "撤去", existing: "既設" },
};

export function toneColor(tone, isDark) {
  return TONE_COLOR[tone] ?? (isDark ? "white" : "black");
}
