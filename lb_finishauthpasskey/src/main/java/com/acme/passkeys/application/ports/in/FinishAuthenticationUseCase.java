package com.acme.passkeys.application.ports.in;

import com.acme.passkeys.adapters.in.function.dto.FinishAuthenticationRequest;
import com.acme.passkeys.adapters.in.function.dto.FinishAuthenticationResponse;

public interface FinishAuthenticationUseCase {
  FinishAuthenticationResponse handle(FinishAuthenticationRequest request);
}
