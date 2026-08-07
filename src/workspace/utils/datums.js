// v2.19 Datum planes. A job rarely has one level: GL outside, FL per floor,
// TOS on a platform. Each plane carries its own name, elevation, footprint
// and position. The first entry is the primary datum — pipe elevations are
// measured from it and Workshop stands the model on it.
// v3.00 Names follow the surface. GL and FL name floors; a wall wants its
// own — and a job with several of either needs to write its own name, which
// is why the sheet lets you type one.
export const WALL_NAMES = ["W1", "W2", "W3", "壁"];

export const DATUM_NAMES = ["GL", "FL", "TOS", "BOP"];

export function makeDatum(name = "GL", offsetMm = 0) {
  return {
    id: `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name,
    offsetMm,
    sizeMm: 0,
    sizeVMm: 0,
    center: null,
    continuous: false,
    // v2.98 A datum is a surface, not only a floor: "floor" lies flat and is
    // measured by height, "wall" stands up and is measured by how far it
    // sits along the ground axis it does not run along.
    kind: "floor",
    facing: "u",
    // false until the footprint has been fitted to the sketch once; after
    // that the plane holds its size so drawing never moves the ground
    fitted: false,
  };
}

export function loadDatums() {
  try {
    const stored = JSON.parse(localStorage.getItem("haikan-datums-v1"));
    if (Array.isArray(stored) && stored.length) return stored;
  } catch { /* fall through to migration */ }

  // migrate the single-plane settings this replaced
  const legacy = makeDatum(localStorage.getItem("haikan-gl-name") || "GL");
  const num = (key) => {
    const value = Number(localStorage.getItem(key));
    return Number.isFinite(value) ? value : 0;
  };
  legacy.offsetMm = num("haikan-gl-offset");
  legacy.sizeMm = num("haikan-gl-size");
  legacy.sizeVMm = num("haikan-gl-sizev");
  legacy.continuous = localStorage.getItem("haikan-gl-mode") === "continuous";
  legacy.fitted = legacy.sizeMm > 0;
  return [legacy];
}

export function saveDatums(datums) {
  localStorage.setItem("haikan-datums-v1", JSON.stringify(datums));
}

// v2.38 The datum an elevation is quoted against: the highest one at or
// below it, or the lowest one above if the level sits under them all.
export function datumFor(elevationMm, datums) {
  if (!datums?.length) return { name: "GL", offsetMm: 0 };
  const below = datums
    .filter((d) => d.offsetMm <= elevationMm)
    .sort((a, b) => b.offsetMm - a.offsetMm)[0];
  if (below) return below;
  return [...datums].sort((a, b) => a.offsetMm - b.offsetMm)[0];
}
