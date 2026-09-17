const DEFAULTS = {
  enabled: true,
  darkness: 50
};

const enabledEl = document.getElementById("enabled");
const darknessEl = document.getElementById("darkness");
const darknessValEl = document.getElementById("darkness-val");
const resetEl = document.getElementById("reset");

function render(settings) {
  enabledEl.checked = settings.enabled;
  darknessEl.value = settings.darkness;
  darknessValEl.textContent = settings.darkness + "%";
}

chrome.storage.sync.get(DEFAULTS, render);

function save(partial) {
  chrome.storage.sync.get(DEFAULTS, (current) => {
    chrome.storage.sync.set({ ...current, ...partial });
  });
}

enabledEl.addEventListener("change", () => {
  save({ enabled: enabledEl.checked });
});

darknessEl.addEventListener("input", () => {
  darknessValEl.textContent = darknessEl.value + "%";
});

darknessEl.addEventListener("change", () => {
  save({ darkness: Number(darknessEl.value) });
});

resetEl.addEventListener("click", () => {
  darknessEl.value = DEFAULTS.darkness;
  darknessValEl.textContent = DEFAULTS.darkness + "%";
  save({ darkness: DEFAULTS.darkness });
});
