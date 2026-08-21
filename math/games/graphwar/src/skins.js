// Dummy placeholder catalog — no real art assets yet (per README's own
// note that sprite art was never ported; soldiers/obstacles are plain
// shapes). Cosmetic only: a skin picks a fill color for the soldier and a
// stroke color for its fired-shot trajectory, layered on top of (not
// replacing) the team color already used to tell sides apart. Swap this
// file's contents for a real catalog once actual art/packages exist —
// nothing else needs to change, callers just read `.color`.
export const SOLDIER_SKINS = [
  { id: "default", label: "Default", color: null }, // null = fall back to the plain team color
  { id: "gold", label: "Gold", color: "#e8b923" },
  { id: "violet", label: "Violet", color: "#9b59d0" },
  { id: "teal", label: "Teal", color: "#1abc9c" },
];

export const ARTILLERY_SKINS = [
  { id: "default", label: "Default", color: null },
  { id: "ember", label: "Ember", color: "#ff5722" },
  { id: "frost", label: "Frost", color: "#4fc3f7" },
  { id: "toxic", label: "Toxic", color: "#8bc34a" },
];

const STORAGE_KEY_SOLDIER = "graphwar.skin.soldier";
const STORAGE_KEY_ARTILLERY = "graphwar.skin.artillery";

function getSkin(catalog, storageKey) {
  let id = null;
  try {
    id = localStorage.getItem(storageKey);
  } catch {
    // localStorage can throw (private browsing, blocked storage) — fall back to default.
  }
  return catalog.find((skin) => skin.id === id) ?? catalog[0];
}

function setSkin(storageKey, id) {
  try {
    localStorage.setItem(storageKey, id);
  } catch {
    // Non-fatal — the picker just won't persist across reloads for this viewer.
  }
}

export function getSoldierSkin() {
  return getSkin(SOLDIER_SKINS, STORAGE_KEY_SOLDIER);
}

export function setSoldierSkin(id) {
  setSkin(STORAGE_KEY_SOLDIER, id);
}

export function getArtillerySkin() {
  return getSkin(ARTILLERY_SKINS, STORAGE_KEY_ARTILLERY);
}

export function setArtillerySkin(id) {
  setSkin(STORAGE_KEY_ARTILLERY, id);
}
