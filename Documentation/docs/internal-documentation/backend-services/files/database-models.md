---
description: File database models
---
<!-- TODO[NOT UP TO DATE] -->
# Database models

*   **files** The main file object in database

    ```javascript
      
    javascript
      {
        
        //Primary key: [["company_id"], "id"]
        "company_id": "uuid-v4",
        "id": "uuid-v4",
        "user_id": "string",
        "application_id": "string",
        "updated_at": "number", 
        "created_at":"number
          
        "upload_data": (json){
          "size": number, //Total file size
          "chunks": number, //Number of chunks
         }
        "metadata": (json){
          "name": "string", //File name
          "mime": "type/subtype",
        }
        "thumbnails": (json) {  //Url to thumbnail (or set it to undefined if no relevant)
          "index": "string",
          "id": "uuid-v4",
          "type": "string",
          "size": "number,
          "width": number, //Thumbnail width (for images only)
          "height": number, //Thumbnail height (for images only)
        }
    }

    ```
