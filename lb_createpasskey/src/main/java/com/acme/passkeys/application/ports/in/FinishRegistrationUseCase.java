package com.acme.passkeys.application.ports.in;

import com.acme.passkeys.adapters.in.function.dto.FinishRegistrationRequest;
import com.acme.passkeys.adapters.in.function.dto.FinishRegistrationResponse;

public interface FinishRegistrationUseCase {
  FinishRegistrationResponse handle(FinishRegistrationRequest request);
}
