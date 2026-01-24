package com.acme.passkeys.adapters.in.function.dto;

import com.acme.passkeys.domain.model.Challenge;

import java.time.Instant;

public record ChallengeResponse(
    String transactionId,
    String type,
    String userId,
    String rpId,
    String origin,
    long timeoutMs,
    String challenge,
    Instant createdAt,
    Instant expiresAt
) {
  public static ChallengeResponse from(Challenge ch) {
    return new ChallengeResponse(
        ch.id(),
        ch.type().name(),
        ch.userId(),
        ch.rpId(),
        ch.origin(),
        ch.timeoutMs(),
        ch.challengeB64Url(),
        ch.createdAt(),
        ch.expiresAt()
    );
  }
}
