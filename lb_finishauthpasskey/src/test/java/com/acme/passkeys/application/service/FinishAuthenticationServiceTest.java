package com.acme.passkeys.application.service;

import com.acme.passkeys.adapters.in.function.dto.FinishAuthenticationRequest;
import com.acme.passkeys.adapters.in.function.dto.FinishAuthenticationResponse;
import com.acme.passkeys.application.ports.out.AuthenticationVerifier;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class FinishAuthenticationServiceTest {

  @Test
  void returnsOk_whenVerificationSucceeds() {
    AuthenticationVerifier verifier = mock(AuthenticationVerifier.class);
    when(verifier.verify(any())).thenReturn(new AuthenticationVerifier.VerifiedAuthentication("credId"));

    FinishAuthenticationService svc = new FinishAuthenticationService(verifier);

    FinishAuthenticationResponse res = svc.handle(sampleReq());

    assertThat(res.code()).isEqualTo(200);
    assertThat(res.message()).isEqualTo("AUTHENTICATED");
    assertThat(res.data()).isNotNull();
    assertThat(res.data().credentialId()).isEqualTo("credId");

    verify(verifier).verify(any());
  }

  @Test
  void returns401_whenMissingCredentialId() {
    AuthenticationVerifier verifier = mock(AuthenticationVerifier.class);
    FinishAuthenticationService svc = new FinishAuthenticationService(verifier);

    FinishAuthenticationRequest bad = new FinishAuthenticationRequest(
        sampleReq().server(),
        new FinishAuthenticationRequest.Credential(" ", "public-key", sampleReq().credential().response()),
        sampleReq().storedCredential()
    );

    FinishAuthenticationResponse res = svc.handle(bad);

    assertThat(res.code()).isEqualTo(401);
    assertThat(res.message()).contains("credential.id");
    assertThat(res.data()).isNull();
    verifyNoInteractions(verifier);
  }

  @Test
  void returns401_whenMissingPublicKeyCose() {
    AuthenticationVerifier verifier = mock(AuthenticationVerifier.class);
    FinishAuthenticationService svc = new FinishAuthenticationService(verifier);

    FinishAuthenticationRequest bad = new FinishAuthenticationRequest(
        sampleReq().server(),
        sampleReq().credential(),
        new FinishAuthenticationRequest.StoredCredential(" ")
    );

    FinishAuthenticationResponse res = svc.handle(bad);

    assertThat(res.code()).isEqualTo(401);
    assertThat(res.message()).contains("storedCredential.publicKeyCose");
    verifyNoInteractions(verifier);
  }

  @Test
  void returns401_whenVerifierThrowsIllegalArgument() {
    AuthenticationVerifier verifier = mock(AuthenticationVerifier.class);
    when(verifier.verify(any())).thenThrow(new IllegalArgumentException("invalid base64url"));

    FinishAuthenticationService svc = new FinishAuthenticationService(verifier);

    FinishAuthenticationResponse res = svc.handle(sampleReq());

    assertThat(res.code()).isEqualTo(401);
    assertThat(res.message()).contains("invalid base64url");
    assertThat(res.data()).isNull();
  }

  @Test
  void returns401_generic_whenVerifierThrowsUnexpected() {
    AuthenticationVerifier verifier = mock(AuthenticationVerifier.class);
    when(verifier.verify(any())).thenThrow(new RuntimeException("boom"));

    FinishAuthenticationService svc = new FinishAuthenticationService(verifier);

    FinishAuthenticationResponse res = svc.handle(sampleReq());

    assertThat(res.code()).isEqualTo(401);
    assertThat(res.message()).isEqualTo("authentication_validation_failed");
    assertThat(res.data()).isNull();
  }

  private static FinishAuthenticationRequest sampleReq() {
    return new FinishAuthenticationRequest(
        new FinishAuthenticationRequest.Server("challengeB64Url", "example.com", "https://example.com", true),
        new FinishAuthenticationRequest.Credential(
            "credId", "public-key",
            new FinishAuthenticationRequest.Credential.Response("clientData", "authData", "sig", null)
        ),
        new FinishAuthenticationRequest.StoredCredential("publicKeyCose")
    );
  }
}
