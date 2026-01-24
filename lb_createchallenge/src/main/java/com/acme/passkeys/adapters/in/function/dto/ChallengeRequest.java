package com.acme.passkeys.adapters.in.function.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record ChallengeRequest(
    @JsonProperty("type") String type,                 // "REGISTRATION" | "AUTHENTICATION"
    @JsonProperty("userId") String userId,
    @JsonProperty("rpId") String rpId,
    @JsonProperty("origin") String origin,
    @JsonProperty("timeoutMs") long timeoutMs,

    // opcionales
    @JsonProperty("transactionId") String transactionId,
    @JsonProperty("ttlSeconds") long ttlSeconds,
    @JsonProperty("challengeBytes") int challengeBytes
) {
  public long ttlSeconds() { return ttlSeconds == 0 ? 120 : ttlSeconds; }          // default 120s
  public int challengeBytes() { return challengeBytes == 0 ? 32 : challengeBytes; } // default 32 bytes
}
