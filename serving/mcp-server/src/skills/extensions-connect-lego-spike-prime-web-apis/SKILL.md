---
description: Connect LEGO Education SPIKE Prime kits to computers using Web Bluetooth and Web Serial APIs for programming and control.
filename: connect-lego-spike-prime-web-apis
category: extensions
---

# Connect LEGO® Education SPIKE™ Prime with Web APIs

Reference docs:
- [Web Bluetooth API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API)
- [Web Serial API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API)

## Best Practices

LEGO Education SPIKE Prime hubs can be connected to a computer via Bluetooth or USB. The SPIKE web app leverages the Web Bluetooth API for Bluetooth connections and the Web Serial API for USB connections.

### Connecting via Bluetooth

When using Bluetooth, the Web Bluetooth API is employed to discover and connect to the SPIKE Prime hub. You'll need to request a device with a specific service UUID.

```js
navigator.bluetooth.requestDevice({
  filters: [
    {
      namePrefix: 'GDX', // Common prefix for LEGO SPIKE devices
    },
  ],
  optionalServices: ['d91714ef-28b9-4f91-ba16-f0d9a604f112'], // SPIKE service UUID
});
```

### Connecting via USB

For USB connections, the Web Serial API is used. You'll need to request a serial port, filtering by the LEGO vendor ID.

```js
const port = await navigator.serial.requestPort({
  filters: [{
    usbVendorId: 1684 // LEGO Vendor ID
  }]
});
await port.open({
  baudRate: 115200 // Standard baud rate for SPIKE hub
});
```

## Reasons to go web-first and use web hardware APIs

Using web APIs for connecting hardware like the LEGO SPIKE Prime hub offers several advantages:

### Reduced Maintenance Burden

LEGO can maintain a single web application rather than multiple platform-specific applications (Android, macOS, Windows). This significantly reduces development and maintenance effort.

### Smaller Download Sizes

Web applications are typically smaller in download size compared to native applications. For instance, the SPIKE web app is much smaller than its native counterparts, and lesson content can be streamed, meaning users only download what they need.

### Simplified Classroom Use

Students don't need to install or update applications. They can access the latest version simply by following a link, which also allows LEGO to push content updates instantly without app store review processes.

## Tinker with LEGO on the web

The ability to communicate with physical LEGO models directly from the browser opens up numerous possibilities for educational, creative, and entertainment applications. Projects like PyREPL-JS and Web Interfaces for SPIKE Prime demonstrate the potential for students and developers to interact with the SPIKE hub and create custom projects.

By enabling browser-based communication with the SPIKE hub via Web Bluetooth and Web Serial APIs, developers can unlock new avenues for creativity and learning.