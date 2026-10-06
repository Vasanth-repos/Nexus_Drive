# NexusDrive

NexusDrive is an enterprise-grade, distributed cloud-storage platform built with Java 17 and Spring Boot 3.2. It decouples **metadata** (ownership, folder tree hierarchy, permissions, deduplication, versions) from **storage** (encrypted binary chunks), providing independent scalability, 3-node fault-tolerant replication, and end-to-end envelope encryption.

The project features a **web application dashboard** (Google Drive / Nextcloud style) built with a directory tree hierarchy, in-browser decrypted previews, drag-and-drop chunked uploads, and cluster replication monitoring.

---

## Key Highlights & Architectural Features

- **Decoupled Architecture**: Stateless metadata service, independent auth service, and replicated storage nodes communicating over a private HTTP interface.
- **Envelope Encryption**: Each file generates a unique AES-256 data key wrapped by a master key using AES-256-GCM. Plaintext keys are never persisted.
- **8 MiB Chunking Pipeline**: Files are partitioned into uniform 8 MiB chunks, encrypted independently with random 12-byte GCM IVs and 128-bit authentication tags.
- **File-Level Deduplication**: SHA-256 content hashing checks for existing blocks; duplicate files reference existing chunks without re-uploading, saving network and storage capacity.
- **Consistent Hashing**: MurmurHash ring deterministically selects the primary storage node for each chunk, minimizing data migration when scaling nodes.
- **3-Way Replication**: Primary nodes asynchronously replicate chunks to peer nodes (default replication factor = 3), providing high availability and zero data loss on node failure.
- **Resumable Uploads**: Chunk uploads can be paused and resumed by querying missing indices (`GET /api/files/{id}/chunks/status`).
- **Directory Specification & Hierarchy**: Native folder structure with nested subdirectories, breadcrumbs, folder CRUD, and directory-scoped uploads.
- **Modern Web Dashboard**: Glassmorphic dark UI with live directory tree, active upload progress tray, file previews, and cluster health monitoring.
- **Multi-Architecture Docker**: Fully compatible with both ARM64 (Apple Silicon, ARM Windows) and x86_64 architectures using multi-platform `eclipse-temurin:17-jre` runtime images.

---

## Services & Ports

| Component | Container Name | Port | Description | Interactive Portal / Health |
|---|---|---|---|---|
| **Web Dashboard** | *(Local / Host)* | `3000` | Google Drive-style web interface | [http://localhost:3000](http://localhost:3000) |
| **Auth Service** | `nexusdrive-auth` | `8080` | JWT issuance, user registration, RBAC | [Swagger UI](http://localhost:8080/swagger-ui.html) / [`/actuator/health`](http://localhost:8080/actuator/health) |
| **Metadata Service** | `nexusdrive-metadata` | `8081` | File registry, folders, deduplication, search | [Swagger UI](http://localhost:8081/swagger-ui.html) / [`/actuator/health`](http://localhost:8081/actuator/health) |
| **Storage Node 1** | `nexusdrive-storage-1` | `9001` | Primary storage target & replica peer | [`/actuator/health`](http://localhost:9001/actuator/health) |
| **Storage Node 2** | `nexusdrive-storage-2` | `9002` | Storage target & replica peer | [`/actuator/health`](http://localhost:9002/actuator/health) |
| **Storage Node 3** | `nexusdrive-storage-3` | `9003` | Storage target & replica peer | [`/actuator/health`](http://localhost:9003/actuator/health) |
| **PostgreSQL 15** | `nexusdrive-postgres` | `5432` | Relational store for users, files, folders | Port 5432 (database: `nexusdrive`) |

---

## Quick Start

### 1. Prerequisites
- Docker Engine with Compose v2
- Node.js 18+ and npm (for frontend dev server)
- Java 17 and Maven 3.9+ (optional, for local non-Docker builds)

### 2. Configure Environment Variables
Create `.env` from the example template:
```sh
cp .env.example .env
```
Ensure secrets are configured (see [Environment Variables](#environment-variables)).

### 3. Start the Backend Infrastructure
Launch all 6 microservices (PostgreSQL, Auth, Metadata, and 3 Storage Nodes):
```sh
docker compose up --build -d
docker compose ps
```
Verify that all services report `(healthy)`.

### 4. Start the Frontend Dashboard
Navigate to `frontend/` and launch the Vite dev server:
```sh
cd frontend
npm install
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

> **One-Click Demo Access**: On the login screen, click **"One-Click Demo Account Login"** to instantly sign in and explore the dashboard without manual registration.

---

## Web Dashboard Features (Directory Specification)

The frontend application (`frontend/`) is designed around a modern cloud storage directory specification:

1. **Directory Tree & Breadcrumb Navigation**:
   - Sidebar displays an expandable **Directory Tree** rooted at `/`.
   - Dynamic breadcrumb bar allows immediate navigation across parent and child paths.
2. **Directory Specification Panel**:
   - Real-time directory metrics: current path, number of subdirectories, file count, total size, chunk unit (`8 MiB`), and replication factor (`3x`).
3. **Folder Operations**:
   - Create subdirectories within any active folder.
   - Rename and delete directories with automatic metadata cascade.
4. **Drag-and-Drop & Resumable Uploads**:
   - Drag files anywhere onto the window to upload directly into the active directory.
   - Files larger than 8 MiB are split into chunks with live per-chunk progress displayed in the upload tray.
5. **Decrypted Preview & Streaming Downloads**:
   - In-browser preview for images (PNG, JPG, SVG, WebP), text/code (JS, TS, Java, JSON, Markdown), PDFs, and media (audio/video).
   - Decrypted streaming download directly from the metadata service.
6. **Chunk Sharding & Replica Inspector**:
   - Click the chunk icon on any file card to inspect its 8 MiB chunk division, SHA-256 checksums, and Consistent Hash placement across `node-1`, `node-2`, and `node-3`.
7. **Storage Cluster Monitor**:
   - Click the **Cluster** pill in the top navigation bar to open a live status drawer displaying the health and port bindings of all 3 storage nodes.

---

## Architecture & Data Flow

```text
       +-------------------------------------------------------------+
       |             NexusDrive Web Dashboard (Port 3000)            |
       +------------------------------+------------------------------+
                                      |
                     +----------------+----------------+
                     |                                 |
                     v                                 v
        +--------------------------+     +---------------------------+
        |  Auth Service (Port 8080) |     | Metadata Service (Pt 8081) |
        +-------------+------------+     +-------------+-------------+
                      |                                |
                      |    +-----------------------+   |
                      +--->| PostgreSQL (Port 5432)|<--+
                           +-----------------------+
                                       |
                                       | Consistent Hash Ring
                                       v
                     +-----------------------------------+
                     |           Storage Nodes           |
                     |  +-----------------------------+  |
                     |  | Node 1 (9001) - storage1/   |  |
                     |  +--------------+--------------+  |
                     |                 | Async           |
                     |  +--------------v--------------+  |
                     |  | Node 2 (9002) - storage2/   |  |
                     |  +--------------+--------------+  |
                     |                 | Replication     |
                     |  +--------------v--------------+  |
                     |  | Node 3 (9003) - storage3/   |  |
                     |  +-----------------------------+  |
                     +-----------------------------------+
```

### Encryption Pipeline
1. On upload, the metadata service generates a cryptographically random 256-bit AES data key for the file.
2. The data key is encrypted (wrapped) with `ENCRYPTION_MASTER_KEY` and saved in PostgreSQL. Plaintext keys are never stored.
3. The file is split into 8 MiB chunks. Each chunk is encrypted with AES-256-GCM (12-byte random IV, 128-bit authentication tag).
4. The ciphertext is assigned to a primary storage node using consistent hashing and transferred with internal authorization (`X-Storage-Secret`).
5. The primary storage node writes the chunk to its persistent volume and asynchronously replicates it to two peer nodes.

---

## Environment Variables

| Variable | Description | Default | Production Note |
|---|---|---|---|
| `DB_USER` | PostgreSQL username | `nexusdrive` | Dedicated DB user |
| `DB_PASSWORD` | PostgreSQL password | `nexusdrive_dev_pass` | Strong random secret |
| `DB_URL` | JDBC URL for PostgreSQL | `jdbc:postgresql://postgres:5432/nexusdrive` | Managed DB connection string |
| `JWT_SECRET` | HMAC-SHA256 secret key | Base64 string (32+ bytes) | Rotate via secret manager |
| `JWT_ACCESS_EXPIRATION_MS` | Access token lifetime in ms | `900000` (15 min) | Short-lived token |
| `JWT_REFRESH_EXPIRATION_MS` | Refresh token lifetime in ms | `604800000` (7 days) | Long-lived token |
| `STORAGE_NODES` | Routing targets for metadata | `storage-node-1:9001,storage-node-2:9002,storage-node-3:9003` | Private network addresses |
| `STORAGE_INTERNAL_SECRET` | Secret authorizing metadata & peer traffic | 32+ character string | Keep private from clients |
| `ENCRYPTION_MASTER_KEY` | Base64-encoded 32-byte master key | Base64 256-bit key | Inject via KMS/HSM |
| `REPLICATION_FACTOR` | Total desired copies including primary | `3` | Typically 3 for quorum |

Generate secrets using:
```sh
# Generate 48-byte random JWT secret
openssl rand -base64 48

# Generate 32-byte AES-256 master key
openssl rand -base64 32
```

---

## API & cURL Walkthrough

### 1. User Registration & Authentication
```sh
# Register a user
curl -sS -X POST http://localhost:8080/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"username":"alice","email":"alice@example.com","password":"Password123!"}'

# Log in
LOGIN_RESP=$(curl -sS -X POST http://localhost:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"alice","password":"Password123!"}')

# Extract JWT Access Token
TOKEN=$(echo $LOGIN_RESP | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)
```

### 2. Directory & Folder Management
```sh
# Create a folder
FOLDER_RESP=$(curl -sS -X POST http://localhost:8081/api/folders \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Projects","parentId":null}')

FOLDER_ID=$(echo $FOLDER_RESP | grep -o '"id":"[^"]*' | cut -d'"' -f4)

# List folder contents
curl -sS -X GET "http://localhost:8081/api/folders/$FOLDER_ID/contents" \
  -H "Authorization: Bearer $TOKEN"

# Rename folder
curl -sS -X PUT "http://localhost:8081/api/folders/$FOLDER_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"WorkProjects","parentId":null}'
```

### 3. File Upload, Download & Deletion
```sh
# Upload a file into a folder
UPLOAD_RESP=$(curl -sS -X POST http://localhost:8081/api/files/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F 'file=@sample.pdf' \
  -F "folderId=$FOLDER_ID")

FILE_ID=$(echo $UPLOAD_RESP | grep -o '"id":"[^"]*' | cut -d'"' -f4)

# Inspect chunk replication status
curl -sS -X GET "http://localhost:8081/api/files/$FILE_ID/chunks/status" \
  -H "Authorization: Bearer $TOKEN"

# Download and stream decrypted file
curl -sS -X GET "http://localhost:8081/api/files/$FILE_ID/download" \
  -H "Authorization: Bearer $TOKEN" \
  -o downloaded_sample.pdf

# Search files
curl -sS -X GET "http://localhost:8081/api/search?q=sample" \
  -H "Authorization: Bearer $TOKEN"

# Delete file
curl -sS -X DELETE "http://localhost:8081/api/files/$FILE_ID" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Development & Testing

### Building and Running Locally
```sh
# Fast unit test suite
./mvnw clean verify

# Run single service locally
./mvnw -pl auth-service spring-boot:run
./mvnw -pl metadata-service spring-boot:run
./mvnw -pl storage-node spring-boot:run
```

### End-to-End Integration Tests
NexusDrive includes an end-to-end integration test profile that verifies user registration, login, upload, consistent hash replication, download, and physical cleanup:

```sh
# Full test suite with integration profile
./mvnw clean verify -Pintegration

# Windows convenience script
powershell -ExecutionPolicy Bypass -File scripts/verify-all.ps1

# Local non-docker process verification
powershell -ExecutionPolicy Bypass -File scripts/verify-local.ps1
```

### Database Migrations
Flyway manages database migrations. Hibernate runs with `ddl-auto: validate`:
- `auth-service`: `V1__create_users_table.sql`
- `metadata-service`: `V2__create_files_folders.sql`, `V3__create_chunks_versions.sql`, `V4__create_share_permissions.sql`, `V5__add_chunk_storage_key.sql`

---

## Scaling Storage Nodes

To add a 4th storage node to the consistent hash ring:
1. Add a service block in `docker-compose.yml` using `storage-node/Dockerfile`:
   ```yaml
   storage-node-4:
     build: {context: ., dockerfile: storage-node/Dockerfile}
     container_name: nexusdrive-storage-4
     ports: ["9004:9004"]
     environment:
       SERVER_PORT: 9004
       NODE_ID: node-4
       STORAGE_PATH: /data
       PEERS: "storage-node-1:9001,storage-node-2:9002,storage-node-3:9003"
       REPLICATION_FACTOR: 3
       STORAGE_INTERNAL_SECRET: "${STORAGE_INTERNAL_SECRET}"
     volumes: ["storage4:/data"]
   ```
2. Append `storage-node-4:9004` to `STORAGE_NODES` in `metadata-service`.
3. Include `storage-node-4:9004` in the `PEERS` variable of existing storage nodes.
4. Add `storage4: {}` under top-level `volumes`.

---

## Project Structure

```
NexusDrive/
├── docker-compose.yml              # 6-container orchestration
├── .env                            # Active environment configuration
├── .env.example                    # Template environment variables
├── README.md                       # Comprehensive project documentation
├── pom.xml                         # Parent Maven POM (Java 17, Spring Boot 3.2)
│
├── common/                         # Shared security, crypto & DTO library
│   ├── src/main/java/com/nexusdrive/common/
│   │   ├── config/                 # JwtProperties, CorsConfig
│   │   ├── dto/                    # ApiResponse, ErrorResponse
│   │   ├── security/               # JwtTokenProvider, JwtAuthFilter
│   │   └── util/                   # AesEncryptionUtil, ConsistentHashingUtil, Sha256HashUtil
│
├── auth-service/                   # Authentication & user management service (Port 8080)
│   ├── Dockerfile                  # Multi-stage multi-arch build
│   └── src/main/java/com/nexusdrive/auth/
│
├── metadata-service/               # File registry, folders, sharding orchestrator (Port 8081)
│   ├── Dockerfile                  # Multi-stage multi-arch build
│   └── src/main/java/com/nexusdrive/metadata/
│
├── storage-node/                   # Encrypted chunk storage & replication engine (Ports 9001-9003)
│   ├── Dockerfile                  # Multi-stage multi-arch build
│   └── src/main/java/com/nexusdrive/storage/
│
├── frontend/                       # Web application dashboard (Port 3000)
│   ├── index.html                  # Directory tree, dropzone, preview & cluster drawer
│   ├── style.css                   # Glassmorphic dark theme design system
│   ├── main.js                     # Directory spec logic, upload engine, chunk inspector
│   ├── vite.config.js              # Vite server & reverse proxies
│   └── package.json
│
├── docs/                           # Architectural and OpenAPI documentation
└── scripts/                        # Secret generators and test verification scripts
```

---

## License
MIT License. Distributed and designed for high-throughput, secure multi-node cloud storage workloads.
