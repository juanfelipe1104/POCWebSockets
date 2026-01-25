package com.acme.passkeys.config;

import com.acme.passkeys.adapters.in.function.FinishRegistrationFunction;
import com.acme.passkeys.adapters.in.function.dto.FinishRegistrationRequest;
import com.acme.passkeys.adapters.in.function.dto.FinishRegistrationResponse;
import com.acme.passkeys.adapters.out.webauthn4j.WebAuthn4jRegistrationVerifier;
import com.acme.passkeys.application.ports.in.FinishRegistrationUseCase;
import com.acme.passkeys.application.ports.out.RegistrationVerifier;
import com.acme.passkeys.application.service.FinishRegistrationService;
import com.webauthn4j.WebAuthnManager;
import com.webauthn4j.validator.RegistrationDataValidator;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.function.Function;

@Configuration
public class FinishRegistrationConfig {

  @Bean
  public WebAuthnManager webAuthnManager() {
    return WebAuthnManager.createNonStrictWebAuthnManager();
  }

  @Bean
  public RegistrationDataValidator registrationDataValidator() {
    return new RegistrationDataValidator();
  }

  @Bean
  public RegistrationVerifier registrationVerifier(WebAuthnManager m, RegistrationDataValidator v) {
    return new WebAuthn4jRegistrationVerifier(m, v);
  }

  @Bean
  public FinishRegistrationUseCase finishRegistrationUseCase(RegistrationVerifier verifier) {
    return new FinishRegistrationService(verifier);
  }

  @Bean(name = "finishRegistration")
  public Function<FinishRegistrationRequest, FinishRegistrationResponse> finishRegistration(FinishRegistrationUseCase uc) {
    return new FinishRegistrationFunction(uc);
  }
}
