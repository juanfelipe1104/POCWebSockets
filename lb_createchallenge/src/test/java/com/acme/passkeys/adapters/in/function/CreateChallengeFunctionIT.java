package com.acme.passkeys.adapters.in.function;

import com.acme.passkeys.Application;
import com.acme.passkeys.adapters.in.function.dto.ChallengeRequest;
import com.acme.passkeys.adapters.in.function.dto.ChallengeResponse;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.cloud.function.context.FunctionCatalog;

import java.util.function.Function;

import static org.assertj.core.api.Assertions.*;

@SpringBootTest(classes = Application.class)
class CreateChallengeFunctionIT {

  @Autowired
  FunctionCatalog catalog;

  @Test
  void functionIsWired_andReturnsResponse() {
    @SuppressWarnings("unchecked")
    Function<ChallengeRequest, ChallengeResponse> fn =
        (Function<ChallengeRequest, ChallengeResponse>) catalog.lookup("createChallenge");

    assertThat(fn).isNotNull();

    ChallengeRequest req = new ChallengeRequest(
        "AUTHENTICATION", "user-99", "example.com", "https://example.com", 45000,
        "tx-123", 120, 32
    );

    ChallengeResponse res = fn.apply(req);

    assertThat(res.transactionId()).isEqualTo("tx-123");
    assertThat(res.challenge()).isNotBlank();
    assertThat(res.type()).isEqualTo("AUTHENTICATION");
    assertThat(res.rpId()).isEqualTo("example.com");
  }
}
