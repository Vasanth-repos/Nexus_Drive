FROM maven:3.9.9-eclipse-temurin-17 AS build
WORKDIR /build
COPY pom.xml pom.xml
COPY common common
COPY storage-node storage-node
COPY auth-service/pom.xml auth-service/pom.xml
COPY metadata-service/pom.xml metadata-service/pom.xml
RUN mvn -pl storage-node -am package -DskipTests
FROM eclipse-temurin:17-jre
RUN useradd -r nexus && mkdir /data && chown nexus:nexus /data
USER nexus
COPY --from=build /build/storage-node/target/storage-node-1.0.0.jar /app.jar
EXPOSE 9001
ENTRYPOINT ["java","-jar","/app.jar"]
