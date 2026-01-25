package com.acme.passkeys.adapters.in.function;

import com.acme.passkeys.adapters.in.function.dto.FinishRegistrationRequest;
import com.acme.passkeys.adapters.in.function.dto.FinishRegistrationResponse;
import com.acme.passkeys.application.ports.in.FinishRegistrationUseCase;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class FinishRegistrationFunctionTest {

  @Test
  void delegatesToUseCase() {
    FinishRegistrationUseCase uc = mock(FinishRegistrationUseCase.class);

    FinishRegistrationResponse expected =
        FinishRegistrationResponse.ok(new FinishRegistrationResponse.Data("c","p","a",0));

    when(uc.handle(any())).thenReturn(expected);

    FinishRegistrationFunction fn = new FinishRegistrationFunction(uc);

    FinishRegistrationRequest req = new FinishRegistrationRequest(null, null);

    FinishRegistrationResponse res = fn.apply(req);

    assertThat(res).isEqualTo(expected);
    verify(uc).handle(req);
  }
}
