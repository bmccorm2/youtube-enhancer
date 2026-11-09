"use strict";

const api = globalThis.browser ?? globalThis.chrome;

const FIELDS = {
  defaultSpeed: { min: 0.5, max: 3, def: 2 },
  step: { min: 0.05, max: 1, def: 0.25 },
};
const DEFAULTS = Object.fromEntries(Object.entries(FIELDS).map(([k, f]) => [k, f.def]));

const status = document.getElementById("status");
let statusTimer;

function sanitize(key, raw) {
  const { min, max, def } = FIELDS[key];
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) return def;
  return Math.round(Math.min(max, Math.max(min, n)) * 100) / 100;
}

api.storage.sync.get(DEFAULTS).then((s) => {
  for (const key of Object.keys(FIELDS)) {
    const input = document.getElementById(key);
    input.value = s[key];
    input.addEventListener("change", async () => {
      const value = sanitize(key, input.value);
      input.value = value;
      await api.storage.sync.set({ [key]: value });
      status.textContent = "Saved";
      clearTimeout(statusTimer);
      statusTimer = setTimeout(() => (status.textContent = ""), 1200);
    });
  }
});
