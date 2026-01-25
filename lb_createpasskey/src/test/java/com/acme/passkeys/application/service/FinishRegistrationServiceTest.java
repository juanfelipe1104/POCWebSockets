package com.acme.passkeys.application.service;

import com.acme.passkeys.adapters.in.function.dto.FinishRegistrationRequest;
import com.acme.passkeys.adapters.in.function.dto.FinishRegistrationResponse;
import com.acme.passkeys.application.ports.out.RegistrationVerifier;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class FinishRegistrationServiceTest {

  @Test
  void returnsOk_withData_whenVerificationSucceeds() {
    RegistrationVerifier verifier = mock(RegistrationVerifier.class);

    when(verifier.verify(any())).thenReturn(
        new RegistrationVerifier.VerifiedRegistration(
            "credId",
            "coseKey",
            "00000000-0000-0000-0000-000000000000",
            12L
        )
    );

    FinishRegistrationService svc = new FinishRegistrationService(verifier);

    FinishRegistrationResponse res = svc.handle(sampleReq());

    assertThat(res.code()).isEqualTo(200);
    assertThat(res.message()).isEqualTo("PASSKEY_CREATED");
    assertThat(res.data()).isNotNull();
    assertThat(res.data().credentialId()).isEqualTo("credId");
    assertThat(res.data().publicKeyCose()).isEqualTo("coseKey");
    assertThat(res.data().aaguid()).isEqualTo("00000000-0000-0000-0000-000000000000");
    assertThat(res.data().signCount()).isEqualTo(12L);

    verify(verifier).verify(any());
  }

  @Test
  void returns400_whenMissingChallenge() {
    RegistrationVerifier verifier = mock(RegistrationVerifier.class);
    FinishRegistrationService svc = new FinishRegistrationService(verifier);

    FinishRegistrationRequest bad = new FinishRegistrationRequest(
        new FinishRegistrationRequest.Server("  ", "example.com", "https://example.com", true),
        sampleReq().credential()
    );

    FinishRegistrationResponse res = svc.handle(bad);

    assertThat(res.code()).isEqualTo(400);
    assertThat(res.message()).contains("server.challenge");
    assertThat(res.data()).isNull();
    verifyNoInteractions(verifier);
  }

  @Test
  void returns400_whenMissingClientDataJSON() {
    RegistrationVerifier verifier = mock(RegistrationVerifier.class);
    FinishRegistrationService svc = new FinishRegistrationService(verifier);

    FinishRegistrationRequest bad = new FinishRegistrationRequest(
        sampleReq().server(),
        new FinishRegistrationRequest.Credential(
            "id","rawId","public-key",
            new FinishRegistrationRequest.Credential.Response(" ", "attObj")
        )
    );

    FinishRegistrationResponse res = svc.handle(bad);

    assertThat(res.code()).isEqualTo(400);
    assertThat(res.message()).contains("clientDataJSON");
    verifyNoInteractions(verifier);
  }

  @Test
  void returns400_whenVerifierThrowsIllegalArgument() {
    RegistrationVerifier verifier = mock(RegistrationVerifier.class);
    when(verifier.verify(any())).thenThrow(new IllegalArgumentException("invalid base64url"));

    FinishRegistrationService svc = new FinishRegistrationService(verifier);

    FinishRegistrationResponse res = svc.handle(sampleReq());

    assertThat(res.code()).isEqualTo(400);
    assertThat(res.message()).contains("invalid base64url");
    assertThat(res.data()).isNull();
  }

  @Test
  void returns400_generic_whenVerifierThrowsUnexpected() {
    RegistrationVerifier verifier = mock(RegistrationVerifier.class);
    when(verifier.verify(any())).thenThrow(new RuntimeException("boom"));

    FinishRegistrationService svc = new FinishRegistrationService(verifier);

    FinishRegistrationResponse res = svc.handle(sampleReq());

    assertThat(res.code()).isEqualTo(400);
    assertThat(res.message()).isEqualTo("registration_validation_failed");
    assertThat(res.data()).isNull();
  }

  private static FinishRegistrationRequest sampleReq() {
    return new FinishRegistrationRequest(
        new FinishRegistrationRequest.Server("challengeB64Url", "example.com", "https://example.com", true),
        new FinishRegistrationRequest.Credential(
            "id", "rawId", "public-key",
            new FinishRegistrationRequest.Credential.Response("clientData", "attObj")
        )
    );
  }
}
