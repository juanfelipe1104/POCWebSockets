package com.acme.passkeys.application.ports.out;

public interface RegistrationVerifier {

  VerifiedRegistration verify(VerifyRegistrationCommand cmd);

  record VerifyRegistrationCommand(
      String challengeB64Url,
      String rpId,
      String origin,
      boolean userVerificationRequired,
      String clientDataJSONB64Url,
      String attestationObjectB64Url
  ) {}

  record VerifiedRegistration(
      String credentialIdB64Url,
      String publicKeyCoseB64Url,
      String aaguid,
      long signCount
  ) {}
}
