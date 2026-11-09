"use strict";

const api = globalThis.browser ?? globalThis.chrome;

// YouTube selectors (may change over time)
const VIDEO_SEL = "#movie_player video.html5-main-video";
const CONTROLS_SEL = "#movie_player .ytp-right-controls";
const ROOT_ID = "yte-speed";

const MIN = 0.5;
const MAX = 3;
const DEFAULTS = { defaultSpeed: 2, step: 0.25 };

let settings = { ...DEFAULTS };
let lastVideoId = null;
let pendingDefault = false;
let retryTimer = null;

const round2 = (r) => Math.round(r * 100) / 100;
const clamp = (r) => Math.min(MAX, Math.max(MIN, r));
const formatRate = (r) => `${round2(r)}x`;

const isWatchPage = () => location.pathname === "/watch";
const currentVideoId = () => new URLSearchParams(location.search).get("v");
const getVideo = () => document.querySelector(VIDEO_SEL);

function applyDefault() {
  const video = getVideo();
  if (video && video.playbackRate !== settings.defaultSpeed) {
    video.playbackRate = settings.defaultSpeed;
  }
}

function checkVideoChange() {
  if (!isWatchPage()) {
    lastVideoId = null;
    pendingDefault = false;
    return;
  }
  const id = currentVideoId();
  if (id !== lastVideoId) {
    lastVideoId = id;
    pendingDefault = true;
    applyDefault();
  }
}

function onMediaEvent(e) {
  if (!isWatchPage() || !pendingDefault) return;
  const video = getVideo();
  if (e.target !== video) return;
  applyDefault();
  if (e.type === "playing" && video.playbackRate === settings.defaultSpeed) {
    pendingDefault = false;
  }
}

function updateControls() {
  const root = document.getElementById(ROOT_ID);
  const video = getVideo();
  if (!root || !video) return;
  const rate = video.playbackRate;
  root.querySelector(".yte-label").textContent = formatRate(rate);
  root.querySelector(".yte-dec").disabled = rate <= MIN;
  root.querySelector(".yte-inc").disabled = rate >= MAX;
}

function makeButton(cls, text, title, dir) {
  const b = document.createElement("button");
  b.className = `ytp-button ${cls}`;
  b.textContent = text;
  b.title = title;
  b.setAttribute("aria-label", title);
  b.addEventListener("click", (e) => {
    e.stopPropagation();
    const video = getVideo();
    if (video) video.playbackRate = clamp(round2(video.playbackRate + dir * settings.step));
  });
  return b;
}

function insertControls() {
  const bar = document.querySelector(CONTROLS_SEL);
  if (!bar) return false;
  if (!document.getElementById(ROOT_ID)) {
    const root = document.createElement("div");
    root.id = ROOT_ID;
    const label = document.createElement("span");
    label.className = "yte-label";
    root.append(
      makeButton("yte-dec", "\u2212", "Slower", -1),
      label,
      makeButton("yte-inc", "+", "Faster", 1),
    );
    bar.prepend(root);
  }
  updateControls();
  return true;
}

function ensureControls() {
  clearInterval(retryTimer);
  if (!isWatchPage() || insertControls()) return;
  const started = Date.now();
  retryTimer = setInterval(() => {
    if (!isWatchPage() || insertControls() || Date.now() - started > 10000) {
      clearInterval(retryTimer);
    }
  }, 250);
}

function onNavigate() {
  checkVideoChange();
  ensureControls();
}

document.addEventListener("loadedmetadata", onMediaEvent, true);
document.addEventListener("canplay", onMediaEvent, true);
document.addEventListener("playing", onMediaEvent, true);
document.addEventListener(
  "ratechange",
  (e) => {
    if (isWatchPage() && e.target === getVideo()) updateControls();
  },
  true,
);

api.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync") return;
  for (const key of Object.keys(DEFAULTS)) {
    if (changes[key] && typeof changes[key].newValue === "number") {
      settings[key] = changes[key].newValue;
    }
  }
});

api.storage.sync
  .get(DEFAULTS)
  .then((s) => {
    settings = { ...DEFAULTS, ...s };
  })
  .catch(() => {})
  .finally(() => {
    document.addEventListener("yt-navigate-finish", onNavigate);
    onNavigate();
  });
