const DEFAULTS = {
  enabled: true,
  contrast: 90,
  brightness: 100
};

const enabledEl = document.getElementById("enabled");
const contrastEl = document.getElementById("contrast");
const brightnessEl = document.getElementById("brightness");
const contrastValEl = document.getElementById("contrast-val");
const brightnessValEl = document.getElementById("brightness-val");

function render(settings) {
  enabledEl.checked = settings.enabled;
  contrastEl.value = settings.contrast;
  brightnessEl.value = settings.brightness;
  contrastValEl.textContent = settings.contrast + "%";
  brightnessValEl.textContent = settings.brightness + "%";
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

contrastEl.addEventListener("input", () => {
  contrastValEl.textContent = contrastEl.value + "%";
  save({ contrast: Number(contrastEl.value) });
});

brightnessEl.addEventListener("input", () => {
  brightnessValEl.textContent = brightnessEl.value + "%";
  save({ brightness: Number(brightnessEl.value) });
});
