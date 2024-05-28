---
description: File on Twake Drive
---

# 📄 Files
## description

**Files** is everything related to file upload in Twake Drive.

Twake Drive Files upload support chunk upload and file encryption.

## Wording

**File:** document to upload, no constraint on the type of document \(image, text, pdf ..\)

**Chunk:** Large file are split in multiple chunk for the upload process

## Encryption

Files and Storage services in Twake Drive feature encryption at rest in **aes-256-gbc**. Or you can also set your desired algorithm is the Twake Drive configuration
```JSON
    {
      "database": {
        "encryption": "DB_ENCRYPTION_ALGORITHM"
      }
    }
```

Each file is encrypted with two layers:

- A file encryption key and iv stored in database and different for each file.
- A global encryption key and iv used in addition to the previous one and equal for each file.

## Models and APIs

[database-models](database-models.md)

## Miscellaneous

[resumablejs](resumablejs.md)
