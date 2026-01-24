package com.acme.passkeys.application.ports.in;

import com.acme.passkeys.adapters.in.function.dto.ChallengeRequest;
import com.acme.passkeys.adapters.in.function.dto.ChallengeResponse;

public interface CreateChallengeUseCase {
  ChallengeResponse handle(ChallengeRequest request);
}
