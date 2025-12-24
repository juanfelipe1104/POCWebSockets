const FP_API_URL =
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    (import.meta.env.VITE_FP_API_URL ||
      import.meta.env.VITE_FINGERPRINT_API_URL ||
      import.meta.env.FP_API_URL)) ||
  (typeof process !== "undefined" &&
    process.env &&
    (process.env.FP_API_URL || process.env.FINGERPRINT_API_URL)) ||
  (typeof window !== "undefined" && window.__FP_API_URL__) ||
  "";

class DeviceFingerprint extends HTMLElement {
  static COMPONENT_NAME = "SYE_FINGERPRINT";

  constructor() {
    super();
    this._last = null;
  }

  /**
   * init(tokenTransaction, accessToken, config, callbacks)
   * @param {string} tokenTransaction
   * @param {string} accessToken
   * @param {{
   *  deviceId?: boolean,
   *  fpSoft?: boolean,
   *  fpHard?: boolean,
   *  sendSignals?: boolean,
   *  timeoutMs?: number,
   *  retry?: { attempts?: number, baseDelayMs?: number, maxDelayMs?: number, retryOnStatuses?: number[] }
   * }} config
   * @param {{ onSuccess?: Function, onError?: Function }} callbacks
   */
  async init(tokenTransaction, accessToken, config = {}, callbacks = {}) {
    const onSuccess = typeof callbacks.onSuccess === "function" ? callbacks.onSuccess : null;
    const onError = typeof callbacks.onError === "function" ? callbacks.onError : null;

    try {
      if (!FP_API_URL) {
        throw new Error(
          "FP_API_URL no está configurado. Define VITE_FP_API_URL (o similar) en tu .env, o window.__FP_API_URL__."
        );
      }
      if (!tokenTransaction) throw new Error("tokenTransaction es requerido");
      if (!accessToken) throw new Error("accessToken es requerido");

      const cfg = this._normalizeConfig(config);

      // Ejecuta todo el flujo con timeout global
      const result = await this._withTimeout(
        () => this._runFlow({ tokenTransaction, accessToken, cfg }),
        cfg.timeoutMs,
        "Timeout en fingerprint flow"
      );

      const envelope = { component: DeviceFingerprint.COMPONENT_NAME, detail: result };

      this._last = envelope;

      // Evento + callback
      this.dispatchEvent(new CustomEvent("fingerprint-success", { detail: envelope }));
      if (onSuccess) onSuccess(envelope);

      return envelope;
    } catch (err) {
      const normalized = this._normalizeError(err);
      const envelope = { component: DeviceFingerprint.COMPONENT_NAME, detail: normalized };

      this._last = envelope;

      this.dispatchEvent(new CustomEvent("fingerprint-error", { detail: envelope }));
      if (onError) onError(envelope);

      throw err;
    }
  }

  get lastResult() {
    return this._last;
  }

  // ---------------------- Config normalizada ----------------------

  _normalizeConfig(config) {
    const retry = config.retry || {};
    return {
      deviceId: !!config.deviceId,
      fpSoft: !!config.fpSoft,
      fpHard: !!config.fpHard, // fpHard => incluye high-entropy
      sendSignals: !!config.sendSignals,

      timeoutMs: Number.isFinite(config.timeoutMs) ? Math.max(1000, config.timeoutMs) : 8000,

      retry: {
        attempts: Number.isFinite(retry.attempts) ? Math.max(0, retry.attempts) : 2,
        baseDelayMs: Number.isFinite(retry.baseDelayMs) ? Math.max(0, retry.baseDelayMs) : 250,
        maxDelayMs: Number.isFinite(retry.maxDelayMs) ? Math.max(0, retry.maxDelayMs) : 2000,
        retryOnStatuses: Array.isArray(retry.retryOnStatuses)
          ? retry.retryOnStatuses
          : [408, 429, 500, 502, 503, 504],
      },
    };
  }

  // ---------------------- Flujo principal ----------------------

  async _runFlow({ tokenTransaction, accessToken, cfg }) {
    const built = await this._buildPayload(cfg);

    // Reintentos solo para la parte de POST (normalmente lo que falla)
    const apiResp = await this._postWithRetry({
      url: FP_API_URL,
      tokenTransaction,
      accessToken,
      body: built.bodyToSend,
      retryCfg: cfg.retry,
    });

    return {
      sent: built.bodyToSend,
      // si quieres auditar qué calculaste pero no enviaste, lo incluimos opcionalmente
      computed: built.computedMeta,
      apiResp,
    };
  }

  async _buildPayload(cfg) {
    const out = {
      version: "1.1.0",
      ts: new Date().toISOString(),
    };

    // Mantén metadatos de lo calculado (sin tokens)
    const computedMeta = {
      deviceId: cfg.deviceId,
      fpSoft: cfg.fpSoft,
      fpHard: cfg.fpHard,
      sendSignals: cfg.sendSignals,
    };

    // deviceId
    if (cfg.deviceId) out.deviceId = await this._getOrCreateDeviceId();

    // fpSoft
    let softSignals = null;
    if (cfg.fpSoft || (cfg.sendSignals && cfg.fpSoft)) {
      softSignals = await this._collectSoftSignals();
    }
    if (cfg.fpSoft) {
      out.fpSoft = await this._sha256Base64Url(this._stableStringify(softSignals));
    }

    // fpHard => incluye high-entropy
    let hardSignals = null;
    if (cfg.fpHard || (cfg.sendSignals && cfg.fpHard)) {
      hardSignals = await this._collectHardSignals(); // soft + uaData + canvas/audio/webgl
    }
    if (cfg.fpHard) {
      out.fpHard = await this._sha256Base64Url(this._stableStringify(hardSignals));
    }

    // Señales raw (solo si lo pides)
    if (cfg.sendSignals) {
      out.signals = {};
      if (cfg.fpSoft && softSignals) out.signals.soft = softSignals;
      if (cfg.fpHard && hardSignals) out.signals.hard = hardSignals;
    }

    // Enviar SOLO lo pedido (out ya contiene solo lo calculado)
    return {
      bodyToSend: out,
      computedMeta,
    };
  }

  // ---------------------- Retry + Timeout ----------------------

  async _postWithRetry({ url, tokenTransaction, accessToken, body, retryCfg }) {
    let lastErr = null;

    for (let attempt = 0; attempt <= retryCfg.attempts; attempt++) {
      try {
        return await this._postToApi({ url, tokenTransaction, accessToken, body });
      } catch (err) {
        lastErr = err;

        // si no es retryable, corta
        const status = err?.status;
        const retryable =
          status && retryCfg.retryOnStatuses.includes(status);

        // si no hay status (error de red), normalmente también reintentamos
        const networkLike = !status;

        const shouldRetry = attempt < retryCfg.attempts && (retryable || networkLike);
        if (!shouldRetry) break;

        const delay = this._computeBackoffDelayMs(attempt, retryCfg.baseDelayMs, retryCfg.maxDelayMs);
        await this._sleep(delay);
      }
    }

    throw lastErr;
  }

  _computeBackoffDelayMs(attempt, baseDelayMs, maxDelayMs) {
    // backoff exponencial con jitter
    const exp = baseDelayMs * Math.pow(2, attempt);
    const jitter = Math.random() * baseDelayMs;
    return Math.min(maxDelayMs, Math.floor(exp + jitter));
  }

  _sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  async _withTimeout(fn, timeoutMs, msg) {
    if (!timeoutMs || timeoutMs <= 0) return await fn();

    let t;
    const timeoutPromise = new Promise((_, reject) => {
      t = setTimeout(() => reject(new Error(msg)), timeoutMs);
    });

    try {
      return await Promise.race([fn(), timeoutPromise]);
    } finally {
      clearTimeout(t);
    }
  }

  // ---------------------- Señales (soft/hard) ----------------------

  async _collectSoftSignals() {
    const nav = navigator;
    return {
      ua: nav.userAgent,
      platform: nav.platform,
      lang: nav.language,
      langs: nav.languages,

      hc: nav.hardwareConcurrency,
      mem: nav.deviceMemory,
      touch: nav.maxTouchPoints,

      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      tzOff: new Date().getTimezoneOffset(),

      screen: {
        w: screen.width,
        h: screen.height,
        aw: screen.availWidth,
        ah: screen.availHeight,
        dpr: window.devicePixelRatio,
        cd: screen.colorDepth,
        o: screen.orientation ? { t: screen.orientation.type, a: screen.orientation.angle } : null,
      },

      features: {
        wasm: typeof WebAssembly === "object",
        webgl: !!this._safe(() => document.createElement("canvas").getContext("webgl")),
        webgl2: !!this._safe(() => document.createElement("canvas").getContext("webgl2")),
        dark: matchMedia("(prefers-color-scheme: dark)").matches,
        rm: matchMedia("(prefers-reduced-motion: reduce)").matches,
      },

      webdriver: nav.webdriver,
    };
  }

  async _collectHardSignals() {
    const soft = await this._collectSoftSignals();
    const uaData = await this._uaDataSnapshot();

    const highEntropy = {
      canvas: await this._canvasFingerprint(),
      audio: await this._audioFingerprint(),
      webgl: this._webglFingerprint(),
    };

    return { ...soft, uaData, highEntropy };
  }

  async _uaDataSnapshot() {
    const uaData = navigator.userAgentData;
    if (!uaData || !uaData.getHighEntropyValues) return null;
    try {
      const high = await uaData.getHighEntropyValues([
        "architecture",
        "bitness",
        "model",
        "platform",
        "platformVersion",
        "uaFullVersion",
        "fullVersionList",
        "wow64",
      ]);
      return { mobile: uaData.mobile, brands: uaData.brands, high };
    } catch {
      return { mobile: uaData.mobile, brands: uaData.brands, high: null };
    }
  }

  // ---------------------- POST ----------------------

  async _postToApi({ url, tokenTransaction, accessToken, body }) {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Transaction": tokenTransaction,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });

    const contentType = res.headers.get("content-type") || "";
    let data = null;
    try {
      data = contentType.includes("application/json") ? await res.json() : await res.text();
    } catch {
      data = null;
    }

    if (!res.ok) {
      const err = new Error(`Fingerprint API error: ${res.status}`);
      err.status = res.status;
      err.data = data;
      throw err;
    }

    return { status: res.status, data };
  }

  // ---------------------- Error normalize ----------------------

  _normalizeError(err) {
    return {
      message: err?.message || "Unknown error",
      status: err?.status,
      data: err?.data,
    };
  }

  // ---------------------- deviceId (IDB + LS fallback) ----------------------

  async _getOrCreateDeviceId() {
    const fromIdb = await this._idbGet("device_fp", "kv", "deviceId");
    if (fromIdb) return fromIdb;

    const fromLs = this._safe(() => localStorage.getItem("deviceId"));
    if (fromLs) {
      await this._idbSet("device_fp", "kv", "deviceId", fromLs).catch(() => {});
      return fromLs;
    }

    const newId = this._randomId();
    await this._idbSet("device_fp", "kv", "deviceId", newId).catch(() => {});
    this._safe(() => localStorage.setItem("deviceId", newId));
    return newId;
  }

  _randomId() {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  _idbOpen(dbName, storeName) {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(dbName, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(storeName)) db.createObjectStore(storeName);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async _idbGet(dbName, storeName, key) {
    try {
      const db = await this._idbOpen(dbName, storeName);
      return await new Promise((resolve) => {
        const tx = db.transaction(storeName, "readonly");
        const store = tx.objectStore(storeName);
        const r = store.get(key);
        r.onsuccess = () => resolve(r.result || null);
        r.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  async _idbSet(dbName, storeName, key, value) {
    const db = await this._idbOpen(dbName, storeName);
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const r = store.put(value, key);
      r.onsuccess = () => resolve(true);
      r.onerror = () => reject(r.error);
    });
  }

  // ---------------------- High entropy helpers ----------------------

  async _canvasFingerprint() {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 300;
      canvas.height = 80;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;

      ctx.textBaseline = "top";
      ctx.font = "16px Arial";
      ctx.fillText("fp: 😺 12345", 10, 10);
      ctx.fillRect(120, 25, 80, 20);
      ctx.strokeStyle = "#555";
      ctx.beginPath();
      ctx.arc(60, 50, 18, 0, Math.PI * 1.7);
      ctx.stroke();

      return await this._sha256Base64Url(canvas.toDataURL());
    } catch {
      return null;
    }
  }

  async _audioFingerprint() {
    try {
      const AudioCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      if (!AudioCtx) return null;

      const ctx = new AudioCtx(1, 44100, 44100);
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = 10000;

      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -50;
      comp.knee.value = 40;
      comp.ratio.value = 12;
      comp.attack.value = 0;
      comp.release.value = 0.25;

      osc.connect(comp);
      comp.connect(ctx.destination);
      osc.start(0);
      const buf = await ctx.startRendering();

      const channel = buf.getChannelData(0);
      let sum = 0;
      for (let i = 0; i < channel.length; i += 1000) sum += Math.abs(channel[i]);
      return await this._sha256Base64Url(String(sum));
    } catch {
      return null;
    }
  }

  _webglFingerprint() {
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      if (!gl) return null;

      const dbg = gl.getExtension("WEBGL_debug_renderer_info");
      const vendor = dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR);
      const renderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
      const version = gl.getParameter(gl.VERSION);
      const shading = gl.getParameter(gl.SHADING_LANGUAGE_VERSION);

      return { vendor, renderer, version, shading };
    } catch {
      return null;
    }
  }

  // ---------------------- Hash / stringify estable ----------------------

  _stableStringify(obj) {
    const seen = new WeakSet();
    const sorter = (x) => {
      if (x && typeof x === "object") {
        if (seen.has(x)) return null;
        seen.add(x);
        if (Array.isArray(x)) return x.map(sorter);
        const keys = Object.keys(x).sort();
        const out = {};
        for (const k of keys) out[k] = sorter(x[k]);
        return out;
      }
      return x;
    };
    return JSON.stringify(sorter(obj));
  }

  async _sha256Base64Url(input) {
    const data = new TextEncoder().encode(input);
    const hash = await crypto.subtle.digest("SHA-256", data);
    const bytes = new Uint8Array(hash);
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  _safe(fn) {
    try { return fn(); } catch { return null; }
  }
}

customElements.define("device-fingerprint", DeviceFingerprint);
export { DeviceFingerprint };
