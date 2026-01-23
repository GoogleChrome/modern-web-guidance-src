---
description: Enables programmatic control of printing from a Chrome extension by allowing users to submit print jobs, manage them, and retrieve printer information.
filename: chrome-printing
category: extensions
---

# Programmatic Printing with Chrome Extensions

This guide covers best practices for using the `chrome.printing` API to enable printing functionality within your Chrome extensions.

## Core Use Cases and Best Practices

The `chrome.printing` API allows extensions to interact with the user's printers. Here are the primary use cases and associated best practices:

### 1. Submitting Print Jobs

This is the most common use case, where your extension needs to send a document to a printer.

*   **Constructing a `ticket`:** The `ticket` object defines the printing preferences (e.g., color, duplex, page orientation, media size). You can retrieve printer-specific capabilities using `getPrinterInfo()` to construct an appropriate ticket. For specialized printing like roll paper, utilize `vendor_ticket_item` to specify finishing options.
*   **Creating a `SubmitJobRequest`:** This object bundles the printer ID, job title, the constructed `ticket`, and the content type.
*   **Providing the print data:** The data to be printed should be provided as a `Blob`. Ensure the `Blob`'s `type` matches the `contentType` in the `SubmitJobRequest`.
*   **Handling confirmation dialogs:** By default, submitting a job will trigger a user confirmation dialog. To bypass this for specific extensions, configure the `PrintingAPIExtensionsAllowlist` policy.

**Example:**

```javascript
async function printDocument(printerId, documentBlob) {
  // Retrieve printer capabilities to build an informed ticket
  const printerInfo = await chrome.printing.getPrinterInfo(printerId);

  // Example ticket construction (adapt based on printerInfo)
  const ticket = {
    version: '1.0',
    print: {
      color: { type: 'STANDARD_MONOCHROME' },
      duplex: { type: 'NO_DUPLEX' },
      page_orientation: { type: 'PORTRAIT' },
      copies: { copies: 1 },
      // Dynamically set media size if needed, e.g., from printerInfo.media_size.option
      media_size: {
        width_microns: 72320,
        height_microns: 100000
      },
      collate: { collate: false }
    }
  };

  const submitJobRequest = {
    job: {
      printerId: printerId,
      title: 'My Extension Print Job',
      ticket: ticket,
      contentType: 'application/pdf', // Or 'image/png', etc.
      document: documentBlob
    }
  };

  chrome.printing.submitJob(submitJobRequest, (response) => {
    if (response) {
      console.log(`Job submitted with status: ${response.status}`);
    } else if (chrome.runtime.lastError) {
      console.error(`Error submitting job: ${chrome.runtime.lastError.message}`);
    }
  });
}

// Example usage:
// const myBlob = new Blob([new Uint8Array(await getPrintData())], { type: 'application/pdf' });
// printDocument('printer-id-from-getPrinters', myBlob);
```

### 2. Managing Print Jobs

Extensions can monitor and cancel print jobs.

*   **Monitoring Job Status:** Use the `chrome.printing.onJobStatusChanged` event to receive real-time updates on a print job's status. This is crucial for providing user feedback, such as enabling or disabling a "Cancel" button.
*   **Canceling Jobs:** The `chrome.printing.cancelJob(jobId)` method allows you to terminate a print job. Ensure you handle potential errors and update the UI accordingly.

**Example:**

```javascript
chrome.printing.onJobStatusChanged.addListener((jobId, status) => {
  console.log(`Job ${jobId} status changed to: ${status}`);
  const cancelButton = document.getElementById("cancelButton");
  if (cancelButton) {
    if (status === "PENDING" || status === "IN_PROGRESS") {
      cancelButton.style.visibility = 'visible';
      cancelButton.onclick = () => {
        chrome.printing.cancelJob(jobId).then((response) => {
          if (response) console.log(`Cancel job response: ${response.status}`);
          if (chrome.runtime.lastError) console.error(chrome.runtime.lastError.message);
        });
      };
    } else {
      cancelButton.style.visibility = 'hidden';
    }
  }
});
```

### 3. Retrieving Printer Information

To provide a good user experience, it's often necessary to know which printers are available and their capabilities.

*   **Listing Printers:** Use `chrome.printing.getPrinters()` to get a list of available printers on the user's system.
*   **Getting Printer Details:** For each printer, call `chrome.printing.getPrinterInfo(printer.id)` to retrieve detailed information, including supported media sizes, color capabilities, and vendor-specific options. This information is vital for constructing accurate print tickets.

**Example:**

```javascript
async function listAndLogPrinters() {
  try {
    const printers = await chrome.printing.getPrinters();
    if (printers.length === 0) {
      console.log("No printers found.");
      return;
    }

    console.log("Available Printers:");
    for (const printer of printers) {
      console.log(`- ${printer.name} (ID: ${printer.id})`);
      const printerInfo = await chrome.printing.getPrinterInfo(printer.id);
      console.log(`  Description: ${printerInfo.description}`);
      console.log(`  Is Default: ${printerInfo.isDefault}`);

      if (printerInfo.media_size && printerInfo.media_size.option) {
        console.log("  Supported Media Sizes:");
        printerInfo.media_size.option.forEach(size => {
          console.log(`    - Width: ${size.width_microns}µm, Height: ${size.max_height_microns}µm, Continuous Feed: ${size.is_continuous_feed}`);
        });
      }
    }
  } catch (error) {
    console.error("Error retrieving printers:", error);
  }
}

// listAndLogPrinters();
```

## Manifest Requirements

All `chrome.printing` API features require the `"printing"` permission to be declared in your extension's manifest file.

```json
{
  "name": "My Printing Extension",
  "version": "1.0",
  "manifest_version": 3,
  "permissions": [
    "printing"
  ],
  // ... other manifest properties
}