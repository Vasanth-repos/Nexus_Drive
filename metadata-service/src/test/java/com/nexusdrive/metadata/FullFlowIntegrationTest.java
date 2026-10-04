package com.nexusdrive.metadata;

import static org.junit.jupiter.api.Assertions.*;

import java.io.File;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.DockerComposeContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers(disabledWithoutDocker = false)
class FullFlowIntegrationTest {
    private static final Pattern ACCESS = Pattern.compile("\\\"accessToken\\\":\\\"([^\\\"]+)\\\"");
    private static final Pattern ID = Pattern.compile("\\\"id\\\":\\\"([^\\\"]+)\\\"");

    @Test
    void registerLoginUploadDownloadDelete() throws Exception {
        File composeFile = new File("../docker-compose.yml").getCanonicalFile();
        try (var environment = new DockerComposeContainer<>(composeFile)
                .withEnv("DB_USER", "nexusdrive")
                .withEnv("DB_PASSWORD", "integration-password")
                .withEnv("JWT_SECRET", "integration-jwt-secret-at-least-32-bytes-long")
                .withEnv("STORAGE_INTERNAL_SECRET", "integration-storage-secret-long-enough")
                .withEnv("ENCRYPTION_MASTER_KEY", "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=")
                .withExposedService("auth-service-1", 8080, Wait.forHttp("/actuator/health").forStatusCode(200).withStartupTimeout(Duration.ofMinutes(5)))
                .withExposedService("metadata-service-1", 8081, Wait.forHttp("/actuator/health").forStatusCode(200).withStartupTimeout(Duration.ofMinutes(5)))) {
            environment.start();
            HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
            String auth = "http://" + environment.getServiceHost("auth-service-1", 8080) + ":" + environment.getServicePort("auth-service-1", 8080);
            String metadata = "http://" + environment.getServiceHost("metadata-service-1", 8081) + ":" + environment.getServicePort("metadata-service-1", 8081);

            response(http, request(auth + "/api/auth/register", "POST", "application/json", "{\"username\":\"flowuser\",\"email\":\"flow@example.com\",\"password\":\"correct-horse-battery-staple\"}", null), 201);
            String login = response(http, request(auth + "/api/auth/login", "POST", "application/json", "{\"username\":\"flowuser\",\"password\":\"correct-horse-battery-staple\"}", null), 200).body();
            String token = capture(ACCESS, login);
            byte[] payload = "NexusDrive complete integration flow".getBytes(StandardCharsets.UTF_8);
            String init = response(http, request(metadata + "/api/files/upload", "POST", "application/json", "{\"filename\":\"flow.txt\",\"mimeType\":\"text/plain\",\"sizeBytes\":" + payload.length + ",\"tags\":[\"integration\"]}", token), 200).body();
            String fileId = capture(ID, init);
            response(http, binaryRequest(metadata + "/api/files/" + fileId + "/chunks/0", "POST", payload, token), 200);
            HttpResponse<byte[]> downloaded = http.send(HttpRequest.newBuilder(URI.create(metadata + "/api/files/" + fileId + "/download")).header("Authorization", "Bearer " + token).GET().build(), HttpResponse.BodyHandlers.ofByteArray());
            assertEquals(200, downloaded.statusCode());
            assertArrayEquals(payload, downloaded.body());
            response(http, request(metadata + "/api/files/" + fileId, "DELETE", null, null, token), 200);
        }
    }

    private static HttpRequest request(String url, String method, String contentType, String body, String token) {
        var builder = HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(30));
        if (contentType != null) builder.header("Content-Type", contentType);
        if (token != null) builder.header("Authorization", "Bearer " + token);
        return builder.method(method, body == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(body)).build();
    }

    private static HttpRequest binaryRequest(String url, String method, byte[] body, String token) {
        return HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(30)).header("Content-Type", "application/octet-stream").header("Authorization", "Bearer " + token).method(method, HttpRequest.BodyPublishers.ofByteArray(body)).build();
    }

    private static HttpResponse<String> response(HttpClient http, HttpRequest request, int expected) throws Exception {
        HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
        assertEquals(expected, response.statusCode(), response.body());
        return response;
    }

    private static String capture(Pattern pattern, String body) {
        var matcher = pattern.matcher(body);
        assertTrue(matcher.find(), body);
        return matcher.group(1);
    }
}
