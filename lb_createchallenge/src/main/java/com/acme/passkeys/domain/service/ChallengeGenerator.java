package com.acme.passkeys.domain.service;

import java.security.SecureRandom;
import java.util.Base64;

public class ChallengeGenerator {
  private final SecureRandom secureRandom;

  public ChallengeGenerator(SecureRandom secureRandom) {
    this.secureRandom = secureRandom;
  }

  public String generateBase64UrlChallenge(int bytes) {
    if (bytes < 16) {
      throw new IllegalArgumentException("Challenge bytes must be >= 16");
    }
    byte[] buf = new byte[bytes];
    secureRandom.nextBytes(buf);
    return Base64.getUrlEncoder().withoutPadding().encodeToString(buf);
  }
}
