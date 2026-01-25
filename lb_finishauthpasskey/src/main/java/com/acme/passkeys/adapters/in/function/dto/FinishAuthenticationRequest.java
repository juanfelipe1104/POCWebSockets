package com.acme.passkeys.adapters.in.function.dto;

public record FinishAuthenticationRequest(
    Server server,
    Credential credential,
    StoredCredential storedCredential
) {
  public record Server(
      String challenge, // base64url
      String rpId,
      String origin,
      boolean userVerificationRequired
  ) {}

  public record Credential(
      String id,     // credentialId base64url
      String type,   // "public-key"
      Response response
  ) {
    public record Response(
        String clientDataJSON,      // base64url
        String authenticatorData,   // base64url
        String signature,           // base64url
        String userHandle           // base64url o null
    ) {}
  }

  public record StoredCredential(
      String publicKeyCose // base64url
  ) {}
}
