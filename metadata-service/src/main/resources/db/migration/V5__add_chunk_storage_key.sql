ALTER TABLE chunks ADD COLUMN storage_key VARCHAR(255);
UPDATE chunks SET storage_key = file_id::text || '-' || chunk_index::text WHERE storage_key IS NULL;
ALTER TABLE chunks ALTER COLUMN storage_key SET NOT NULL;
CREATE INDEX idx_chunks_storage_key ON chunks(storage_key);
