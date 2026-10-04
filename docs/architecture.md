# NexusDrive architecture

Clients authenticate with the auth service and send the resulting HMAC-SHA256 access token to the metadata service. The metadata service owns folders, file state, deduplication, encryption, chunk placement, and authorization. Storage nodes persist only opaque AES-256-GCM ciphertext.

```text
Client -> Auth (8080) ------> PostgreSQL
   | JWT
   +----> Metadata (8081) --> PostgreSQL
                 |
                 +--> consistent hash ring
                        |--> Storage 1 --+
                        |--> Storage 2 <-+ replication
                        +--> Storage 3 <-+
```

Each ciphertext contains a 12-byte random GCM IV followed by authenticated ciphertext and a 128-bit tag. Metadata stores SHA-256 checksums for integrity validation. Per-file data keys are AES-GCM wrapped by a separate 256-bit master key before persistence; `KeyProtectionService` is the replacement boundary for a production KMS/HSM.
