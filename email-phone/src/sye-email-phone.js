/* src/sye-email-phone.js
 * SYE_EMAIL_PHONE - WebComponent
 * - UI: Email + Teléfono (móvil CO sin indicativo) + botón Continuar
 * - Validaciones:
 *    email: formato básico
 *    teléfono CO: SOLO 10 dígitos, empieza por 3, prefijo permitido
 * - Integración:
 *    init(transactionToken, accessToken, config, onSuccess, onError)
 *    POST a REGISTER_EMAIL_PHONE (apiUrl desde .env o config.apiUrl)
 * - Notifica:
 *    Callbacks: onSuccess/onError(payload)
 *    Eventos: "sye:success" y "sye:error"
 *    En ambos casos incluye: { component:"SYE_EMAIL_PHONE", detail:"..." }
 */

const DEFAULT_ALLOWED_PREFIXES = [
  // Tigo / UNE (históricos comunes)
  "300", "301", "302", "303", "304", "324",
  // ETB
  "305",
  // Claro (Comcel)
  "310", "311", "312", "313", "314", "320", "321", "322", "323",
  // Movistar
  "315", "316", "317", "318",
  // Virgin
  "319",
  // Suma Móvil (MVNO)
  "333",
  // Avantel
  "350", "351"
];

// Email “práctico” (no pretende ser RFC completo)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

function dispatch(component, type, payload) {
  component.dispatchEvent(
    new CustomEvent(type, { detail: payload, bubbles: true, composed: true })
  );
}

/**
 * Valida móvil colombiano SIN indicativo de país:
 * - exactamente 10 dígitos
 * - inicia por 3
 * - prefijo (3 dígitos) en lista permitida
 */
function validateColombianMobileNoCountry(rawPhone, allowedPrefixes) {
  const phone = String(rawPhone || "").replace(/\D+/g, "");

  if (phone.length !== 10) {
    return { ok: false, reason: "El número debe tener exactamente 10 dígitos." };
  }
  if (!phone.startsWith("3")) {
    return { ok: false, reason: "El móvil colombiano debe iniciar por 3." };
  }

  const prefix = phone.slice(0, 3);
  if (!allowedPrefixes.includes(prefix)) {
    return {
      ok: false,
      reason: `El prefijo ${prefix} no corresponde a un móvil colombiano válido.`
    };
  }

  return { ok: true, phone };
}

export class SYE_EMAIL_PHONE extends HTMLElement {
  static get observedAttributes() {
    return ["disabled"];
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });

    // Estado
    this._transactionToken = null;
    this._accessToken = null;
    this._config = {};
    this._onSuccess = null;
    this._onError = null;

    // UI refs
    this._els = {};
  }

  connectedCallback() {
    this.render();
    this.bind();
  }

  attributeChangedCallback(name) {
    if (name === "disabled") this.syncDisabled();
  }

  /**
   * init(transactionToken, accessToken, config, onSuccess, onError)
   */
  init(transactionToken, accessToken, config = {}, onSuccess, onError) {
    this._transactionToken = transactionToken;
    this._accessToken = accessToken;
    this._config = config || {};
    this._onSuccess = typeof onSuccess === "function" ? onSuccess : null;
    this._onError = typeof onError === "function" ? onError : null;
  }

  setLoading(isLoading) {
    const { btn, spinner } = this._els;
    if (!btn) return;
    btn.disabled = isLoading || this.hasAttribute("disabled");
    if (spinner) spinner.style.display = isLoading ? "inline-block" : "none";
    btn.setAttribute("aria-busy", isLoading ? "true" : "false");
  }

  syncDisabled() {
    const { email, phone, btn } = this._els;
    const disabled = this.hasAttribute("disabled");
    if (email) email.disabled = disabled;
    if (phone) phone.disabled = disabled;
    if (btn) btn.disabled = disabled;
  }

  setMessage(msg = "", kind = "error") {
    const { msgBox } = this._els;
    if (!msgBox) return;
    msgBox.textContent = msg;
    msgBox.dataset.kind = kind;
    msgBox.style.display = msg ? "block" : "none";
  }

  getApiUrl() {
    // Prioridad: config.apiUrl > .env (Vite) > ""
    return (
      this._config.apiUrl ||
      (import.meta?.env?.VITE_REGISTER_EMAIL_PHONE_URL ?? "")
    );
  }

  getAllowedPrefixes() {
    const list = this._config.allowedPrefixes;
    return Array.isArray(list) && list.length ? list.map(String) : DEFAULT_ALLOWED_PREFIXES;
  }

  async onContinue() {
    try {
      this.setMessage("");

      // Guardrails de init
      if (!this._transactionToken) {
        throw new Error("Falta transactionToken. Llama init(...) antes de usar el componente.");
      }
      if (!this._accessToken) {
        throw new Error("Falta accessToken. Llama init(...) antes de usar el componente.");
      }

      const apiUrl = this.getApiUrl();
      if (!apiUrl) {
        throw new Error("No hay apiUrl configurada. Define VITE_REGISTER_EMAIL_PHONE_URL o config.apiUrl.");
      }

      const email = (this._els.email?.value || "").trim();
      const phoneRaw = (this._els.phone?.value || "").trim();

      if (!EMAIL_RE.test(email)) {
        this.setMessage("Email inválido. Revisa el formato (ej: nombre@dominio.com).");
        return;
      }

      const allowed = this.getAllowedPrefixes();
      const v = validateColombianMobileNoCountry(phoneRaw, allowed);
      if (!v.ok) {
        this.setMessage(v.reason);
        return;
      }

      const payload = {
        transactionToken: this._transactionToken,
        email,
        phone: v.phone
      };

      this.setLoading(true);

      const res = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this._accessToken}`
        },
        body: JSON.stringify(payload)
      });

      const text = await res.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = { raw: text };
      }

      if (!res.ok) {
        const detail = data?.message || data?.error || `HTTP ${res.status}`;
        const errPayload = {
          component: "SYE_EMAIL_PHONE",
          detail,
          status: res.status,
          response: data
        };
        this.setMessage(`No fue posible registrar: ${detail}`);
        if (this._onError) this._onError(errPayload);
        dispatch(this, "sye:error", errPayload);
        return;
      }

      const okPayload = {
        component: "SYE_EMAIL_PHONE",
        detail: "REGISTER_EMAIL_PHONE_OK",
        response: data
      };

      this.setMessage("Registro exitoso.", "ok");
      if (this._onSuccess) this._onSuccess(okPayload);
      dispatch(this, "sye:success", okPayload);
    } catch (e) {
      const errPayload = {
        component: "SYE_EMAIL_PHONE",
        detail: e?.message || "UNKNOWN_ERROR"
      };
      this.setMessage(errPayload.detail);
      if (this._onError) this._onError(errPayload);
      dispatch(this, "sye:error", errPayload);
    } finally {
      this.setLoading(false);
    }
  }

  bind() {
    const { btn, phone } = this._els;

    btn?.addEventListener("click", () => this.onContinue());

    // Enter para continuar
    this.shadowRoot?.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        const tag = (ev.target?.tagName || "").toLowerCase();
        if (tag === "input") this.onContinue();
      }
    });

    // Solo dígitos, máximo 10 (sin indicativo)
    phone?.addEventListener("input", (e) => {
      e.target.value = e.target.value.replace(/\D/g, "").slice(0, 10);
    });

    this.syncDisabled();
  }

  render() {
    const style = `
      :host{
        display:block;
        font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
      }
      .card{
        border: 1px solid rgba(0,0,0,.12);
        border-radius: 12px;
        padding: 16px;
        max-width: 420px;
        box-shadow: 0 6px 18px rgba(0,0,0,.06);
        background: #fff;
      }
      h3{ margin: 0 0 10px; font-size: 16px; }
      label{ display:block; font-size: 12px; opacity:.8; margin: 12px 0 6px; }
      input{
        width:100%;
        box-sizing:border-box;
        padding: 10px 12px;
        border-radius: 10px;
        border: 1px solid rgba(0,0,0,.18);
        outline: none;
        font-size: 14px;
      }
      input:focus{
        border-color: rgba(0,0,0,.35);
        box-shadow: 0 0 0 3px rgba(0,0,0,.06);
      }
      .row{
        display:flex;
        gap:10px;
        align-items:center;
        margin-top: 14px;
      }
      button{
        border: none;
        border-radius: 10px;
        padding: 10px 14px;
        font-weight: 600;
        cursor: pointer;
        background: #111;
        color: #fff;
      }
      button:disabled{ opacity:.6; cursor:not-allowed; }
      .hint{ font-size: 12px; opacity:.7; margin-top: 6px; }
      .msg{
        display:none;
        margin-top: 12px;
        padding: 10px 12px;
        border-radius: 10px;
        font-size: 13px;
      }
      .msg[data-kind="error"]{
        background: rgba(220, 38, 38, .08);
        border: 1px solid rgba(220, 38, 38, .25);
      }
      .msg[data-kind="ok"]{
        background: rgba(22, 163, 74, .10);
        border: 1px solid rgba(22, 163, 74, .25);
      }
      .spinner{
        display:none;
        width: 14px; height: 14px;
        border: 2px solid rgba(255,255,255,.35);
        border-top-color: rgba(255,255,255,1);
        border-radius: 999px;
        animation: spin .8s linear infinite;
        vertical-align: middle;
      }
      @keyframes spin { to { transform: rotate(360deg); } }
    `;

    this.shadowRoot.innerHTML = `
      <style>${style}</style>
      <div class="card">
        <h3>Registro de Email y Teléfono</h3>

        <label>Email</label>
        <input id="email" type="email" placeholder="nombre@dominio.com" autocomplete="email" />

        <label>Teléfono móvil (Colombia)</label>
        <input
          id="phone"
          type="tel"
          inputmode="numeric"
          placeholder="3XXXXXXXXX"
          maxlength="10"
          autocomplete="tel"
        />
        <div class="hint">Ingresa solo el número móvil colombiano (10 dígitos, inicia en 3). No incluyas +57.</div>

        <div class="row">
          <button id="btn" type="button">
            <span class="spinner" id="spinner"></span>
            <span style="margin-left:8px;">Continuar</span>
          </button>
        </div>

        <div class="msg" id="msgBox" data-kind="error"></div>
      </div>
    `;

    this._els = {
      email: this.shadowRoot.querySelector("#email"),
      phone: this.shadowRoot.querySelector("#phone"),
      btn: this.shadowRoot.querySelector("#btn"),
      spinner: this.shadowRoot.querySelector("#spinner"),
      msgBox: this.shadowRoot.querySelector("#msgBox")
    };
  }
}

if (!customElements.get("sye-email-phone")) {
  customElements.define("sye-email-phone", SYE_EMAIL_PHONE);
}
