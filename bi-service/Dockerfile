# Build stage
FROM maven:3.9-eclipse-temurin-21 AS builder

WORKDIR /app
COPY pom.xml .
COPY src ./src

RUN mvn clean package -DskipTests -q

# Runtime stage
FROM eclipse-temurin:21-jre-jammy

RUN useradd -m -u 1000 appuser && \
    apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /app/target/biservice-0.0.1-SNAPSHOT.jar /app/biservice.jar
RUN chown -R appuser:appuser /app

USER appuser
EXPOSE 8081
ENTRYPOINT ["java", "-jar", "/app/biservice.jar"]
