package com.acme.passkeys.adapters.out.webauthn4j;

import com.acme.passkeys.application.ports.out.AuthenticationVerifier;
import com.webauthn4j.WebAuthnManager;
import com.webauthn4j.data.AuthenticationData;
import com.webauthn4j.data.client.Origin;
import com.webauthn4j.data.client.challenge.Challenge;
import com.webauthn4j.data.client.challenge.DefaultChallenge;
import com.webauthn4j.server.ServerProperty;
import com.webauthn4j.validator.AuthenticationDataValidator;
import com.webauthn4j.validator.AuthenticationParameters;

import java.lang.reflect.Method;
import java.util.Base64;

public class WebAuthn4jAuthenticationVerifier implements AuthenticationVerifier {

  private final WebAuthnManager manager;
  private final AuthenticationDataValidator validator;

  public WebAuthn4jAuthenticationVerifier(WebAuthnManager manager, AuthenticationDataValidator validator) {
    this.manager = manager;
    this.validator = validator;
  }

  @Override
  public VerifiedAuthentication verify(VerifyAuthenticationCommand cmd) {
    byte[] credentialId = b64urlDecode(cmd.credentialIdB64Url());
    byte[] clientDataJSON = b64urlDecode(cmd.clientDataJSONB64Url());
    byte[] authenticatorData = b64urlDecode(cmd.authenticatorDataB64Url());
    byte[] signature = b64urlDecode(cmd.signatureB64Url());
    byte[] publicKeyCose = b64urlDecode(cmd.publicKeyCoseB64Url());

    Challenge challenge = new DefaultChallenge(b64urlDecode(cmd.challengeB64Url()));

    ServerProperty serverProperty = new ServerProperty(
        new Origin(cmd.origin()),
        cmd.rpId(),
        challenge,
        null
    );

    AuthenticationData authenticationData = parseAuthenticationData(credentialId, clientDataJSON, authenticatorData, signature, publicKeyCose);

    // ✅ NO validamos signCount: pasamos counter = null
    AuthenticationParameters params = new AuthenticationParameters(
        serverProperty,
        null, // expectedUserHandle (username-first)
        cmd.userVerificationRequired(),
        true,
        null // counter
    );

    validator.validate(authenticationData, params);

    return new VerifiedAuthentication(cmd.credentialIdB64Url());
  }

  private AuthenticationData parseAuthenticationData(
      byte[] credentialId,
      byte[] clientDataJSON,
      byte[] authenticatorData,
      byte[] signature,
      byte[] publicKeyCose
  ) {
    // Intentamos encontrar un overload compatible de WebAuthnManager#parse(...) vía reflexión
    // para evitar fragilidad entre versiones.
    try {
      for (Method m : WebAuthnManager.class.getMethods()) {
        if (!m.getName().equals("parse")) continue;
        Class<?>[] p = m.getParameterTypes();

        // Variante común: parse(byte[] credentialId, byte[] clientDataJSON, byte[] authenticatorData, byte[] signature, byte[] publicKeyCose)
        if (p.length == 5 &&
            p[0] == byte[].class && p[1] == byte[].class && p[2] == byte[].class && p[3] == byte[].class && p[4] == byte[].class) {
          Object out = m.invoke(manager, credentialId, clientDataJSON, authenticatorData, signature, publicKeyCose);
          return (AuthenticationData) out;
        }

        // Variante alternativa: parse(byte[] credentialId, byte[] clientDataJSON, byte[] authenticatorData, byte[] signature)
        // (publicKey se asocia de otra forma). No la usamos porque necesitamos publicKey. Seguimos buscando.
      }
      throw new IllegalStateException("Unsupported webauthn4j WebAuthnManager.parse(...) signature");
    } catch (RuntimeException e) {
      throw e;
    } catch (Exception e) {
      throw new IllegalStateException("Failed to parse authentication data", e);
    }
  }

  private static byte[] b64urlDecode(String s) {
    if (s == null) return null;
    String padded = s.replace('-', '+').replace('_', '/');
    int mod = padded.length() % 4;
    if (mod == 2) padded += "==";
    else if (mod == 3) padded += "=";
    else if (mod != 0) throw new IllegalArgumentException("invalid base64url");
    return Base64.getDecoder().decode(padded);
  }
}
