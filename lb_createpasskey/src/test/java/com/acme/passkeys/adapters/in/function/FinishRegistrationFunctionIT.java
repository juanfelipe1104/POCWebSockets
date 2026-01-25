package com.acme.passkeys.adapters.in.function;

import com.acme.passkeys.Application;
import com.acme.passkeys.adapters.in.function.dto.FinishRegistrationRequest;
import com.acme.passkeys.adapters.in.function.dto.FinishRegistrationResponse;
import com.acme.passkeys.application.ports.out.RegistrationVerifier;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.cloud.function.context.FunctionCatalog;
import org.springframework.context.annotation.Bean;

import java.util.function.Function;

import static org.assertj.core.api.Assertions.*;

@SpringBootTest(classes = {Application.class, FinishRegistrationFunctionIT.TestCfg.class})
class FinishRegistrationFunctionIT {

  @Autowired
  FunctionCatalog catalog;

  @Test
  void functionIsWired_andReturnsOk() {
    @SuppressWarnings("unchecked")
    Function<FinishRegistrationRequest, FinishRegistrationResponse> fn =
        (Function<FinishRegistrationRequest, FinishRegistrationResponse>) catalog.lookup("finishRegistration");

    assertThat(fn).isNotNull();

    FinishRegistrationRequest req = new FinishRegistrationRequest(
        new FinishRegistrationRequest.Server("challenge", "example.com", "https://example.com", true),
        new FinishRegistrationRequest.Credential(
            "id","rawId","public-key",
            new FinishRegistrationRequest.Credential.Response("clientData","attObj")
        )
    );

    FinishRegistrationResponse res = fn.apply(req);

    assertThat(res.code()).isEqualTo(200);
    assertThat(res.data()).isNotNull();
    assertThat(res.data().credentialId()).isEqualTo("cred");
    assertThat(res.data().publicKeyCose()).isEqualTo("cose");
  }

  @TestConfiguration
  static class TestCfg {
    @Bean
    public RegistrationVerifier registrationVerifier() {
      return cmd -> new RegistrationVerifier.VerifiedRegistration(
          "cred", "cose", "00000000-0000-0000-0000-000000000000", 0L
      );
    }
  }
}
