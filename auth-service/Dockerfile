FROM maven:3.9.9-eclipse-temurin-17 AS build
WORKDIR /build
COPY pom.xml pom.xml
COPY common common
COPY auth-service auth-service
COPY metadata-service/pom.xml metadata-service/pom.xml
COPY storage-node/pom.xml storage-node/pom.xml
RUN mvn -pl auth-service -am package -DskipTests
FROM eclipse-temurin:17-jre
RUN useradd -r nexus
USER nexus
COPY --from=build /build/auth-service/target/auth-service-1.0.0.jar /app.jar
EXPOSE 8080
ENTRYPOINT ["java","-jar","/app.jar"]
