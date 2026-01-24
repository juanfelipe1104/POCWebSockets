package com.acme.passkeys.adapters.out.memory;

import com.acme.passkeys.application.ports.out.ChallengeStore;
import com.acme.passkeys.domain.model.Challenge;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class InMemoryChallengeStore implements ChallengeStore {
  private final Map<String, Challenge> db = new ConcurrentHashMap<>();

  @Override
  public void save(Challenge challenge) {
    db.put(challenge.id(), challenge);
  }

  public Challenge get(String id) {
    return db.get(id);
  }
}
