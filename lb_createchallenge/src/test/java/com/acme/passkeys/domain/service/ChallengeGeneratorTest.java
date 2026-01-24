package com.acme.passkeys.domain.service;

import org.junit.jupiter.api.Test;

import java.security.SecureRandom;

import static org.assertj.core.api.Assertions.*;

class ChallengeGeneratorTest {

  @Test
  void generatesBase64UrlWithoutPadding() {
    ChallengeGenerator gen = new ChallengeGenerator(new SecureRandom());
    String c = gen.generateBase64UrlChallenge(32);

    assertThat(c).isNotBlank();
    assertThat(c).doesNotContain("=");
  }

  @Test
  void rejectsTooSmallBytes() {
    ChallengeGenerator gen = new ChallengeGenerator(new SecureRandom());
    assertThatThrownBy(() -> gen.generateBase64UrlChallenge(8))
        .isInstanceOf(IllegalArgumentException.class);
  }
}
