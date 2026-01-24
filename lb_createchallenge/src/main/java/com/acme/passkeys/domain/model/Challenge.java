package com.acme.passkeys.domain.model;

import java.time.Instant;
import java.util.Objects;

public final class Challenge {
  private final String id; // transactionId
  private final String userId;
  private final ChallengeType type;
  private final String challengeB64Url;
  private final String rpId;
  private final String origin;
  private final long timeoutMs;
  private final Instant createdAt;
  private final Instant expiresAt;

  public Challenge(
      String id,
      String userId,
      ChallengeType type,
      String challengeB64Url,
      String rpId,
      String origin,
      long timeoutMs,
      Instant createdAt,
      Instant expiresAt
  ) {
    this.id = Objects.requireNonNull(id, "id");
    this.userId = Objects.requireNonNull(userId, "userId");
    this.type = Objects.requireNonNull(type, "type");
    this.challengeB64Url = Objects.requireNonNull(challengeB64Url, "challengeB64Url");
    this.rpId = Objects.requireNonNull(rpId, "rpId");
    this.origin = Objects.requireNonNull(origin, "origin");
    this.timeoutMs = timeoutMs;
    this.createdAt = Objects.requireNonNull(createdAt, "createdAt");
    this.expiresAt = Objects.requireNonNull(expiresAt, "expiresAt");
  }

  public String id() { return id; }
  public String userId() { return userId; }
  public ChallengeType type() { return type; }
  public String challengeB64Url() { return challengeB64Url; }
  public String rpId() { return rpId; }
  public String origin() { return origin; }
  public long timeoutMs() { return timeoutMs; }
  public Instant createdAt() { return createdAt; }
  public Instant expiresAt() { return expiresAt; }
}
