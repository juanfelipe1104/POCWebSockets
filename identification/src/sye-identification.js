const COMPONENT_NAME = "SYE_IDENTIFICATION";

function isDigitsOnly(str) {
  return /^[0-9]+$/.test(str);
}

function isAlphaNum(str) {
  return /^[a-zA-Z0-9]+$/.test(str);
}

function parseSafeInt(str) {
  if (!isDigitsOnly(str)) return null;
  const n = Number(str);
  if (!Number.isSafeInteger(n)) return null;
  return n;
}

function validate(documentType, documentValueRaw) {
  const value = (documentValueRaw ?? "").trim();

  if (!documentType) {
    return { ok: false, message: "Selecciona un tipo de documento." };
  }

  if (!value) {
    return { ok: false, message: "Ingresa el número de documento." };
  }

  switch (documentType) {
    case "CC": {
      const n = parseSafeInt(value);
      if (n === null) return { ok: false, message: "La cédula (CC) solo admite números." };

      const ok = (n >= 5_000_000 && n <= 100_000_000) || (n > 1_000_000_000);
      if (!ok) {
        return {
          ok: false,
          message:
            "CC inválida. Debe estar entre 5.000.000 y 100.000.000, o ser mayor a 1.000.000.000."
        };
      }
      return { ok: true };
    }

    case "CE": {
      const n = parseSafeInt(value);
      if (n === null) return { ok: false, message: "La cédula de extranjería (CE) solo admite números." };
      if (n < 1 || n > 1_000_000) {
        return { ok: false, message: "CE inválida. Debe estar entre 1 y 1.000.000." };
      }
      return { ok: true };
    }

    case "TI": {
      const n = parseSafeInt(value);
      if (n === null) return { ok: false, message: "La tarjeta de identidad (TI) solo admite números." };
      if (!(n > 1_000_000_000)) {
        return { ok: false, message: "TI inválida. Debe ser mayor a 1.000.000.000." };
      }
      return { ok: true };
    }

    case "PAP": {
      // Pasaporte: letras y números
      if (!isAlphaNum(value)) {
        return { ok: false, message: "Pasaporte inválido. Solo se permiten letras y números." };
      }
      return { ok: true };
    }

    case "PPT": {
      // Permiso Temporal: 1..100.000.000
      const n = parseSafeInt(value);
      if (n === null) return { ok: false, message: "PPT inválido. Solo se permiten números." };
      if (n < 1 || n > 100_000_000) {
        return { ok: false, message: "PPT inválido. Debe estar entre 1 y 100.000.000." };
      }
      return { ok: true };
    }

    default:
      return { ok: false, message: "Tipo de documento no soportado." };
  }
}

class SYEIdentification extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });

    // Credenciales / config
    this._transactionToken = null;
    this._accessToken = null;
    this._config = {};
    this._onSuccess = null;
    this._onError = null;

    // UI refs
    this.$ = {};
  }

  /**
   * init(transactionToken, accessToken, config, onSuccess, onError)
   */
  init(transactionToken, accessToken, config = {}, onSuccess, onError) {
    this._transactionToken = transactionToken ?? null;
    this._accessToken = accessToken ?? null;
    this._config = config ?? {};
    this._onSuccess = typeof onSuccess === "function" ? onSuccess : null;
    this._onError = typeof onError === "function" ? onError : null;
  }

  connectedCallback() {
    this.render();
    this.bind();
  }

  render() {
    const style = `
      :host {
        font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
        display: block;
      }
      .wrap {
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        padding: 14px;
        max-width: 420px;
      }
      .row {
        display: grid;
        grid-template-columns: 140px 1fr;
        gap: 10px;
        margin-bottom: 10px;
      }
      label {
        font-size: 12px;
        color: #374151;
        margin-bottom: 6px;
        display: block;
      }
      select, input {
        width: 100%;
        padding: 10px;
        border: 1px solid #d1d5db;
        border-radius: 10px;
        outline: none;
        font-size: 14px;
      }
      input:disabled, select:disabled, button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      button {
        width: 100%;
        padding: 10px 12px;
        border: 0;
        border-radius: 10px;
        font-size: 14px;
        cursor: pointer;
      }
      .msg {
        margin-top: 10px;
        font-size: 13px;
        color: #b91c1c;
        min-height: 18px;
      }
      .hint {
        margin-top: 6px;
        font-size: 12px;
        color: #6b7280;
      }
    `;

    const html = `
      <style>${style}</style>
      <div class="wrap">
        <div class="row">
          <div>
            <label for="docType">Tipo de documento</label>
            <select id="docType">
              <option value="">Selecciona...</option>
              <option value="CC">CC - Cédula de Ciudadanía</option>
              <option value="TI">TI - Tarjeta de Identidad</option>
              <option value="PAP">PAP - Pasaporte</option>
              <option value="PPT">PPT - Permiso Temporal</option>
              <option value="CE">CE - Cédula de Extranjería</option>
            </select>
          </div>
          <div>
            <label for="docNumber">Número</label>
            <input id="docNumber" type="text" inputmode="text" autocomplete="off" />
            <div class="hint" id="hint"></div>
          </div>
        </div>

        <button id="btn">Continuar</button>
        <div class="msg" id="msg"></div>
      </div>
    `;

    this.shadowRoot.innerHTML = html;

    this.$.docType = this.shadowRoot.querySelector("#docType");
    this.$.docNumber = this.shadowRoot.querySelector("#docNumber");
    this.$.btn = this.shadowRoot.querySelector("#btn");
    this.$.msg = this.shadowRoot.querySelector("#msg");
    this.$.hint = this.shadowRoot.querySelector("#hint");
  }

  bind() {
    this.$.docType.addEventListener("change", () => {
      this.$.msg.textContent = "";
      this.$.docNumber.value = "";
      this.$.hint.textContent = this.getHint(this.$.docType.value);
    });

    this.$.btn.addEventListener("click", async () => {
      this.$.msg.textContent = "";
      await this.handleContinue();
    });
  }

  getHint(type) {
    switch (type) {
      case "CC":
        return "CC: 5.000.000–100.000.000 o >1.000.000.000 (solo números)";
      case "CE":
        return "CE: 1–1.000.000 (solo números)";
      case "TI":
        return "TI: >1.000.000.000 (solo números)";
      case "PAP":
        return "Pasaporte: letras y números";
      case "PPT":
        return "PPT: 1–100.000.000 (solo números)";
      default:
        return "";
    }
  }

  setLoading(isLoading) {
    this.$.docType.disabled = isLoading;
    this.$.docNumber.disabled = isLoading;
    this.$.btn.disabled = isLoading;
    this.$.btn.textContent = isLoading ? "Procesando..." : "Continuar";
  }

  failUser(message) {
    this.$.msg.textContent = message;
  }

  callOnError(detail) {
    if (this._onError) {
      this._onError({ component: COMPONENT_NAME, detail });
    }
  }

  callOnSuccess(detail = "") {
    if (this._onSuccess) {
      this._onSuccess({ component: COMPONENT_NAME, detail });
    }
  }

  async handleContinue() {
    const docType = this.$.docType.value;
    const docNumber = this.$.docNumber.value;

    // Validación local
    const v = validate(docType, docNumber);
    if (!v.ok) {
      this.failUser(v.message);
      return;
    }

    // URL desde .env (Vite expone import.meta.env.*)
    const apiUrl = import.meta.env.VITE_REGISTER_IDENTIFICATION_URL;
    if (!apiUrl) {
      const detail = { error: "MissingEnv", message: "Falta VITE_REGISTER_IDENTIFICATION_URL en .env" };
      this.failUser("Configuración incompleta del componente.");
      this.callOnError(detail);
      return;
    }

    // Validación de init
    if (!this._transactionToken || !this._accessToken) {
      const detail = { error: "MissingInit", message: "Debes llamar init(transactionToken, accessToken, ...)" };
      this.failUser("El componente no está inicializado.");
      this.callOnError(detail);
      return;
    }

    // POST al API
    this.setLoading(true);
    try {
      const payload = {
        documentType: docType,
        documentNumber: docNumber.trim()
      };

      const res = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this._accessToken}`,
          "X-Transaction": this._transactionToken
        },
        body: JSON.stringify(payload)
      });

      let body = null;
      const text = await res.text();
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        body = { raw: text };
      }

      // Regla: éxito solo si HTTP 200 y body {code:200}
      if (res.status === 200 && body && body.code === 200) {
        this.callOnSuccess(body);
      } else {
        const detail = { status: res.status, body };
        this.failUser("No fue posible registrar la identificación. Verifica los datos e inténtalo de nuevo.");
        this.callOnError(detail);
      }
    } catch (err) {
      const detail = { error: "NetworkOrRuntimeError", message: String(err?.message ?? err) };
      this.failUser("Ocurrió un error al conectar con el servicio.");
      this.callOnError(detail);
    } finally {
      this.setLoading(false);
    }
  }
}

customElements.define("sye-identification", SYEIdentification);
