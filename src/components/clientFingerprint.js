// clientFingerprint.js
// Vanilla JS helper to generate a browser fingerprint-style payload

// ---------- small helpers ----------

async function sha256(input) {
  const enc = new TextEncoder();
  const data = enc.encode(input);
  const hashBuf = await crypto.subtle.digest("SHA-256", data);
  const hashArr = Array.from(new Uint8Array(hashBuf));
  return hashArr.map(b => b.toString(16).padStart(2, "0")).join("");
}

function safeNavigator() {
  if (typeof navigator === "undefined") return {};
  return navigator;
}

function safeWindow() {
  if (typeof window === "undefined") return {};
  return window;
}

function getTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

function canvasHashSource() {
  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    canvas.width = 240;
    canvas.height = 60;

    // draw some text and shapes
    ctx.textBaseline = "top";
    ctx.font = "16px 'Arial'";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#f60";
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = "#069";
    ctx.fillText("fingerprint-canvas", 2, 15);
    ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
    ctx.fillText("fingerprint-canvas", 4, 17);

    const dataUrl = canvas.toDataURL();
    return dataUrl; // RAW canvas fingerprint source
  } catch {
    return null;
  }
}

function webglInfoString() {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (!gl) return null;

    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
    const vendor = debugInfo
      ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL)
      : gl.getParameter(gl.VENDOR);
    const renderer = debugInfo
      ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
      : gl.getParameter(gl.RENDERER);

    return JSON.stringify({ vendor, renderer }); // RAW WebGL info
  } catch {
    return null;
  }
}

function audioFingerprintString() {
  // basic, cheap audio fingerprint (async)
  try {
    const win = safeWindow();
    const AudioContext = win.OfflineAudioContext || win.webkitOfflineAudioContext;
    if (!AudioContext) return null;

    const context = new AudioContext(1, 44100, 44100);
    const oscillator = context.createOscillator();
    const compressor = context.createDynamicsCompressor();

    oscillator.type = "triangle";
    oscillator.frequency.value = 10000;

    compressor.threshold.value = -50;
    compressor.knee.value = 40;
    compressor.ratio.value = 12;
    compressor.attack.value = 0;
    compressor.release.value = 0.25;

    oscillator.connect(compressor);
    compressor.connect(context.destination);
    oscillator.start(0);

    return new Promise((resolve) => {
      context
        .startRendering()
        .then((buffer) => {
          let sum = 0;
          const channelData = buffer.getChannelData(0);
          for (let i = 4500; i < 5000; i++) {
            sum += Math.abs(channelData[i]);
          }
          resolve(sum.toString()); // RAW numeric-ish audio fingerprint
        })
        .catch(() => resolve(null));
    });
  } catch {
    return null;
  }
}

// ---------- extra entropy helpers ----------

function getCookieString() {
  try {
    return document.cookie || "";
  } catch {
    return "";
  }
}

function getStorageSnapshot() {
  const snap = {
    localStorageKeys: [],
    sessionStorageKeys: [],
  };
  try {
    const win = safeWindow();
    if (win.localStorage) {
      for (let i = 0; i < win.localStorage.length; i++) {
        snap.localStorageKeys.push(win.localStorage.key(i));
      }
    }
  } catch {
    // ignore
  }
  try {
    const win = safeWindow();
    if (win.sessionStorage) {
      for (let i = 0; i < win.sessionStorage.length; i++) {
        snap.sessionStorageKeys.push(win.sessionStorage.key(i));
      }
    }
  } catch {
    // ignore
  }
  return snap;
}

function getConnectionInfo() {
  try {
    const nav = safeNavigator();
    const c = nav.connection || nav.mozConnection || nav.webkitConnection;
    if (!c) return null;
    return {
      effectiveType: c.effectiveType || null,
      downlink: c.downlink || null,
      rtt: c.rtt || null,
      saveData: !!c.saveData,
    };
  } catch {
    return null;
  }
}

// ---------- webdriver / automation hints ----------

function getAutomationHints() {
  const win = safeWindow();
  const nav = safeNavigator();

  // nav.webdriver is the canonical signal
  const webdriver = nav.webdriver === true;

  const hints = {
    webdriver,
    // window-level flags often left by tools
    hasSelenium: false,
    hasPuppeteer: false,
    hasPlaywright: false,
    hasNightmare: false,
    hasChromeRuntime: false,
    hasChromeCdp: false,
  };

  try {
    // Selenium
    if (
      win._Selenium_IDE_Recorder ||
      win.__webdriver_script_fn ||
      win.__selenium_unwrapped__ ||
      win.__selenium_evaluate__
    ) {
      hints.hasSelenium = true;
    }

    // Puppeteer (heuristics, not perfect)
    if (
      win.__puppeteer_evaluation_script__ ||
      win.__puppeteer_unwrapped__ ||
      (win.navigator && /HeadlessChrome/i.test(nav.userAgent || ""))
    ) {
      hints.hasPuppeteer = true;
    }

    // Playwright
    if (
      win.__pwInitScripts ||
      win.__playwright ||
      win.__pw_webkitInit ||
      win.__pw_browserContext__
    ) {
      hints.hasPlaywright = true;
    }

    // Nightmare / Phantom-style things
    if (win.__nightmare || win._phantom || win.callPhantom) {
      hints.hasNightmare = true;
    }

    // Chrome runtime / CDP traces can hint automation; weak but useful
    if (win.chrome && win.chrome.runtime && win.chrome.runtime.id) {
      hints.hasChromeRuntime = true;
    }

    // Some tools expose CDP bindings (very heuristic)
    if (win.cdp || win.__cdp_hooks__ || win.__chrome_devtools__) {
      hints.hasChromeCdp = true;
    }
  } catch {
    // ignore
  }

  return hints;
}

// ---------- main function ----------

export async function getClientFingerprint() {
  const nav = safeNavigator();
  const win = safeWindow();

  // core component values
  const ua = nav.userAgent || "";
  const languages = nav.languages && nav.languages.length
    ? nav.languages
    : (nav.language ? [nav.language] : []);
  const platform = nav.platform || null;
  const colorDepth = win.screen ? win.screen.colorDepth : null;
  const screenRes = win.screen ? [win.screen.width, win.screen.height] : null;
  const timezone = getTimezone();
  const deviceMemory = nav.deviceMemory || null;
  const hardwareConcurrency = nav.hardwareConcurrency || null;
  const doNotTrack = nav.doNotTrack || win.doNotTrack || null;
  const maxTouchPoints = nav.maxTouchPoints || 0;

  // automation hints
  const automationHints = getAutomationHints();

  // plugin names
  let pluginList = [];
  try {
    if (nav.plugins) {
      pluginList = Array.from(nav.plugins).map(p => p.name + "::" + p.filename);
    }
  } catch {
    pluginList = [];
  }

  // feature flags
  const localStorageSupported = (() => {
    try {
      const w = safeWindow();
      const x = "__fp_test__";
      w.localStorage.setItem(x, x);
      w.localStorage.removeItem(x);
      return true;
    } catch {
      return false;
    }
  })();

  const sessionStorageSupported = (() => {
    try {
      const w = safeWindow();
      const x = "__fp_test__";
      w.sessionStorage.setItem(x, x);
      w.sessionStorage.removeItem(x);
      return true;
    } catch {
      return false;
    }
  })();

  const indexedDBSupported = !!win.indexedDB;

  const canvasRaw = canvasHashSource();
  const webglRaw = webglInfoString();
  const audioRaw = await audioFingerprintString();

  const cookieStr = getCookieString();
  const storageSnapshot = getStorageSnapshot();
  const connectionInfo = getConnectionInfo();

  // hash some “heavy” raw data on the client
  const cookieHash = cookieStr ? await sha256(cookieStr) : null;
  const storageHash = await sha256(JSON.stringify(storageSnapshot));
  const canvasHashVal = canvasRaw ? await sha256(canvasRaw) : null;
  const webglHashVal = webglRaw ? await sha256(webglRaw) : null;
  const audioHashVal = audioRaw ? await sha256(audioRaw) : null;
  const connectionHash = connectionInfo
    ? await sha256(JSON.stringify(connectionInfo))
    : null;

  // build components (raw + hash where it helps)
  const components = {
    userAgent: { value: ua },
    languages: { value: languages },
    platform: { value: platform },
    colorDepth: { value: colorDepth },
    screenResolution: { value: screenRes },
    timezone: { value: timezone },
    deviceMemory: { value: deviceMemory },
    hardwareConcurrency: { value: hardwareConcurrency },
    doNotTrack: { value: doNotTrack },
    maxTouchPoints: { value: maxTouchPoints },
    plugins: { value: pluginList },
    localStorageSupported: { value: localStorageSupported },
    sessionStorageSupported: { value: sessionStorageSupported },
    indexedDBSupported: { value: indexedDBSupported },

    // RAW + HASH versions so backend can use both
    canvas: { raw: canvasRaw, hash: canvasHashVal },
    webgl: { raw: webglRaw, hash: webglHashVal },
    audio: { raw: audioRaw, hash: audioHashVal },

    // webdriver + automation hints
    webdriver: { value: automationHints.webdriver },
    automationHints: { value: automationHints },
  };

  // extra entropy — already hashed
  const entropy = {
    cookiesHash: cookieHash,
    storageHash: storageHash,
    connectionHash: connectionHash,
  };

  // build a stable visitorId from all components + entropy
  const idSource = JSON.stringify({
    components,
    entropy,
  });

  const visitorId = await sha256(idSource);

  // simple confidence heuristic:
  // more non-null “strong” signals => higher confidence (0.5–0.99)
  const strongSignals = [
    canvasHashVal,
    webglHashVal,
    audioHashVal,
    cookieHash,
    storageHash,
  ];
  const strongCount = strongSignals.filter(Boolean).length;
  const base = 0.5 + Math.min(strongCount, 5) * 0.1; // up to 1.0
  const confidenceClamped = Math.min(base, 0.99);

  return {
    fingerprint: {
      visitorId,
      confidence: confidenceClamped,
      components,
      entropy,
    },
  };
}