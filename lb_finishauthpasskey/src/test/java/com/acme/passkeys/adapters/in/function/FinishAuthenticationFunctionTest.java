package com.acme.passkeys.adapters.in.function;

import com.acme.passkeys.adapters.in.function.dto.FinishAuthenticationRequest;
import com.acme.passkeys.adapters.in.function.dto.FinishAuthenticationResponse;
import com.acme.passkeys.application.ports.in.FinishAuthenticationUseCase;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class FinishAuthenticationFunctionTest {

  @Test
  void delegatesToUseCase() {
    FinishAuthenticationUseCase uc = mock(FinishAuthenticationUseCase.class);

    FinishAuthenticationResponse expected =
        FinishAuthenticationResponse.ok(new FinishAuthenticationResponse.Data("cred"));

    when(uc.handle(any())).thenReturn(expected);

    FinishAuthenticationFunction fn = new FinishAuthenticationFunction(uc);

    FinishAuthenticationRequest req = new FinishAuthenticationRequest(null, null, null);

    FinishAuthenticationResponse res = fn.apply(req);

    assertThat(res).isEqualTo(expected);
    verify(uc).handle(req);
  }
}
