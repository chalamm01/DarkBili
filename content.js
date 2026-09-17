(() => {
  const DEFAULTS = {
    enabled: true,
    contrast: 90,   // percent
    brightness: 100 // percent
  };

  function apply(settings) {
    const root = document.documentElement;
    if (!root) return;

    root.style.setProperty("--darkbili-contrast", settings.contrast + "%");
    root.style.setProperty("--darkbili-brightness", settings.brightness + "%");

    if (settings.enabled) {
      root.classList.add("darkbili-enabled");
    } else {
      root.classList.remove("darkbili-enabled");
    }
  }

  // Apply as early as possible to avoid a flash of the light page.
  chrome.storage.sync.get(DEFAULTS, apply);

  // React to changes made from the popup (or another tab of the same site).
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    chrome.storage.sync.get(DEFAULTS, apply);
  });
})();
