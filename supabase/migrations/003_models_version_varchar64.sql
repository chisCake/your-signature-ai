-- Allow longer bundle names in models.version (e.g. hybrid-detector-v1-1500)
ALTER TABLE models
    ALTER COLUMN version TYPE VARCHAR(64);
