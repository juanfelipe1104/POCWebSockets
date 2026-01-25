package com.acme.passkeys.adapters.in.function.dto;

public record FinishRegistrationResponse(
    int code,
    String message,
    Data data
) {
  public record Data(
      String credentialId,
      String publicKeyCose,
      String aaguid,
      long signCount
  ) {}

  public static FinishRegistrationResponse ok(Data data) {
    return new FinishRegistrationResponse(200, "PASSKEY_CREATED", data);
  }

  public static FinishRegistrationResponse bad(String msg) {
    return new FinishRegistrationResponse(400, msg, null);
  }
}
