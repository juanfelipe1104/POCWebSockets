package com.acme.passkeys.adapters.in.function;

import com.acme.passkeys.adapters.in.function.dto.ChallengeRequest;
import com.acme.passkeys.adapters.in.function.dto.ChallengeResponse;
import com.acme.passkeys.application.ports.in.CreateChallengeUseCase;

import java.util.function.Function;

public class CreateChallengeFunction implements Function<ChallengeRequest, ChallengeResponse> {

  private final CreateChallengeUseCase useCase;

  public CreateChallengeFunction(CreateChallengeUseCase useCase) {
    this.useCase = useCase;
  }

  @Override
  public ChallengeResponse apply(ChallengeRequest request) {
    return useCase.handle(request);
  }
}
