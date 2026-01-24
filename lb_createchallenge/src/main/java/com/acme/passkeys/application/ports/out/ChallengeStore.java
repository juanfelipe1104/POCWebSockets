package com.acme.passkeys.application.ports.out;

import com.acme.passkeys.domain.model.Challenge;

public interface ChallengeStore {
  void save(Challenge challenge);
}
