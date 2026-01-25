Tu SF debe:

Generar un challenge nuevo (base64url)

Leer de DynamoDB todas las passkeys del usuario (sus credentialId en base64url)

Armar y retornar esto:

{
  "transactionId": "tx-123",
  "publicKey": {
    "challenge": "BASE64URL_CHALLENGE_NUEVO",
    "rpId": "example.com",
    "timeout": 60000,
    "userVerification": "required",
    "allowCredentials": [
      { "type": "public-key", "id": "BASE64URL_CREDENTIAL_ID_1" },
      { "type": "public-key", "id": "BASE64URL_CREDENTIAL_ID_2" }
    ]
  }
}

Notas importantes

challenge siempre nuevo (no reusar).

rpId debe ser el dominio raíz (ej. example.com).

userVerification: "required" es lo más estándar para passkeys.

allowCredentials[].id debe ser base64url (como lo guardaste). En el navegador se convierte a ArrayBuffer.

Esto hace el navegador
function base64urlToArrayBuffer(b64url) {
  const padding = '='.repeat((4 - (b64url.length % 4)) % 4);
  const b64 = (b64url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes.buffer;
}

function arrayBufferToBase64url(buf) {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}

async function login(beginAuthResponse) {
  const pk = beginAuthResponse.publicKey;

  const publicKey = {
    challenge: base64urlToArrayBuffer(pk.challenge),
    rpId: pk.rpId,
    timeout: pk.timeout,
    userVerification: pk.userVerification ?? "required",
    allowCredentials: pk.allowCredentials.map(c => ({
      type: "public-key",
      id: base64urlToArrayBuffer(c.id),
    }))
  };

  const assertion = await navigator.credentials.get({ publicKey });

  // Esto se envía a tu backend (FinishAuthentication)
  return {
    transactionId: beginAuthResponse.transactionId,
    username: beginAuthResponse.username, // opcional si lo devuelves
    id: assertion.id,
    rawId: arrayBufferToBase64url(assertion.rawId),
    type: assertion.type,
    response: {
      clientDataJSON: arrayBufferToBase64url(assertion.response.clientDataJSON),
      authenticatorData: arrayBufferToBase64url(assertion.response.authenticatorData),
      signature: arrayBufferToBase64url(assertion.response.signature),
      userHandle: assertion.response.userHandle
        ? arrayBufferToBase64url(assertion.response.userHandle)
        : null
    }
  };
}
