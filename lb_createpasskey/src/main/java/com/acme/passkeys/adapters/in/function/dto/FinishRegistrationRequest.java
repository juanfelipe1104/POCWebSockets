package com.acme.passkeys.adapters.in.function.dto;

public record FinishRegistrationRequest(
    Server server,
    Credential credential
) {
  public record Server(
      String challenge, // base64url
      String rpId,
      String origin,
      boolean userVerificationRequired
  ) {}

  public record Credential(
      String id,
      String rawId,
      String type,
      Response response
  ) {
    public record Response(
        String clientDataJSON,     // base64url
        String attestationObject   // base64url
    ) {}
  }
}
