package com.acme.passkeys.adapters.in.function;

import com.acme.passkeys.adapters.in.function.dto.FinishAuthenticationRequest;
import com.acme.passkeys.adapters.in.function.dto.FinishAuthenticationResponse;
import com.acme.passkeys.application.ports.in.FinishAuthenticationUseCase;

import java.util.function.Function;

public class FinishAuthenticationFunction implements Function<FinishAuthenticationRequest, FinishAuthenticationResponse> {

  private final FinishAuthenticationUseCase useCase;

  public FinishAuthenticationFunction(FinishAuthenticationUseCase useCase) {
    this.useCase = useCase;
  }

  @Override
  public FinishAuthenticationResponse apply(FinishAuthenticationRequest req) {
    return useCase.handle(req);
  }
}
