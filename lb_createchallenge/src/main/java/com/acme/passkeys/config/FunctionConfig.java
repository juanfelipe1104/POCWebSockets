package com.acme.passkeys.config;

import com.acme.passkeys.adapters.in.function.CreateChallengeFunction;
import com.acme.passkeys.adapters.in.function.dto.ChallengeRequest;
import com.acme.passkeys.adapters.in.function.dto.ChallengeResponse;
import com.acme.passkeys.adapters.out.memory.InMemoryChallengeStore;
import com.acme.passkeys.application.ports.in.CreateChallengeUseCase;
import com.acme.passkeys.application.ports.out.ChallengeStore;
import com.acme.passkeys.application.service.CreateChallengeService;
import com.acme.passkeys.domain.service.ChallengeGenerator;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.security.SecureRandom;
import java.time.Clock;
import java.util.function.Function;

@Configuration
public class FunctionConfig {

  @Bean
  public SecureRandom secureRandom() {
    return new SecureRandom();
  }

  @Bean
  public ChallengeGenerator challengeGenerator(SecureRandom secureRandom) {
    return new ChallengeGenerator(secureRandom);
  }

  @Bean
  public Clock clock() {
    return Clock.systemUTC();
  }

  @Bean
  public ChallengeStore challengeStore() {
    // En producción reemplazas por un adapter DynamoDB que implemente ChallengeStore
    return new InMemoryChallengeStore();
  }

  @Bean
  public CreateChallengeUseCase createChallengeUseCase(
      ChallengeGenerator generator,
      ChallengeStore store,
      Clock clock
  ) {
    return new CreateChallengeService(generator, store, clock);
  }

  @Bean(name = "createChallenge")
  public Function<ChallengeRequest, ChallengeResponse> createChallenge(CreateChallengeUseCase useCase) {
    return new CreateChallengeFunction(useCase);
  }
}
