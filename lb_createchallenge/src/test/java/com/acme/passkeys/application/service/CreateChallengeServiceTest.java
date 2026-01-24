package com.acme.passkeys.application.service;

import com.acme.passkeys.adapters.in.function.dto.ChallengeRequest;
import com.acme.passkeys.application.ports.out.ChallengeStore;
import com.acme.passkeys.domain.service.ChallengeGenerator;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class CreateChallengeServiceTest {

  @Test
  void createsAndStoresChallenge_withDefaults() {
    ChallengeGenerator generator = mock(ChallengeGenerator.class);
    when(generator.generateBase64UrlChallenge(32)).thenReturn("CHALLENGE_B64URL");

    ChallengeStore store = mock(ChallengeStore.class);
    Clock fixed = Clock.fixed(Instant.parse("2026-01-24T10:00:00Z"), ZoneOffset.UTC);

    CreateChallengeService svc = new CreateChallengeService(generator, store, fixed);

    ChallengeRequest req = new ChallengeRequest(
        "REGISTRATION", "user-1", "example.com", "https://example.com", 60000,
        null, 0, 0
    );

    var res = svc.handle(req);

    assertThat(res.type()).isEqualTo("REGISTRATION");
    assertThat(res.userId()).isEqualTo("user-1");
    assertThat(res.rpId()).isEqualTo("example.com");
    assertThat(res.origin()).isEqualTo("https://example.com");
    assertThat(res.timeoutMs()).isEqualTo(60000);
    assertThat(res.challenge()).isEqualTo("CHALLENGE_B64URL");
    assertThat(res.createdAt()).isEqualTo(Instant.parse("2026-01-24T10:00:00Z"));
    assertThat(res.expiresAt()).isEqualTo(Instant.parse("2026-01-24T10:02:00Z"));

    ArgumentCaptor<com.acme.passkeys.domain.model.Challenge> captor =
        ArgumentCaptor.forClass(com.acme.passkeys.domain.model.Challenge.class);
    verify(store).save(captor.capture());
    assertThat(captor.getValue().challengeB64Url()).isEqualTo("CHALLENGE_B64URL");
  }

  @Test
  void usesProvidedTransactionId() {
    ChallengeGenerator generator = mock(ChallengeGenerator.class);
    when(generator.generateBase64UrlChallenge(32)).thenReturn("C");

    ChallengeStore store = mock(ChallengeStore.class);
    Clock fixed = Clock.fixed(Instant.parse("2026-01-24T10:00:00Z"), ZoneOffset.UTC);

    CreateChallengeService svc = new CreateChallengeService(generator, store, fixed);

    ChallengeRequest req = new ChallengeRequest(
        "AUTHENTICATION", "user-1", "example.com", "https://example.com", 5000,
        "tx-123", 120, 32
    );

    var res = svc.handle(req);
    assertThat(res.transactionId()).isEqualTo("tx-123");
    verify(store).save(any());
  }

  @Test
  void validationFails_whenMissingUserId() {
    CreateChallengeService svc = new CreateChallengeService(
        mock(ChallengeGenerator.class),
        mock(ChallengeStore.class),
        Clock.systemUTC()
    );

    ChallengeRequest bad = new ChallengeRequest(
        "AUTHENTICATION", "   ", "example.com", "https://example.com", 1000,
        null, 120, 32
    );

    assertThatThrownBy(() -> svc.handle(bad))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("userId");
  }

  @Test
  void validationFails_whenTtlOutOfRange() {
    CreateChallengeService svc = new CreateChallengeService(
        mock(ChallengeGenerator.class),
        mock(ChallengeStore.class),
        Clock.systemUTC()
    );

    ChallengeRequest bad = new ChallengeRequest(
        "AUTHENTICATION", "user-1", "example.com", "https://example.com", 1000,
        null, 9999, 32
    );

    assertThatThrownBy(() -> svc.handle(bad))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("ttlSeconds");
  }

  @Test
  void validationFails_whenChallengeBytesOutOfRange() {
    CreateChallengeService svc = new CreateChallengeService(
        mock(ChallengeGenerator.class),
        mock(ChallengeStore.class),
        Clock.systemUTC()
    );

    ChallengeRequest bad = new ChallengeRequest(
        "AUTHENTICATION", "user-1", "example.com", "https://example.com", 1000,
        null, 120, 8
    );

    assertThatThrownBy(() -> svc.handle(bad))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("challengeBytes");
  }
}
