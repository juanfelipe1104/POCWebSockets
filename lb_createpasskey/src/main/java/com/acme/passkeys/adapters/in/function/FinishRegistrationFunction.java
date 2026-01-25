package com.acme.passkeys.adapters.in.function;

import com.acme.passkeys.adapters.in.function.dto.FinishRegistrationRequest;
import com.acme.passkeys.adapters.in.function.dto.FinishRegistrationResponse;
import com.acme.passkeys.application.ports.in.FinishRegistrationUseCase;

import java.util.function.Function;

public class FinishRegistrationFunction implements Function<FinishRegistrationRequest, FinishRegistrationResponse> {

  private final FinishRegistrationUseCase useCase;

  public FinishRegistrationFunction(FinishRegistrationUseCase useCase) {
    this.useCase = useCase;
  }

  @Override
  public FinishRegistrationResponse apply(FinishRegistrationRequest req) {
    return useCase.handle(req);
  }
}
