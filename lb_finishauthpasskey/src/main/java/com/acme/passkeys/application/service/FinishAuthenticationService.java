package com.acme.passkeys.application.service;

import com.acme.passkeys.adapters.in.function.dto.FinishAuthenticationRequest;
import com.acme.passkeys.adapters.in.function.dto.FinishAuthenticationResponse;
import com.acme.passkeys.application.ports.in.FinishAuthenticationUseCase;
import com.acme.passkeys.application.ports.out.AuthenticationVerifier;

public class FinishAuthenticationService implements FinishAuthenticationUseCase {

  private final AuthenticationVerifier verifier;

  public FinishAuthenticationService(AuthenticationVerifier verifier) {
    this.verifier = verifier;
  }

  @Override
  public FinishAuthenticationResponse handle(FinishAuthenticationRequest req) {
    try {
      validate(req);

      var cmd = new AuthenticationVerifier.VerifyAuthenticationCommand(
          req.server().challenge(),
          req.server().rpId(),
          req.server().origin(),
          req.server().userVerificationRequired(),

          req.credential().id(),
          req.storedCredential().publicKeyCose(),

          req.credential().response().clientDataJSON(),
          req.credential().response().authenticatorData(),
          req.credential().response().signature(),
          req.credential().response().userHandle()
      );

      var verified = verifier.verify(cmd);

      return FinishAuthenticationResponse.ok(new FinishAuthenticationResponse.Data(verified.credentialIdB64Url()));

    } catch (IllegalArgumentException e) {
      return FinishAuthenticationResponse.bad(e.getMessage());
    } catch (Exception e) {
      return FinishAuthenticationResponse.bad("authentication_validation_failed");
    }
  }

  private static void validate(FinishAuthenticationRequest req) {
    if (req == null) throw new IllegalArgumentException("request is required");
    if (req.server() == null) throw new IllegalArgumentException("server is required");
    if (blank(req.server().challenge())) throw new IllegalArgumentException("server.challenge is required");
    if (blank(req.server().rpId())) throw new IllegalArgumentException("server.rpId is required");
    if (blank(req.server().origin())) throw new IllegalArgumentException("server.origin is required");

    if (req.credential() == null) throw new IllegalArgumentException("credential is required");
    if (blank(req.credential().id())) throw new IllegalArgumentException("credential.id is required");
    if (req.credential().response() == null) throw new IllegalArgumentException("credential.response is required");
    if (blank(req.credential().response().clientDataJSON())) throw new IllegalArgumentException("clientDataJSON is required");
    if (blank(req.credential().response().authenticatorData())) throw new IllegalArgumentException("authenticatorData is required");
    if (blank(req.credential().response().signature())) throw new IllegalArgumentException("signature is required");

    if (req.storedCredential() == null) throw new IllegalArgumentException("storedCredential is required");
    if (blank(req.storedCredential().publicKeyCose())) throw new IllegalArgumentException("storedCredential.publicKeyCose is required");
  }

  private static boolean blank(String s) { return s == null || s.trim().isEmpty(); }
}
