# API reference

Interactive OpenAPI documentation is served at `http://localhost:8080/swagger-ui.html`, `http://localhost:8081/swagger-ui.html`, and each storage node's `/swagger-ui.html`.

Auth endpoints are under `/api/auth`: `POST /register`, `/login`, `/refresh`, and `/revoke`.

Metadata endpoints include `POST /api/files/upload`, `POST /api/files/{id}/chunks/{index}`, `GET /api/files/{id}/chunks/status`, `GET /api/files/{id}/download`, `DELETE /api/files/{id}`, folder CRUD and contents endpoints under `/api/folders`, and paginated `GET /api/search`.

Storage nodes expose raw internal `PUT`, `GET`, and `DELETE /chunks/{id}` operations. These should be isolated on a private network in production.
