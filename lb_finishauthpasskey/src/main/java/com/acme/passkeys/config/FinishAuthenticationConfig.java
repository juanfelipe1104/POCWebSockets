package com.acme.passkeys.config;

import com.acme.passkeys.adapters.in.function.FinishAuthenticationFunction;
import com.acme.passkeys.adapters.in.function.dto.FinishAuthenticationRequest;
import com.acme.passkeys.adapters.in.function.dto.FinishAuthenticationResponse;
import com.acme.passkeys.adapters.out.webauthn4j.WebAuthn4jAuthenticationVerifier;
import com.acme.passkeys.application.ports.in.FinishAuthenticationUseCase;
import com.acme.passkeys.application.ports.out.AuthenticationVerifier;
import com.acme.passkeys.application.service.FinishAuthenticationService;
import com.webauthn4j.WebAuthnManager;
import com.webauthn4j.validator.AuthenticationDataValidator;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.function.Function;

@Configuration
public class FinishAuthenticationConfig {

  @Bean
  public WebAuthnManager webAuthnManager() {
    return WebAuthnManager.createNonStrictWebAuthnManager();
  }

  @Bean
  public AuthenticationDataValidator authenticationDataValidator() {
    return new AuthenticationDataValidator();
  }

  @Bean
  public AuthenticationVerifier authenticationVerifier(WebAuthnManager m, AuthenticationDataValidator v) {
    return new WebAuthn4jAuthenticationVerifier(m, v);
  }

  @Bean
  public FinishAuthenticationUseCase finishAuthenticationUseCase(AuthenticationVerifier verifier) {
    return new FinishAuthenticationService(verifier);
  }

  @Bean(name = "finishAuthentication")
  public Function<FinishAuthenticationRequest, FinishAuthenticationResponse> finishAuthentication(FinishAuthenticationUseCase uc) {
    return new FinishAuthenticationFunction(uc);
  }
}
