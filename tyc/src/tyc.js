const DEFAULTS = Object.freeze({
  title: "Términos y condiciones",
  description:
    "Por favor acepta o rechaza los términos y condiciones para continuar.",
  acceptText: "Aceptar",
  denyText: "Rechazar",
  endpoint: import.meta.env.VITE_REGISTER_TYC_URL || "",
  method: "POST",
  timeoutMs: 15000,
  // Si quieres deshabilitar auto-call al click y controlar tú el submit:
  autoSubmit: true
});

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function buildDetail(component, payload) {
  return { component, detail: payload ?? "" };
}

export class SYE_TYC extends HTMLElement {
  static get observedAttributes() {
    return ["disabled"];
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });

    this._state = {
      tokenTransaction: "",
      accessToken: "",
      config: { ...DEFAULTS },
      disabled: false,
      busy: false
    };

    // Callbacks opcionales (estilo "SDK")
    this._callbacks = {
      onSuccess: null,
      onError: null
    };

    this._abortController = null;

    this.shadowRoot.innerHTML = `
      <style>
        :host{
          display:block;
          font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
        }
        .card{
          border: 1px solid #e6e6e6;
          border-radius: 14px;
          padding: 16px;
          box-shadow: 0 6px 20px rgba(0,0,0,.06);
          background: #fff;
        }
        .head{
          display:flex;
          align-items:flex-start;
          justify-content:space-between;
          gap:12px;
          margin-bottom: 10px;
        }
        .title{
          margin:0;
          font-size: 16px;
          font-weight: 700;
          color:#111;
        }
        .desc{
          margin: 6px 0 0 0;
          font-size: 13px;
          color:#444;
          line-height: 1.35;
        }
        .actions{
          display:flex;
          gap:10px;
          margin-top: 14px;
          flex-wrap: wrap;
        }
        button{
          border: 1px solid #d9d9d9;
          border-radius: 12px;
          padding: 10px 14px;
          font-size: 14px;
          cursor: pointer;
          background: #fff;
          transition: transform .02s ease, opacity .2s ease;
          user-select:none;
        }
        button:active{ transform: scale(.99); }
        button[disabled]{ opacity: .55; cursor: not-allowed; }
        .btn-primary{
          border-color: #111;
          background: #111;
          color: #fff;
        }
        .btn-ghost{
          background: #fff;
          color:#111;
        }
        .status{
          margin-top: 10px;
          font-size: 12px;
          color:#666;
          min-height: 16px;
        }
        .error{
          color: #b00020;
          font-weight: 600;
        }
        .ok{
          color: #0b6b2f;
          font-weight: 600;
        }
      </style>

      <div class="card" role="group" aria-label="SYE_TYC">
        <div class="head">
          <div>
            <h3 class="title" id="title"></h3>
            <p class="desc" id="desc"></p>
          </div>
        </div>

        <div class="actions">
          <button id="btnAccept" class="btn-primary" type="button"></button>
          <button id="btnDeny" class="btn-ghost" type="button"></button>
        </div>

        <div class="status" id="status" aria-live="polite"></div>
      </div>
    `;

    this.$ = {
      title: this.shadowRoot.querySelector("#title"),
      desc: this.shadowRoot.querySelector("#desc"),
      status: this.shadowRoot.querySelector("#status"),
      btnAccept: this.shadowRoot.querySelector("#btnAccept"),
      btnDeny: this.shadowRoot.querySelector("#btnDeny")
    };
  }

  connectedCallback() {
    this._render();
    this.$.btnAccept.addEventListener("click", () => this._handleChoice("ACCEPT"));
    this.$.btnDeny.addEventListener("click", () => this._handleChoice("DENIED"));
  }

  disconnectedCallback() {
    this._cancelInFlight();
  }

  attributeChangedCallback(name) {
    if (name === "disabled") {
      this._state.disabled = this.hasAttribute("disabled");
      this._renderDisabled();
    }
  }

  /**
   * init(transactionToken, accessToken, config, callbacks)
   * - transactionToken: string (X-Transaction)
   * - accessToken: string (Bearer)
   * - config: overrides (endpoint, textos, etc)
   * - callbacks: { onSuccess, onError }
   */
  init(transactionToken, accessToken, config = {}, callbacks = {}) {
    this._state.tokenTransaction = String(transactionToken ?? "");
    this._state.accessToken = String(accessToken ?? "");
    this._state.config = { ...DEFAULTS, ...(config || {}) };

    this._callbacks.onSuccess = typeof callbacks.onSuccess === "function" ? callbacks.onSuccess : null;
    this._callbacks.onError = typeof callbacks.onError === "function" ? callbacks.onError : null;

    this._render();
  }

  /**
   * API opcional por si quieres controlar el submit desde fuera
   */
  async submit(value /* "ACCEPT" | "DENIED" */) {
    return this._submit(value);
  }

  _render() {
    const cfg = this._state.config;

    this.$.title.textContent = cfg.title;
    this.$.desc.textContent = cfg.description;
    this.$.btnAccept.textContent = cfg.acceptText;
    this.$.btnDeny.textContent = cfg.denyText;

    this._renderDisabled();
    this._setStatus("", "");
  }

  _renderDisabled() {
    const isDisabled = this._state.disabled || this._state.busy;
    this.$.btnAccept.disabled = isDisabled;
    this.$.btnDeny.disabled = isDisabled;
  }

  _setStatus(message, kind /* "", "ok", "error" */) {
    this.$.status.textContent = message || "";
    this.$.status.className = `status ${kind || ""}`.trim();
  }

  _cancelInFlight() {
    if (this._abortController) {
      try { this._abortController.abort(); } catch {}
    }
    this._abortController = null;
  }

  async _handleChoice(value) {
    // Notificar evento "choice" antes del submit (útil para analytics)
    this.dispatchEvent(
      new CustomEvent("sye:choice", {
        bubbles: true,
        composed: true,
        detail: buildDetail("SYE_TYC", { tyc: value })
      })
    );

    if (!this._state.config.autoSubmit) return;
    await this._submit(value);
  }

  async _submit(value) {
    const cfg = this._state.config;

    // Validaciones mínimas
    if (!cfg.endpoint) {
      const err = { code: "MISSING_ENDPOINT", message: "REGISTER_TYC endpoint no configurado (.env / config.endpoint)." };
      this._emitError(err);
      return { ok: false, error: err };
    }
    if (!this._state.tokenTransaction) {
      const err = { code: "MISSING_TRANSACTION", message: "tokenTransaction es requerido para el header X-Transaction." };
      this._emitError(err);
      return { ok: false, error: err };
    }
    if (!this._state.accessToken) {
      const err = { code: "MISSING_ACCESS_TOKEN", message: "accessToken es requerido para Authorization Bearer." };
      this._emitError(err);
      return { ok: false, error: err };
    }
    if (value !== "ACCEPT" && value !== "DENIED") {
      const err = { code: "INVALID_VALUE", message: 'Valor inválido. Use "ACCEPT" o "DENIED".' };
      this._emitError(err);
      return { ok: false, error: err };
    }

    this._cancelInFlight();
    this._abortController = new AbortController();

    this._state.busy = true;
    this._renderDisabled();
    this._setStatus("Enviando...", "");

    const timeoutId = setTimeout(() => {
      try { this._abortController?.abort(); } catch {}
    }, cfg.timeoutMs);

    const body = JSON.stringify({ tyc: value });

    try {
      const res = await fetch(cfg.endpoint, {
        method: cfg.method,
        headers: {
          "Content-Type": "application/json",
          "X-Transaction": this._state.tokenTransaction,
          "Authorization": `Bearer ${this._state.accessToken}`
        },
        body,
        signal: this._abortController.signal
      });

      const text = await res.text();
      const parsed = safeJsonParse(text);
      const data = parsed ?? text;

      if (!res.ok) {
        const err = {
          code: "HTTP_ERROR",
          status: res.status,
          message: `Error HTTP ${res.status}`,
          response: data
        };
        this._emitError(err);
        return { ok: false, error: err };
      }

      const okPayload = {
        status: res.status,
        tyc: value,
        response: data
      };

      this._emitSuccess(okPayload);
      return { ok: true, data: okPayload };
    } catch (e) {
      const err = {
        code: e?.name === "AbortError" ? "TIMEOUT" : "NETWORK_ERROR",
        message: e?.name === "AbortError" ? "Timeout de red." : "Error de red.",
        raw: String(e?.message || e)
      };
      this._emitError(err);
      return { ok: false, error: err };
    } finally {
      clearTimeout(timeoutId);
      this._state.busy = false;
      this._renderDisabled();
      this._abortController = null;
    }
  }

  _emitSuccess(payload) {
    this._setStatus("Guardado correctamente.", "ok");

    // Callback
    this._callbacks.onSuccess?.(buildDetail("SYE_TYC", payload));

    // Evento estándar
    this.dispatchEvent(
      new CustomEvent("sye:success", {
        bubbles: true,
        composed: true,
        detail: buildDetail("SYE_TYC", payload)
      })
    );
  }

  _emitError(err) {
    const msg = err?.message || "Error";
    this._setStatus(msg, "error");

    // Callback
    this._callbacks.onError?.(buildDetail("SYE_TYC", err));

    // Evento estándar
    this.dispatchEvent(
      new CustomEvent("sye:error", {
        bubbles: true,
        composed: true,
        detail: buildDetail("SYE_TYC", err)
      })
    );
  }
}

customElements.define("sye-tyc", SYE_TYC);
