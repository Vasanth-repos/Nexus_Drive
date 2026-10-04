# NexusDrive — Complete Codex Build Specification

**Version:** 1.0
**Target agent:** OpenAI Codex (or any AI coding agent — Claude Code, Cursor, etc.)
**Goal:** Generate a complete, runnable, production-grade Java/Spring Boot distributed cloud storage platform in one execution pass.

---

## 1. Project Summary

NexusDrive is a distributed, microservice-based cloud storage platform. It separates **metadata** (who owns what, where it lives, permissions) from **storage** (encrypted binary chunks), enabling independent scaling, replication, and fault tolerance.

| Attribute | Detail |
|---|---|
| Architecture | Distributed microservices |
| Language | Java 17 |
| Framework | Spring Boot 3.x |
| Database | PostgreSQL 15 |
| Auth | JWT (HMAC-SHA256) + BCrypt |
| File encryption | AES-256 per-chunk |
| Build tool | Maven (multi-module) |
| Containerization | Docker + Docker Compose |
| Docs | Swagger / OpenAPI 3.0 |
| Testing | JUnit 5 + Mockito |

---

## 2. Services

| Service | Container name | Port | Responsibility |
|---|---|---|---|
| Auth Service | nexusdrive-auth | 8080 | Registration, login, JWT issuance/validation, RBAC |
| Metadata Service | nexusdrive-metadata | 8081 | File registry, folders, permissions, versions, search, dedup index |
| Storage Node 1 | nexusdrive-storage-1 | 9001 | Primary encrypted chunk storage |
| Storage Node 2 | nexusdrive-storage-2 | 9002 | Replica storage node |
| Storage Node 3 | nexusdrive-storage-3 | 9003 | Replica storage node |
| PostgreSQL | nexusdrive-postgres | 5432 | Relational store for users/metadata |

---

## 3. Complete Folder Structure

```
nexusdrive/
├── docker-compose.yml
├── .env.example
├── README.md
├── pom.xml                                  # parent POM (multi-module)
│
├── common/                                  # shared library (used by all services)
│   ├── pom.xml
│   └── src/main/java/com/nexusdrive/common/
│       ├── config/
│       │   ├── JwtProperties.java
│       │   └── CorsConfig.java
│       ├── dto/
│       │   ├── ApiResponse.java
│       │   └── ErrorResponse.java
│       ├── exception/
│       │   ├── GlobalExceptionHandler.java
│       │   ├── ResourceNotFoundException.java
│       │   ├── UnauthorizedException.java
│       │   └── ValidationException.java
│       ├── security/
│       │   ├── JwtTokenProvider.java
│       │   ├── JwtAuthFilter.java
│       │   └── CustomUserDetails.java
│       ├── util/
│       │   ├── AesEncryptionUtil.java       # AES-256 chunk encryption/decryption
│       │   ├── Sha256HashUtil.java          # dedup hashing
│       │   └── ConsistentHashingUtil.java   # chunk-to-node distribution
│       └── enums/
│           ├── Role.java                    # ADMIN, USER, VIEWER
│           └── ShareVisibility.java         # PRIVATE, SHARED, PUBLIC
│
├── auth-service/
│   ├── pom.xml
│   ├── Dockerfile
│   └── src/main/
│       ├── java/com/nexusdrive/auth/
│       │   ├── AuthServiceApplication.java
│       │   ├── config/
│       │   │   └── SecurityConfig.java
│       │   ├── controller/
│       │   │   └── AuthController.java      # /register /login /refresh /revoke
│       │   ├── service/
│       │   │   ├── AuthService.java
│       │   │   └── impl/AuthServiceImpl.java
│       │   ├── repository/
│       │   │   ├── UserRepository.java
│       │   │   └── RefreshTokenRepository.java
│       │   ├── entity/
│       │   │   ├── User.java
│       │   │   └── RefreshToken.java
│       │   └── dto/
│       │       ├── RegisterRequest.java
│       │       ├── LoginRequest.java
│       │       └── AuthResponse.java
│       └── resources/
│           ├── application.yml
│           └── db/migration/
│               └── V1__create_users_table.sql   # Flyway
│
├── metadata-service/
│   ├── pom.xml
│   ├── Dockerfile
│   └── src/main/
│       ├── java/com/nexusdrive/metadata/
│       │   ├── MetadataServiceApplication.java
│       │   ├── config/SecurityConfig.java
│       │   ├── controller/
│       │   │   ├── FileController.java      # upload/download/delete/list
│       │   │   ├── FolderController.java    # create/move/rename folders
│       │   │   └── SearchController.java    # full-text + faceted search
│       │   ├── service/
│       │   │   ├── FileMetadataService.java
│       │   │   ├── FolderService.java
│       │   │   ├── DeduplicationService.java
│       │   │   ├── ChunkOrchestrationService.java   # talks to storage nodes
│       │   │   └── impl/ (implementations)
│       │   ├── repository/
│       │   │   ├── FileMetadataRepository.java
│       │   │   ├── FolderRepository.java
│       │   │   ├── ChunkRepository.java
│       │   │   └── FileVersionRepository.java
│       │   ├── entity/
│       │   │   ├── FileMetadata.java
│       │   │   ├── Folder.java
│       │   │   ├── Chunk.java
│       │   │   ├── FileVersion.java
│       │   │   └── SharePermission.java
│       │   └── dto/
│       │       ├── FileUploadRequest.java
│       │       ├── FileResponse.java
│       │       └── ChunkStatusResponse.java  # for resumable uploads
│       └── resources/
│           ├── application.yml
│           └── db/migration/
│               ├── V2__create_files_folders.sql
│               ├── V3__create_chunks_versions.sql
│               └── V4__create_share_permissions.sql
│
├── storage-node/                             # single deployable, run x3 with different ports/volumes
│   ├── pom.xml
│   ├── Dockerfile
│   └── src/main/
│       ├── java/com/nexusdrive/storage/
│       │   ├── StorageNodeApplication.java
│       │   ├── controller/
│       │   │   └── ChunkController.java     # PUT/GET/DELETE chunk by id
│       │   ├── service/
│       │   │   ├── ChunkStorageService.java # writes encrypted bytes to disk
│       │   │   └── ReplicationService.java  # async push to peer nodes
│       │   └── config/
│       │       └── StorageProperties.java   # storage path, node id, peers
│       └── resources/
│           └── application.yml
│
├── scripts/
│   ├── init-db.sh
│   └── generate-jwt-secret.sh
│
└── docs/
    ├── api-reference.md
    └── architecture.md
```

---

## 4. Database Schema (PostgreSQL)

### `users`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| username | VARCHAR(50) UNIQUE | |
| email | VARCHAR(255) UNIQUE | |
| password_hash | VARCHAR(255) | BCrypt |
| role | VARCHAR(20) | ADMIN / USER / VIEWER |
| failed_login_attempts | INT | brute-force tracking |
| created_at, updated_at | TIMESTAMP | |

### `refresh_tokens`
id, user_id (FK), token_hash, expires_at, revoked (boolean)

### `folders`
id, owner_id (FK users), parent_id (self FK, nullable), name, full_path, created_at

### `file_metadata`
id, owner_id (FK), folder_id (FK), filename, mime_type, size_bytes, content_hash (SHA-256, indexed), encryption_key_ref, status (ACTIVE/DELETED), created_at, updated_at

### `file_versions`
id, file_id (FK), version_number, size_bytes, content_hash, created_at

### `chunks`
id, file_id (FK), chunk_index, storage_node_id, replica_node_ids (array/JSON), checksum, uploaded (boolean)

### `share_permissions`
id, file_id (FK), shared_with_user_id (nullable = public), visibility (PRIVATE/SHARED/PUBLIC), permission (READ/WRITE)

Indexes required: `file_metadata(content_hash)`, `file_metadata(owner_id, folder_id)`, GIN index on filename/tags for full-text search.

---

## 5. Step-by-Step Implementation Plan

Execute in this order — each step should compile and be testable before moving to the next.

**Step 1 — Scaffolding**
Generate the parent Maven POM with modules: `common`, `auth-service`, `metadata-service`, `storage-node`. Set Java 17, Spring Boot 3.2.x parent, shared dependency versions in `<dependencyManagement>`.

**Step 2 — Common module**
Implement `JwtTokenProvider` (generate/validate/parse HMAC-SHA256 tokens with role + user id claims, configurable expiry), `AesEncryptionUtil` (AES-256-GCM encrypt/decrypt byte arrays with per-file key generation), `Sha256HashUtil`, `ConsistentHashingUtil` (maps chunk id → storage node using a hash ring), global exception handler, standard `ApiResponse<T>` wrapper.

**Step 3 — Auth Service**
Entities + Flyway migration for `users` and `refresh_tokens`. `AuthController` endpoints: `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/revoke`. Passwords hashed with BCrypt (strength 12). Track failed attempts and lock after 5 consecutive failures for 15 minutes. Return `AuthResponse { accessToken, refreshToken, expiresIn }`.

**Step 4 — Metadata Service: folders & files**
Flyway migrations for `folders`, `file_metadata`, `file_versions`, `chunks`, `share_permissions`. `FolderController` for CRUD + move/rename. `FileController` exposing:
- `POST /api/files/upload` — accepts multipart or chunked upload init
- `POST /api/files/{id}/chunks/{index}` — upload individual chunk (resumable)
- `GET /api/files/{id}/chunks/status` — which chunks are already received (for resume)
- `GET /api/files/{id}/download` — reassemble + decrypt stream
- `DELETE /api/files/{id}` — logical delete, async physical cleanup
- `GET /api/folders/{id}/contents` — list files/folders

**Step 5 — Chunking + encryption pipeline**
On upload: split incoming stream into fixed 8MB chunks → encrypt each chunk with AES-256 using a per-file key → compute SHA-256 of each chunk for integrity → use `ConsistentHashingUtil` to pick primary storage node → call storage node's `PUT /chunks/{chunkId}` via `RestTemplate`/`WebClient`.

**Step 6 — Storage Node service**
`ChunkController`: `PUT /chunks/{id}` (write encrypted bytes to local disk under configured volume), `GET /chunks/{id}` (read raw encrypted bytes), `DELETE /chunks/{id}`. `ReplicationService`: after a chunk is written, asynchronously `PUT` copies to N peer nodes (default N=2, configured via `storage.peers` + `storage.replication-factor`).

**Step 7 — Deduplication**
`DeduplicationService`: before storing a new file's chunks, check `file_metadata.content_hash`. If a match exists, reference the existing chunk set instead of re-uploading — only insert new metadata row, skip storage node calls.

**Step 8 — Resumable uploads**
Each chunk row starts `uploaded=false`; flips to `true` once storage node ack's the write. Client can `GET /api/files/{id}/chunks/status` any time and resume by re-`POST`ing only missing chunk indices.

**Step 9 — Search**
`SearchController` — `GET /api/search?q=&type=&owner=&dateFrom=&dateTo=` querying indexed `filename`/`mime_type`/tags in `file_metadata` with pagination.

**Step 10 — Security hardening**
Apply `JwtAuthFilter` to all endpoints except `/api/auth/**` and `/swagger-ui/**`. Enforce RBAC via `@PreAuthorize` (ADMIN sees all, USER only owns/shared, VIEWER read-only). Add rate limiting on `/api/auth/login`. Enable TLS termination notes in README (handled at reverse-proxy/ingress layer, not in-app).

**Step 11 — Testing**
JUnit 5 + Mockito unit tests for `JwtTokenProvider`, `AesEncryptionUtil`, `DeduplicationService`, `ConsistentHashingUtil`. Integration tests with `@SpringBootTest` + Testcontainers for PostgreSQL, covering register→login→upload→download→delete happy path.

**Step 12 — Dockerization**
Multi-stage Dockerfiles (Maven build stage → slim JRE runtime stage) for each of the 3 deployable services. `docker-compose.yml` wiring all 6 containers, named volumes for each storage node, `.env` for JWT secret/DB credentials, healthchecks on `/actuator/health`.

**Step 13 — API docs**
springdoc-openapi dependency on auth-service and metadata-service; expose `/swagger-ui.html` and `/v3/api-docs`.

**Step 14 — README**
Document: prerequisites, `docker-compose up -d`, default ports, sample curl flow (register → login → upload → download), environment variables table, architecture diagram (ASCII), how to add a 4th storage node.

---

## 6. docker-compose.yml (reference shape)

```yaml
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: nexusdrive
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    ports: ["5432:5432"]
    volumes: ["pgdata:/var/lib/postgresql/data"]

  auth-service:
    build: ./auth-service
    ports: ["8080:8080"]
    environment:
      JWT_SECRET: ${JWT_SECRET}
      DB_URL: jdbc:postgresql://postgres:5432/nexusdrive
    depends_on: [postgres]

  metadata-service:
    build: ./metadata-service
    ports: ["8081:8081"]
    environment:
      JWT_SECRET: ${JWT_SECRET}
      DB_URL: jdbc:postgresql://postgres:5432/nexusdrive
      STORAGE_NODES: storage-node-1:9001,storage-node-2:9002,storage-node-3:9003
    depends_on: [postgres, storage-node-1, storage-node-2, storage-node-3]

  storage-node-1:
    build: ./storage-node
    ports: ["9001:9001"]
    environment:
      NODE_ID: node-1
      STORAGE_PATH: /data
      PEERS: storage-node-2:9002,storage-node-3:9003
    volumes: ["storage1:/data"]

  storage-node-2:
    build: ./storage-node
    ports: ["9002:9002"]
    environment:
      NODE_ID: node-2
      STORAGE_PATH: /data
      PEERS: storage-node-1:9001,storage-node-3:9003
    volumes: ["storage2:/data"]

  storage-node-3:
    build: ./storage-node
    ports: ["9003:9003"]
    environment:
      NODE_ID: node-3
      STORAGE_PATH: /data
      PEERS: storage-node-1:9001,storage-node-2:9002
    volumes: ["storage3:/data"]

volumes:
  pgdata:
  storage1:
  storage2:
  storage3:
```

---

## 7. Professional Prompt for Codex

Copy everything in the block below as a single prompt into Codex (or any coding agent). It references this spec so the agent has full context in one shot.

```
You are building NexusDrive, a distributed Java/Spring Boot cloud storage
platform, from scratch, as a complete, compilable, runnable Maven
multi-module project.

CONTEXT: A full specification is provided below covering architecture,
folder structure, database schema, and a 14-step implementation plan.
Follow it exactly. Do not skip modules. Do not use placeholder/TODO logic
for core flows (auth, chunking, encryption, replication, dedup, resumable
upload) — implement them fully and correctly.

REQUIREMENTS:
1. Java 17, Spring Boot 3.2.x, Maven multi-module (parent + common +
   auth-service + metadata-service + storage-node).
2. PostgreSQL 15 via Spring Data JPA/Hibernate, Flyway migrations for
   every entity — do not use ddl-auto in production profiles.
3. JWT auth (HMAC-SHA256) with access + refresh tokens, BCrypt password
   hashing, role-based access control (ADMIN/USER/VIEWER) enforced with
   @PreAuthorize.
4. Files are split into 8MB chunks, each encrypted with AES-256-GCM
   using a per-file key, hashed with SHA-256, distributed to storage
   nodes via consistent hashing, and asynchronously replicated to
   replication-factor peer nodes (default 3).
5. Resumable uploads: track per-chunk upload state; expose an endpoint
   to query missing chunks; client resumes by re-sending only those.
6. SHA-256 content-hash deduplication at the file level.
7. Full-text/faceted search over filename, mime type, tags, owner,
   date range, with pagination.
8. Every REST endpoint documented via springdoc-openapi / Swagger UI.
9. JUnit 5 + Mockito unit tests for all utility/service classes listed
   in the spec; at least one Testcontainers-based integration test
   covering the full register→login→upload→download→delete flow.
10. Multi-stage Dockerfiles for all 3 deployable services and a
    docker-compose.yml wiring 6 containers (postgres + auth +
    metadata + 3 storage nodes) with healthchecks and named volumes.
11. A complete README with setup instructions, environment variables,
    and a sample curl walkthrough.

OUTPUT FORMAT:
- Produce every file at its exact path from the folder structure spec.
- Prioritize working, idiomatic Spring Boot code over comments/prose.
- After generating all files, output a final checklist confirming
  each of the 14 implementation steps was completed, and list any
  step that was abbreviated due to length constraints so it can be
  finished in a follow-up pass.

Build the project now, module by module, in the step order given in
section 5 of the spec (Scaffolding → Common → Auth → Metadata/Folders
→ Chunking/Encryption → Storage Node → Dedup → Resumable Uploads →
Search → Security hardening → Testing → Dockerization → API docs →
README). If you approach your output token limit before finishing all
14 steps, stop at a clean module boundary, clearly state which step
you stopped at and what remains, and wait for a "continue" instruction
rather than truncating a file mid-way.
```

---

## 8. Notes on Token-Limit Handling

Codex (and most coding agents) cap output per turn. To avoid truncated/corrupt files:

- The prompt above explicitly instructs the agent to **stop at a clean module boundary** rather than mid-file if it runs out of room.
- If using Codex CLI or an IDE agent with multi-turn tool calls, run the 14 steps as **separate follow-up messages** ("continue with Step 5" / "continue with Step 9") rather than expecting one mega-response — this is the reliable way to get all 19+ files without truncation.
- Suggested batching: Steps 1–2 in one pass (scaffolding + common), Steps 3–4 in one pass (auth + metadata core), Steps 5–8 in one pass (chunking/storage/dedup/resume), Steps 9–11 in one pass (search/security/tests), Steps 12–14 in one final pass (docker/docs/README).
