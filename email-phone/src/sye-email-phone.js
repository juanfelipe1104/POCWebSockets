/* SYE_EMAIL_PHONE - WebComponent
 * - Captura email + teléfono móvil colombiano (SIN indicativo país)
 * - Validaciones estrictas
 * - API: REGISTER_EMAIL_PHONE
 * - Headers:
 *    X-Transaction: transactionToken
 *    Authorization: Bearer accessToken
 * - Callbacks + Eventos
 */

const DEFAULT_ALLOWED_PREFIXES = [
  // Tigo / UNE
  "300", "301", "302", "303", "304", "324",
  // ETB
  "305",
  // Claro
  "310", "311", "312", "313", "314", "320", "321", "322", "323",
  // Movistar
  "315", "316", "317", "318",
  // Virgin
  "319",
  // Suma móvil
  "333",
  // Avantel
  "350", "351"
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

function dispatch(component, type, payload) {
  component.dispatchEvent(
    new CustomEvent(type, { detail: payload, bubbles: true, composed: true })
  );
}

function validateColombianMobile(rawPhone, allowedPrefixes) {
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

    this._transactionToken = null;
    this._accessToken = null;
    this._config = {};
    this._onSuccess = null;
    this._onError = null;
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

  getApiUrl() {
    return (
      this._config.apiUrl ||
      (import.meta?.env?.VITE_REGISTER_EMAIL_PHONE_URL ?? "")
    );
  }

  getAllowedPrefixes() {
    const list = this._config.allowedPrefixes;
    return Array.isArray(list) && list.length
      ? list.map(String)
      : DEFAULT_ALLOWED_PREFIXES;
  }

  setLoading(v) {
    const { btn, spinner } = this._els;
    btn.disabled = v || this.hasAttribute("disabled");
    spinner.style.display = v ? "inline-block" : "none";
  }

  syncDisabled() {
    const d = this.hasAttribute("disabled");
    Object.values(this._els).forEach(el => {
      if (el && "disabled" in el) el.disabled = d;
    });
  }

  setMessage(msg = "", kind = "error") {
    const { msgBox } = this._els;
    msgBox.textContent = msg;
    msgBox.dataset.kind = kind;
    msgBox.style.display = msg ? "block" : "none";
  }

  async onContinue() {
    try {
      this.setMessage("");

      if (!this._transactionToken) throw new Error("transactionToken requerido");
      if (!this._accessToken) throw new Error("accessToken requerido");

      const apiUrl = this.getApiUrl();
      if (!apiUrl) throw new Error("apiUrl no configurada");

      const email = this._els.email.value.trim();
      const phoneRaw = this._els.phone.value.trim();

      if (!EMAIL_RE.test(email)) {
        this.setMessage("Email inválido.");
        return;
      }

      const phoneCheck = validateColombianMobile(
        phoneRaw,
        this.getAllowedPrefixes()
      );
      if (!phoneCheck.ok) {
        this.setMessage(phoneCheck.reason);
        return;
      }

      this.setLoading(true);

      const res = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Transaction": this._transactionToken,
          "Authorization": `Bearer ${this._accessToken}`
        },
        body: JSON.stringify({
          email,
          phone: phoneCheck.phone
        })
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const err = {
          component: "SYE_EMAIL_PHONE",
          detail: data?.message || `HTTP ${res.status}`,
          status: res.status
        };
        this.setMessage(err.detail);
        this._onError?.(err);
        dispatch(this, "sye:error", err);
        return;
      }

      const ok = {
        component: "SYE_EMAIL_PHONE",
        detail: "REGISTER_EMAIL_PHONE_OK",
        response: data
      };

      this.setMessage("Registro exitoso.", "ok");
      this._onSuccess?.(ok);
      dispatch(this, "sye:success", ok);

    } catch (e) {
      const err = {
        component: "SYE_EMAIL_PHONE",
        detail: e.message || "ERROR"
      };
      this.setMessage(err.detail);
      this._onError?.(err);
      dispatch(this, "sye:error", err);
    } finally {
      this.setLoading(false);
    }
  }

  bind() {
    this._els.btn.addEventListener("click", () => this.onContinue());

    this.shadowRoot.addEventListener("keydown", e => {
      if (e.key === "Enter") this.onContinue();
    });

    this._els.phone.addEventListener("input", e => {
      e.target.value = e.target.value.replace(/\D/g, "").slice(0, 10);
    });

    this.syncDisabled();
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host{font-family:system-ui;display:block}
        .card{max-width:420px;padding:16px;border-radius:12px;border:1px solid #ddd;background:#fff}
        label{font-size:12px;margin-top:12px;display:block}
        input{width:100%;padding:10px;border-radius:10px;border:1px solid #ccc}
        button{margin-top:14px;padding:10px;border-radius:10px;border:none;background:#111;color:#fff}
        .msg{margin-top:12px;padding:10px;border-radius:10px;display:none}
        .msg[data-kind="error"]{background:#fee;border:1px solid #f99}
        .msg[data-kind="ok"]{background:#efe;border:1px solid #9f9}
        .spinner{display:none;margin-right:6px}
      </style>

      <div class="card">
        <label>Email</label>
        <input id="email" type="email" placeholder="nombre@dominio.com"/>

        <label>Teléfono móvil (Colombia)</label>
        <input id="phone" type="tel" placeholder="3XXXXXXXXX" maxlength="10"/>
        <small>Solo número móvil colombiano, sin +57</small>

        <button id="btn">
          <span class="spinner" id="spinner">⏳</span>
          Continuar
        </button>

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
