# passkey-webauthn-lambda (Java 21)

Lambda Java 21 + Spring Cloud Function (AWS adapter) + webauthn4j para validar creación de passkey (FinishRegistration).

## Build (fat jar con dependencias incluidas)
```bash
mvn -q clean package
```
Salida: `target/passkey-webauthn-lambda-1.0.0.jar` (incluye todas las librerías)

## Run tests + cobertura (>= 90%)
```bash
mvn -q test
```
JaCoCo: `target/site/jacoco/index.html`

## AWS Lambda
- Runtime: `java21`
- Handler: `org.springframework.cloud.function.adapter.aws.FunctionInvoker`
- Env: `SPRING_CLOUD_FUNCTION_DEFINITION=finishRegistration`
