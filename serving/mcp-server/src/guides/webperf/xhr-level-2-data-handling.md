---
description: Leverage XMLHttpRequest Level 2 to send and receive various data formats, including binary data and form submissions, for enhanced web application functionality.
filename: xhr-level-2-data-handling
category: webperf
---

# XMLHttpRequest Level 2 for Enhanced Data Handling

XMLHttpRequest Level 2 (XHR2) significantly enhances the capabilities of `XMLHttpRequest` objects, enabling more sophisticated AJAX interactions. This guide focuses on best practices for sending and receiving diverse data types, improving performance and user experience in web applications.

## Best Practices

### Receiving Data in Various Formats

XHR2 introduces `responseType` and `response` properties, allowing developers to specify and access data in formats other than plain text.

*   **Use `responseType = 'blob'` for binary data like images:** This is ideal when you need to work with files directly without byte manipulation. It simplifies tasks like displaying images fetched from a server.

    ```js
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/path/to/image.png', true);
    xhr.responseType = 'blob';

    xhr.onload = function(e) {
      if (this.status == 200) {
        var blob = this.response;
        var img = document.createElement('img');
        img.onload = function(e) {
          window.URL.revokeObjectURL(img.src); // Clean up after yourself.
        };
        img.src = window.URL.createObjectURL(blob);
        document.body.appendChild(img);
      }
    };

    xhr.send();
    ```

*   **Use `responseType = 'arraybuffer'` for raw binary data manipulation:** This is useful when you need to process raw bytes, for example, when working with audio or video data, or for low-level data processing. JavaScript typed arrays can then be used to interpret the `ArrayBuffer`.

    ```js
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/path/to/binary_data', true);
    xhr.responseType = 'arraybuffer';

    xhr.onload = function(e) {
      var uInt8Array = new Uint8Array(this.response); // this.response == uInt8Array.buffer
      // Process the byte data using uInt8Array
    };

    xhr.send();
    ```

*   **Avoid `overrideMimeType('text/plain; charset=x-user-defined')`:** This is an outdated hack for handling binary data. Prefer `responseType` for cleaner and more reliable results.

### Sending Data in Various Formats

The `send()` method in XHR2 can now accept a wider range of data types, simplifying data submission.

*   **Use `FormData` for form submissions, including file uploads:** `FormData` simplifies sending form data asynchronously, especially when dealing with file inputs. It handles `multipart/form-data` encoding automatically.

    *   **Creating `FormData` dynamically:**

        ```js
        function sendForm() {
          var formData = new FormData();
          formData.append('username', 'johndoe');
          formData.append('id', 123456);

          var xhr = new XMLHttpRequest();
          xhr.open('POST', '/server', true);
          xhr.onload = function(e) { /* handle response */ };
          xhr.send(formData);
        }
        ```

    *   **Initializing `FormData` from an existing HTML form:**

        ```html
        <form id="myform" name="myform" action="/server">
          <input type="text" name="username" value="johndoe">
          <input type="number" name="id" value="123456">
          <input type="submit" onclick="return sendForm(this.form);">
        </form>
        ```

        ```js
        function sendForm(form) {
          var formData = new FormData(form);
          formData.append('secret_token', '1234567890'); // Append extra data

          var xhr = new XMLHttpRequest();
          xhr.open('POST', form.action, true);
          xhr.onload = function(e) { /* handle response */ };
          xhr.send(formData);

          return false; // Prevent default form submission
        }
        ```

    *   **Uploading files:**

        ```js
        document.querySelector('input[type="file"]').addEventListener('change', function(e) {
          var files = this.files;
          var formData = new FormData();

          for (var i = 0, file; file = files[i]; ++i) {
            formData.append(file.name, file);
          }

          var xhr = new XMLHttpRequest();
          xhr.open('POST', '/upload_server', true);
          xhr.onload = function(e) { /* handle response */ };
          xhr.send(formData); // Sends as multipart/form-data
        }, false);
        ```

*   **Use `xhr.send(Blob)` or `xhr.send(File)` for uploading file-like objects:** This is direct and efficient for sending file content. Implement upload progress listeners for better user feedback.

    ```html
    <progress min="0" max="100" value="0">0% complete</progress>
    ```

    ```js
    function upload(blobOrFile) {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', '/server', true);
      xhr.onload = function(e) { /* handle response */ };

      // Listen to the upload progress.
      var progressBar = document.querySelector('progress');
      xhr.upload.onprogress = function(e) {
        if (e.lengthComputable) {
          progressBar.value = (e.loaded / e.total) * 100;
          progressBar.textContent = progressBar.value;
        }
      };

      xhr.send(blobOrFile);
    }

    // Example: Uploading a Blob created from text
    upload(new Blob(['hello world'], {type: 'text/plain'}));
    ```

*   **Use `xhr.send(ArrayBuffer)` for sending raw byte buffers:** This is useful when you have binary data in an `ArrayBuffer` and need to send it directly to the server.

    ```js
    function sendArrayBuffer() {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', '/server', true);
      xhr.onload = function(e) { /* handle response */ };

      var uInt8Array = new Uint8Array([1, 2, 3]);
      xhr.send(uInt8Array.buffer);
    }
    ```

### Handling Cross-Origin Resource Sharing (CORS)

CORS is crucial for enabling AJAX requests between different domains.

*   **Server-side Configuration:** The server must include the `Access-Control-Allow-Origin` header in its responses to permit cross-origin requests.

    *   To allow a specific origin:
        ```http
        Access-Control-Allow-Origin: http://example.com
        ```
    *   To allow any origin (use with caution):
        ```http
        Access-Control-Allow-Origin: *
        ```

*   **Client-side Implementation:** If the server has enabled CORS, making a cross-domain request is the same as making a same-domain request using `XMLHttpRequest`.

    ```js
    var xhr = new XMLHttpRequest();
    xhr.open('GET', 'http://www.example2.com/api/data');
    xhr.onload = function(e) {
      // Process the response
      var data = JSON.parse(this.response);
      // ...
    }
    xhr.send();
    ```

## Practical Use Cases

### Downloading and Saving Files to the HTML5 File System

Fetch resources as `Blob`s and write them to the local file system for offline access or storage.

```js
window.requestFileSystem  = window.requestFileSystem || window.webkitRequestFileSystem;

function onError(e) {
  console.error('Error:', e);
}

var xhr = new XMLHttpRequest();
xhr.open('GET', '/path/to/image.png', true);
xhr.responseType = 'blob';

xhr.onload = function(e) {
  if (this.status === 200) {
    window.requestFileSystem(TEMPORARY, 1024 * 1024, function(fs) {
      fs.root.getFile('image.png', {create: true}, function(fileEntry) {
        fileEntry.createWriter(function(writer) {
          writer.onwrite = function(e) { console.log('Write complete'); };
          writer.onerror = function(e) { console.error('Write error:', e); };
          var blob = new Blob([xhr.response], {type: 'image/png'});
          writer.write(blob);
        }, onError);
      }, onError);
    }, onError);
  }
};

xhr.send();
```

### Slicing and Uploading Large Files in Chunks

Break down large files into smaller chunks and upload them individually. This improves resilience and can bypass server request size limits.

```js
function uploadChunk(blob) {
  var xhr = new XMLHttpRequest();
  xhr.open('POST', '/upload_chunk_server', true);
  xhr.onload = function(e) { /* handle response */ };
  xhr.send(blob);
}

document.querySelector('input[type="file"]').addEventListener('change', function(e) {
  var fileBlob = this.files[0];
  const BYTES_PER_CHUNK = 1024 * 1024; // 1MB chunk size
  const SIZE = fileBlob.size;

  var start = 0;
  var end = BYTES_PER_CHUNK;

  while(start < SIZE) {
    uploadChunk(fileBlob.slice(start, end));
    start = end;
    end = start + BYTES_PER_CHUNK;
  }
}, false);