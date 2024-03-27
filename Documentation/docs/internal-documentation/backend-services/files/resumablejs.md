---
description: How we use resumable on Twake Drive
---

# Resumable.js

**Link to the official documentation:** [http://resumablejs.com](http://resumablejs.com/)

## What is Resumable.js

::: info
Using Resumable is not mandatory to upload a file to Twake Drive. You can do it manually, see REST APIs page.
:::

It’s a JavaScript library providing multiple simultaneous, stable and resumable uploads via the HTML5 File API.

The library is designed to introduce fault-tolerance into the upload of large files through HTTP. This is done by splitting each files into small chunks; whenever the upload of a chunk fails, uploading is retried until the procedure completes. This allows uploads to automatically resume uploading after a network connection is lost either locally or to the server. Additionally, it allows for users to pause, resume and even recover uploads without losing state.

Resumable.js does not have any external dependencies other the `HTML5 File API`. This is relied on for the ability to chunk files into smaller pieces. Currently, this means that support is limited to Firefox 4+ and Chrome 11+.

## What Resumable.js does

In Frontend side resumable split the file in multiple small chunks. For the upload process resumable ask the server with an HTTP GET request to know if the chunk requested is saved on the server side. If yes, resumable ask for the next chunk. If not, resumable send an HTTP POST request with the chunk to the server.

With POST request from resumable, there is multiple information fields contains for exemple the number of chunk, the chunk size, the total size of the file, an unique identifier for the file, and the name of the file.
