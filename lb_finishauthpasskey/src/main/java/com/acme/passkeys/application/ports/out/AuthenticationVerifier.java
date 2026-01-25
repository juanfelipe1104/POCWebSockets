package com.acme.passkeys.application.ports.out;

public interface AuthenticationVerifier {

  VerifiedAuthentication verify(VerifyAuthenticationCommand cmd);

  record VerifyAuthenticationCommand(
      String challengeB64Url,
      String rpId,
      String origin,
      boolean userVerificationRequired,

      String credentialIdB64Url,
      String publicKeyCoseB64Url,

      String clientDataJSONB64Url,
      String authenticatorDataB64Url,
      String signatureB64Url,
      String userHandleB64Url // puede ser null
  ) {}

  record VerifiedAuthentication(
      String credentialIdB64Url
  ) {}
}
