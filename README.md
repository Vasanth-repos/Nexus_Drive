# NexusDrive

NexusDrive is a Java 17/Spring Boot 3.2 distributed cloud-storage platform. It uses PostgreSQL metadata, JWT authentication, 8 MiB AES-256-GCM encrypted chunks, consistent-hash placement, asynchronous three-node replication, resumable uploads, and file-level SHA-256 deduplication.

## Quick start

Prerequisites: Docker Engine with Compose v2. For local builds, install Java 17 and Maven 3.9+.

```sh
cp .env.example .env
# Replace DB_PASSWORD and JWT_SECRET in .env
docker compose up --build -d
docker compose ps
```

| Component | URL |
|---|---|
| Auth | `http://localhost:8080` |
| Metadata | `http://localhost:8081` |
| Storage nodes | `http://localhost:9001` through `9003` |
| Swagger | `/swagger-ui.html` on each service |

## Environment variables

| Variable | Purpose | Default |
|---|---|---|
| `DB_USER`, `DB_PASSWORD`, `DB_URL` | PostgreSQL credentials/JDBC URL | local development values |
| `JWT_SECRET` | HMAC key, at least 32 random bytes | insecure development value |
| `JWT_ACCESS_EXPIRATION_MS` | Access-token lifetime | `900000` |
| `JWT_REFRESH_EXPIRATION_MS` | Refresh-token lifetime | `604800000` |
| `STORAGE_NODES` | Comma-separated metadata routing targets | three localhost nodes |
| `STORAGE_INTERNAL_SECRET` | Authenticates metadata and peer storage traffic | insecure development value |
| `ENCRYPTION_MASTER_KEY` | Base64-encoded 32-byte key wrapping per-file data keys | insecure development value |
| `NODE_ID`, `STORAGE_PATH`, `PEERS` | Storage identity, volume, and replica targets | node-specific |
| `REPLICATION_FACTOR` | Total desired copies including primary | `3` |

Generate secrets with `./scripts/generate-jwt-secret.sh` and `./scripts/generate-master-key.sh`. Production deployments should inject secrets from a secret manager, back the key-protection service with a cloud KMS/HSM, isolate storage endpoints, and terminate TLS at the ingress/reverse proxy. Stored per-file keys are AES-GCM wrapped; plaintext data keys are never persisted.

## Curl walkthrough

```sh
curl -sS -X POST http://localhost:8080/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"username":"alice","email":"alice@example.com","password":"correct-horse-battery-staple"}'

curl -sS -X POST http://localhost:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"alice","password":"correct-horse-battery-staple"}'

# Set TOKEN to data.accessToken from login.
TOKEN='...'
curl -sS -X POST http://localhost:8081/api/files/upload \
  -H "Authorization: Bearer $TOKEN" -F 'file=@example.pdf'

# Set FILE_ID to data.id from upload.
FILE_ID='...'
curl -sS http://localhost:8081/api/files/$FILE_ID/download \
  -H "Authorization: Bearer $TOKEN" -o downloaded.pdf
curl -sS -X DELETE http://localhost:8081/api/files/$FILE_ID \
  -H "Authorization: Bearer $TOKEN"
```

For resumable upload, initialize with JSON at `POST /api/files/upload`, submit exact 8 MiB chunks (the final chunk may be shorter) to `POST /api/files/{id}/chunks/{index}` as `application/octet-stream`, and query `/api/files/{id}/chunks/status` for missing indices.

## Development

```sh
./mvnw clean verify
mvn -pl auth-service spring-boot:run
```

`clean verify` runs the fast unit suite. The complete Docker-backed register → login → upload → download → delete test is mandatory under the integration profile:

```sh
./mvnw clean verify -Pintegration
# Windows convenience command:
powershell -ExecutionPolicy Bypass -File scripts/verify-all.ps1
```

The integration profile fails when Docker is unavailable; CI runs both suites on every push and pull request.

Flyway owns all schema changes; Hibernate runs with `ddl-auto: validate`. Each database-using service has an independent Flyway history table.

## Adding a fourth storage node

Add another Compose service built from `storage-node/Dockerfile`, give it a unique `NODE_ID`, port, and named volume, add its address to `STORAGE_NODES`, and include it in every node's `PEERS`. Increase `REPLICATION_FACTOR` only if four copies are desired; leaving it at three retains three total copies.

See [architecture](docs/architecture.md) and [API reference](docs/api-reference.md).
