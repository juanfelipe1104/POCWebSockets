package com.acme.passkeys.adapters.in.function.dto;

public record FinishAuthenticationResponse(
    int code,
    String message,
    Data data
) {
  public record Data(
      String credentialId
  ) {}

  public static FinishAuthenticationResponse ok(Data data) {
    return new FinishAuthenticationResponse(200, "AUTHENTICATED", data);
  }

  public static FinishAuthenticationResponse bad(String msg) {
    return new FinishAuthenticationResponse(401, msg, null);
  }
}
