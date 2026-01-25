package com.acme.passkeys.adapters.in.function;

import com.acme.passkeys.Application;
import com.acme.passkeys.adapters.in.function.dto.FinishAuthenticationRequest;
import com.acme.passkeys.adapters.in.function.dto.FinishAuthenticationResponse;
import com.acme.passkeys.application.ports.out.AuthenticationVerifier;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.cloud.function.context.FunctionCatalog;
import org.springframework.context.annotation.Bean;

import java.util.function.Function;

import static org.assertj.core.api.Assertions.*;

@SpringBootTest(classes = {Application.class, FinishAuthenticationFunctionIT.TestCfg.class})
class FinishAuthenticationFunctionIT {

  @Autowired
  FunctionCatalog catalog;

  @Test
  void functionIsWired_andReturnsOk() {
    @SuppressWarnings("unchecked")
    Function<FinishAuthenticationRequest, FinishAuthenticationResponse> fn =
        (Function<FinishAuthenticationRequest, FinishAuthenticationResponse>) catalog.lookup("finishAuthentication");

    assertThat(fn).isNotNull();

    FinishAuthenticationRequest req = new FinishAuthenticationRequest(
        new FinishAuthenticationRequest.Server("challenge", "example.com", "https://example.com", true),
        new FinishAuthenticationRequest.Credential(
            "credId", "public-key",
            new FinishAuthenticationRequest.Credential.Response("clientData", "authData", "sig", null)
        ),
        new FinishAuthenticationRequest.StoredCredential("publicKeyCose")
    );

    FinishAuthenticationResponse res = fn.apply(req);

    assertThat(res.code()).isEqualTo(200);
    assertThat(res.data()).isNotNull();
    assertThat(res.data().credentialId()).isEqualTo("cred");
  }

  @TestConfiguration
  static class TestCfg {
    @Bean
    public AuthenticationVerifier authenticationVerifier() {
      return cmd -> new AuthenticationVerifier.VerifiedAuthentication("cred");
    }
  }
}
