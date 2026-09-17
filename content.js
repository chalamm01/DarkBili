(() => {
  const DEFAULTS = {
    enabled: true,
    darkness: 50 // 0 = softer dark gray, 100 = near-black
  };

  const PROCESSED_ATTR = "data-darkbili";
  const SKIP_TAGS = new Set([
    "IMG", "VIDEO", "CANVAS", "IFRAME", "PICTURE", "SOURCE",
    "SCRIPT", "STYLE", "LINK", "NOSCRIPT", "BR", "HR"
  ]);
  const SVG_NS = "http://www.w3.org/2000/svg";

  let state = { ...DEFAULTS };
  let restoreMap = new WeakMap();
  let processedEls = new Set();
  let observer = null;
  let pending = new Set();
  let flushScheduled = false;

  // ---------- color helpers ----------

  function parseColor(str) {
    if (!str) return null;
    const m = str.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)/i);
    if (!m) return null;
    return {
      r: parseFloat(m[1]),
      g: parseFloat(m[2]),
      b: parseFloat(m[3]),
      a: m[4] !== undefined ? parseFloat(m[4]) : 1
    };
  }

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    const d = max - min;
    if (d !== 0) {
      s = d / (1 - Math.abs(2 * l - 1));
      switch (max) {
        case r: h = ((g - b) / d) % 6; break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h *= 60;
      if (h < 0) h += 360;
    }
    return { h, s, l };
  }

  function hslToRgb(h, s, l) {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r = 0, g = 0, b = 0;
    if (h < 60) [r, g, b] = [c, x, 0];
    else if (h < 120) [r, g, b] = [x, c, 0];
    else if (h < 180) [r, g, b] = [0, c, x];
    else if (h < 240) [r, g, b] = [0, x, c];
    else if (h < 300) [r, g, b] = [x, 0, c];
    else [r, g, b] = [c, 0, x];
    return {
      r: Math.round((r + m) * 255),
      g: Math.round((g + m) * 255),
      b: Math.round((b + m) * 255)
    };
  }

  // Recolors only the light color-stops inside a gradient string, leaving
  // other stops (e.g. a blue accent) untouched. This is how a "white
  // fading to blue" badge becomes "dark fading to blue" instead of being
  // skipped entirely or losing its blue accent.
  function recolorGradientStops(gradientStr) {
    return gradientStr.replace(/rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*(?:,\s*[\d.]+\s*)?\)/gi, (match) => {
      const c = parseColor(match);
      if (!c || c.a < 0.4) return match;
      const { h, s, l } = rgbToHsl(c.r, c.g, c.b);
      if (l <= 0.42) return match; // not a light stop, leave it (e.g. the blue)
      const targetL = darkTargetL();
      const { r, g, b } = hslToRgb(h, Math.min(s, 0.55), targetL);
      return c.a < 1 ? `rgba(${r}, ${g}, ${b}, ${c.a})` : `rgb(${r}, ${g}, ${b})`;
    });
  }

  function darkTargetL() {
    const minL = 0.05, maxL = 0.22;
    const d = Math.min(100, Math.max(0, state.darkness)) / 100;
    return maxL - d * (maxL - minL);
  }

  // ---------- element processing ----------

  function shouldSkip(el) {
    if (!el || el.nodeType !== 1) return true;
    if (SKIP_TAGS.has(el.tagName)) return true;
    if (el.namespaceURI === SVG_NS) return true;
    if (el.id && el.id.startsWith("darkbili")) return true;
    return false;
  }

  function backup(el) {
    if (!restoreMap.has(el)) restoreMap.set(el, {});
    return restoreMap.get(el);
  }

  function applyBgColor(el, b) {
    const targetL = darkTargetL();
    const { r, g, b: bl } = hslToRgb(b.origBgHsl.h, b.origBgHsl.s, targetL);
    el.style.setProperty("background-color", `rgb(${r}, ${g}, ${bl})`, "important");
  }

  // Instantly recomputes every already-darkened element's color from its
  // cached *original* value — no restore step, so nothing flashes back to
  // its original light color while this runs.
  function reapplyDarkness() {
    for (const el of processedEls) {
      const b = restoreMap.get(el);
      if (!b) continue;
      if (b.origBgHsl) applyBgColor(el, b);
      if (b.origGradient) {
        el.style.setProperty("background-image", recolorGradientStops(b.origGradient), "important");
      }
    }
  }

  function processElement(el) {
    if (shouldSkip(el)) return;
    let cs;
    try {
      cs = getComputedStyle(el);
    } catch (e) {
      return;
    }
    let touched = false;

    // Flat/solid backgrounds: darken the lightness, keep the hue.
    // Real image backgrounds (url(...) — sprites, photos) are left alone.
    // Gradient backgrounds are recolored stop-by-stop below, so a
    // blue-to-white gradient becomes blue-to-dark instead of losing the
    // blue or staying white.
    //
    // The original hue/sat (origBgHsl) and the original gradient string
    // (origGradient) are cached on first pass and reused whenever the
    // darkness setting changes (see reapplyDarkness), so we never need to
    // read this element's *already-overridden* computed style back — that
    // would either re-detect nothing (color's already dark) or require an
    // undo-then-redo cycle that flashes the original light color on screen.
    if (!cs.backgroundImage || cs.backgroundImage === "none") {
      const bg = parseColor(cs.backgroundColor);
      if (bg && bg.a >= 0.4) {
        const { h, s, l } = rgbToHsl(bg.r, bg.g, bg.b);
        if (l > 0.42) {
          const b = backup(el);
          if (b.bg === undefined) b.bg = el.style.getPropertyValue("background-color");
          if (b.origBgHsl === undefined) b.origBgHsl = { h, s: Math.min(s, 0.55) };
          applyBgColor(el, b);
          touched = true;
        }
      }
    } else if (/gradient/i.test(cs.backgroundImage)) {
      const b = backup(el);
      if (b.bgImage === undefined) b.bgImage = el.style.getPropertyValue("background-image");
      if (b.origGradient === undefined) b.origGradient = cs.backgroundImage;
      const recolored = recolorGradientStops(b.origGradient);
      if (recolored !== b.origGradient) {
        el.style.setProperty("background-image", recolored, "important");
        touched = true;
      }
    }
    // else: a url(...) image background (real photo/sprite) — left as-is.

    const color = parseColor(cs.color);
    if (color) {
      const { h, s, l } = rgbToHsl(color.r, color.g, color.b);
      if (l < 0.4) {
        const b = backup(el);
        if (b.color === undefined) b.color = el.style.getPropertyValue("color");
        const { r, g, b: bl } = hslToRgb(h, s, 0.85);
        el.style.setProperty("color", `rgb(${r}, ${g}, ${bl})`, "important");
        touched = true;
      }
    }

    // Flat border colors, so light dividers don't stay glaring.
    const borderColor = parseColor(cs.borderTopColor);
    if (borderColor && borderColor.a >= 0.4) {
      const { h, s, l } = rgbToHsl(borderColor.r, borderColor.g, borderColor.b);
      if (l > 0.55) {
        const b = backup(el);
        if (b.border === undefined) b.border = el.style.getPropertyValue("border-color");
        const { r, g, b: bl } = hslToRgb(h, Math.min(s, 0.3), 0.25);
        el.style.setProperty("border-color", `rgb(${r}, ${g}, ${bl})`, "important");
        touched = true;
      }
    }

    if (touched) {
      el.setAttribute(PROCESSED_ATTR, "1");
      processedEls.add(el);
    }
  }

  function schedule(fn) {
    if (window.requestIdleCallback) {
      requestIdleCallback(fn, { timeout: 100 });
    } else {
      setTimeout(() => fn({ timeRemaining: () => 8 }), 16);
    }
  }

  function scanAll(root) {
    const all = root.querySelectorAll("*");
    let i = 0;
    function step(deadline) {
      const hasBudget = () => !deadline.timeRemaining || deadline.timeRemaining() > 0;
      while (i < all.length && hasBudget()) {
        processElement(all[i]);
        i++;
      }
      if (i < all.length && state.enabled) schedule(step);
    }
    schedule(step);
  }

  function flushPending() {
    flushScheduled = false;
    if (!state.enabled) { pending.clear(); return; }
    const nodes = Array.from(pending);
    pending.clear();
    for (const node of nodes) {
      if (node.nodeType !== 1) continue;
      processElement(node);
      if (node.querySelectorAll) {
        node.querySelectorAll("*").forEach(processElement);
      }
    }
  }

  function startObserving() {
    if (observer) return;
    observer = new MutationObserver((mutations) => {
      if (!state.enabled) return;
      for (const m of mutations) {
        if (m.type === "childList") {
          m.addedNodes.forEach((n) => { if (n.nodeType === 1) pending.add(n); });
        } else if (m.type === "attributes") {
          pending.add(m.target);
        }
      }
      if (!flushScheduled) {
        flushScheduled = true;
        schedule(flushPending);
      }
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class"]
    });
  }

  function stopObserving() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  }

  function enableDarkMode() {
    document.documentElement.classList.add("darkbili-enabled");
    scanAll(document.documentElement);
    startObserving();
  }

  function disableDarkMode() {
    stopObserving();
    for (const el of processedEls) {
      const b = restoreMap.get(el);
      if (!b) continue;
      if (b.bg !== undefined) {
        if (b.bg) el.style.setProperty("background-color", b.bg);
        else el.style.removeProperty("background-color");
      }
      if (b.color !== undefined) {
        if (b.color) el.style.setProperty("color", b.color);
        else el.style.removeProperty("color");
      }
      if (b.bgImage !== undefined) {
        if (b.bgImage) el.style.setProperty("background-image", b.bgImage);
        else el.style.removeProperty("background-image");
      }
      if (b.border !== undefined) {
        if (b.border) el.style.setProperty("border-color", b.border);
        else el.style.removeProperty("border-color");
      }
      el.removeAttribute(PROCESSED_ATTR);
    }
    processedEls.clear();
    restoreMap = new WeakMap();
    document.documentElement.classList.remove("darkbili-enabled");
  }

  function applySettings(newState) {
    const wasEnabled = state.enabled;
    const darknessChanged = state.darkness !== newState.darkness;
    state = { ...newState };

    if (!state.enabled) {
      if (wasEnabled) disableDarkMode();
      return;
    }

    if (!wasEnabled) {
      enableDarkMode();
    } else if (darknessChanged) {
      reapplyDarkness();
    }
  }

  function init() {
    chrome.storage.sync.get(DEFAULTS, (settings) => {
      state = { ...settings, enabled: false }; // force enableDarkMode() to run its setup path
      applySettings(settings);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    chrome.storage.sync.get(DEFAULTS, applySettings);
  });
})();
