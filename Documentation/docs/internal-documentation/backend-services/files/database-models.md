---
description: File database models
---
# Database models

*   **files** The main file object in database

```Typescript
    export class File {
        company_id: string;
        id: string;
        user_id: string;
        application_id: null | string;
        encryption_key: string;
        updated_at: number;
        created_at: number;
        metadata: null | {
            name?: string;
            mime?: string;
            thumbnails_status?: "done" | "error" | "waiting";
        };
        thumbnails: Thumbnail[];
        upload_data: null | {
            size: number;
            chunks: number;
        };
    }
```
