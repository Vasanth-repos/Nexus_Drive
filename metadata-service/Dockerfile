FROM maven:3.9.9-eclipse-temurin-17 AS build
WORKDIR /build
COPY pom.xml pom.xml
COPY common common
COPY metadata-service metadata-service
COPY auth-service/pom.xml auth-service/pom.xml
COPY storage-node/pom.xml storage-node/pom.xml
RUN mvn -pl metadata-service -am package -DskipTests
FROM eclipse-temurin:17-jre
RUN useradd -r nexus
USER nexus
COPY --from=build /build/metadata-service/target/metadata-service-1.0.0.jar /app.jar
EXPOSE 8081
ENTRYPOINT ["java","-jar","/app.jar"]
