package com.acme.passkeys.adapters.out.webauthn4j;

import com.acme.passkeys.application.ports.out.RegistrationVerifier;
import com.webauthn4j.WebAuthnManager;
import com.webauthn4j.data.RegistrationData;
import com.webauthn4j.data.client.Origin;
import com.webauthn4j.data.client.challenge.Challenge;
import com.webauthn4j.data.client.challenge.DefaultChallenge;
import com.webauthn4j.server.ServerProperty;
import com.webauthn4j.validator.RegistrationDataValidator;
import com.webauthn4j.validator.RegistrationParameters;

import java.util.Base64;

public class WebAuthn4jRegistrationVerifier implements RegistrationVerifier {

  private final WebAuthnManager manager;
  private final RegistrationDataValidator validator;

  public WebAuthn4jRegistrationVerifier(WebAuthnManager manager, RegistrationDataValidator validator) {
    this.manager = manager;
    this.validator = validator;
  }

  @Override
  public VerifiedRegistration verify(VerifyRegistrationCommand cmd) {
    byte[] clientDataJSON = b64urlDecode(cmd.clientDataJSONB64Url());
    byte[] attestationObject = b64urlDecode(cmd.attestationObjectB64Url());

    Challenge challenge = new DefaultChallenge(b64urlDecode(cmd.challengeB64Url()));

    ServerProperty serverProperty = new ServerProperty(
        new Origin(cmd.origin()),
        cmd.rpId(),
        challenge,
        null
    );

    RegistrationData registrationData = manager.parse(clientDataJSON, attestationObject);

    RegistrationParameters params = new RegistrationParameters(
        serverProperty,
        cmd.userVerificationRequired(),
        true
    );

    validator.validate(registrationData, params);

    var attested = registrationData.getAttestationObject()
        .getAuthenticatorData()
        .getAttestedCredentialData();

    String credentialId = b64urlEncode(attested.getCredentialId());
    String publicKeyCose = b64urlEncode(attested.getCOSEKey().getBytes());
    String aaguid = attested.getAaguid().toString();
    long signCount = registrationData.getAttestationObject()
        .getAuthenticatorData()
        .getSignCount();

    return new VerifiedRegistration(credentialId, publicKeyCose, aaguid, signCount);
  }

  private static byte[] b64urlDecode(String s) {
    if (s == null) throw new IllegalArgumentException("invalid base64url");
    String padded = s.replace('-', '+').replace('_', '/');
    int mod = padded.length() % 4;
    if (mod == 2) padded += "==";
    else if (mod == 3) padded += "=";
    else if (mod != 0) throw new IllegalArgumentException("invalid base64url");
    return Base64.getDecoder().decode(padded);
  }

  private static String b64urlEncode(byte[] bytes) {
    return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
  }
}
