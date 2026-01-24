package com.acme.passkeys.application.service;

import com.acme.passkeys.adapters.in.function.dto.ChallengeRequest;
import com.acme.passkeys.adapters.in.function.dto.ChallengeResponse;
import com.acme.passkeys.application.ports.in.CreateChallengeUseCase;
import com.acme.passkeys.application.ports.out.ChallengeStore;
import com.acme.passkeys.domain.model.Challenge;
import com.acme.passkeys.domain.model.ChallengeType;
import com.acme.passkeys.domain.service.ChallengeGenerator;

import java.time.Clock;
import java.time.Instant;
import java.util.Locale;
import java.util.UUID;

public class CreateChallengeService implements CreateChallengeUseCase {

  private final ChallengeGenerator generator;
  private final ChallengeStore store;
  private final Clock clock;

  public CreateChallengeService(ChallengeGenerator generator, ChallengeStore store, Clock clock) {
    this.generator = generator;
    this.store = store;
    this.clock = clock;
  }

  @Override
  public ChallengeResponse handle(ChallengeRequest request) {
    validate(request);

    ChallengeType type = ChallengeType.valueOf(request.type().toUpperCase(Locale.ROOT));
    String challenge = generator.generateBase64UrlChallenge(request.challengeBytes());

    Instant now = Instant.now(clock);
    Instant expiresAt = now.plusSeconds(request.ttlSeconds());

    String transactionId = (request.transactionId() == null || request.transactionId().isBlank())
        ? UUID.randomUUID().toString()
        : request.transactionId();

    Challenge ch = new Challenge(
        transactionId,
        request.userId(),
        type,
        challenge,
        request.rpId(),
        request.origin(),
        request.timeoutMs(),
        now,
        expiresAt
    );

    store.save(ch);
    return ChallengeResponse.from(ch);
  }

  private static void validate(ChallengeRequest r) {
    if (r == null) throw new IllegalArgumentException("Request is required");
    if (isBlank(r.userId())) throw new IllegalArgumentException("userId is required");
    if (isBlank(r.rpId())) throw new IllegalArgumentException("rpId is required");
    if (isBlank(r.origin())) throw new IllegalArgumentException("origin is required");
    if (isBlank(r.type())) throw new IllegalArgumentException("type is required (REGISTRATION|AUTHENTICATION)");
    if (r.timeoutMs() <= 0) throw new IllegalArgumentException("timeoutMs must be > 0");
    if (r.ttlSeconds() <= 0 || r.ttlSeconds() > 600) throw new IllegalArgumentException("ttlSeconds must be 1..600");
    if (r.challengeBytes() < 16 || r.challengeBytes() > 64) throw new IllegalArgumentException("challengeBytes must be 16..64");
  }

  private static boolean isBlank(String s) {
    return s == null || s.trim().isEmpty();
  }
}
