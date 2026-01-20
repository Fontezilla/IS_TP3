FROM eclipse-temurin:21-jre-jammy

RUN useradd -m -u 1000 appuser
WORKDIR /app
COPY target/biservice-0.0.1-SNAPSHOT.jar /app/biservice.jar
RUN chown -R appuser:appuser /app

USER appuser
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/biservice.jar"]
