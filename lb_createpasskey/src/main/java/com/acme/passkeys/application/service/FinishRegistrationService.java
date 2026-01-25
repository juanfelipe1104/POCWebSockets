package com.acme.passkeys.application.service;

import com.acme.passkeys.adapters.in.function.dto.FinishRegistrationRequest;
import com.acme.passkeys.adapters.in.function.dto.FinishRegistrationResponse;
import com.acme.passkeys.application.ports.in.FinishRegistrationUseCase;
import com.acme.passkeys.application.ports.out.RegistrationVerifier;

public class FinishRegistrationService implements FinishRegistrationUseCase {

  private final RegistrationVerifier verifier;

  public FinishRegistrationService(RegistrationVerifier verifier) {
    this.verifier = verifier;
  }

  @Override
  public FinishRegistrationResponse handle(FinishRegistrationRequest req) {
    try {
      validate(req);

      var cmd = new RegistrationVerifier.VerifyRegistrationCommand(
          req.server().challenge(),
          req.server().rpId(),
          req.server().origin(),
          req.server().userVerificationRequired(),
          req.credential().response().clientDataJSON(),
          req.credential().response().attestationObject()
      );

      var verified = verifier.verify(cmd);

      var data = new FinishRegistrationResponse.Data(
          verified.credentialIdB64Url(),
          verified.publicKeyCoseB64Url(),
          verified.aaguid(),
          verified.signCount()
      );

      return FinishRegistrationResponse.ok(data);

    } catch (IllegalArgumentException e) {
      return FinishRegistrationResponse.bad(e.getMessage());
    } catch (Exception e) {
      return FinishRegistrationResponse.bad("registration_validation_failed");
    }
  }

  private static void validate(FinishRegistrationRequest req) {
    if (req == null) throw new IllegalArgumentException("request is required");
    if (req.server() == null) throw new IllegalArgumentException("server is required");
    if (blank(req.server().challenge())) throw new IllegalArgumentException("server.challenge is required");
    if (blank(req.server().rpId())) throw new IllegalArgumentException("server.rpId is required");
    if (blank(req.server().origin())) throw new IllegalArgumentException("server.origin is required");
    if (req.credential() == null) throw new IllegalArgumentException("credential is required");
    if (req.credential().response() == null) throw new IllegalArgumentException("credential.response is required");
    if (blank(req.credential().response().clientDataJSON())) throw new IllegalArgumentException("clientDataJSON is required");
    if (blank(req.credential().response().attestationObject())) throw new IllegalArgumentException("attestationObject is required");
  }

  private static boolean blank(String s) { return s == null || s.trim().isEmpty(); }
}
