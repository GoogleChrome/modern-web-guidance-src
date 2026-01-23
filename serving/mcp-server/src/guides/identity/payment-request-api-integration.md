---
description: Integrate Payment Request API for seamless and secure online transactions within your web applications.
filename: payment-request-api-integration
category: identity
---

# Integrating the Payment Request API

The Payment Request API provides a standardized way for web applications to handle online payments, offering a more seamless and secure user experience compared to traditional checkout flows. This guide outlines best practices for its integration.

## Best Practices

When implementing the Payment Request API, consider the following:

### Specifying Payment Methods

*   **DO** clearly define supported payment methods using the `supportedMethods` property. This can be a string for a single method (e.g., `'basic-card'`) or an array of strings for multiple methods.
*   **DO** leverage the `basic-card` method to support common card types like Visa, Mastercard, and Amex.
*   **DO** provide card-specific details within the `data` object, such as `supportedNetworks` and `supportedTypes` (e.g., `'credit'`, `'debit'`, `'prepaid'`).
*   **DO** be aware that in older Chrome versions (like 57), `supportedTypes` might be ignored, and all specified networks may be treated as credit cards.

```javascript
// Example: Defining supported methods with basic-card
let methods = [{
  supportedMethods: 'basic-card',
  data: {
    supportedNetworks: ['visa', 'mastercard', 'amex'],
    supportedTypes: ['credit', 'debit']
  }
}, {
  supportedMethods: 'https://some-payment-provider.com'
}];
```

### Detailing Payment Details

*   **DO** use the `details` object to describe the items being purchased, including `displayItems` and the `total` amount.
*   **DO** utilize the `pending` field within display items to indicate amounts that are not yet finalized, such as shipping or tax, which can be dynamically updated.
*   **DO** implement `PaymentDetailsModifier` to apply conditional discounts or extra charges based on the selected payment method. This involves adding a `modifiers` array to the `details` object.

```javascript
// Example: Defining payment details with modifiers
let details = {
  displayItems: [{
    label: 'T-shirt',
    amount: { currency: 'USD', value: '68.00' }
  }, {
    label: 'Shipping',
    amount: { currency: 'USD', value: '5.00' },
    pending: true // Shipping cost may change
  }],
  total: {
    label: 'Total price',
    amount: { currency: 'USD', value: '73.00' }
  },
  modifiers: [{
    supportedMethods: 'basic-card',
    total: {
      label: 'Credit card total',
      amount: { currency: 'USD', value: '73.00' }
    },
    additionalDisplayItems: [{
      label: 'Card processing fee',
      amount: { currency: 'USD', value: '3.00' }
    }]
  }]
};
```

### Requesting Payer Information

*   **DO** use the `options` object to specify additional requests, such as `requestPayerName` to prompt the user for their name separately from their shipping address.
*   **DO** configure `shippingType` within the `options` to customize the UI for "delivery" or "pickup" instead of the default "shipping."

```javascript
// Example: Requesting payer name and setting shipping type
let options = {
  requestPayerName: true,
  shippingType: 'delivery'
};
```

### Handling Payment Responses

*   **DO** use `PaymentRequest.show()` to display the payment sheet and obtain a `PaymentResponse` object.
*   **DO** call the `toJSON()` method on `PaymentResponse` and `PaymentAddress` objects to easily serialize them into JSON format for further processing or storage.

```javascript
// Example: Handling payment response
let request = new PaymentRequest(methods, details, options);
request.show().then(response => {
  let responseJson = response.toJSON();
  console.log('Payment Response:', responseJson);
  // Process the payment with your backend
  response.complete('success');
}).catch(error => {
  console.error('Payment request failed:', error);
});
```

### Checking Payment Availability

*   **DO** utilize the `request.canMakePayment()` method to proactively check if the user has any active payment methods configured *before* invoking `request.show()`. This can help streamline the user experience by avoiding unnecessary UI prompts.

```javascript
// Example: Checking payment availability
if (request.canMakePayment) {
  request.canMakePayment().then(result => {
    if (result) {
      console.log('Payment methods are available.');
      // Proceed to show the payment request
    } else {
      console.log('No payment methods available, but user can add one.');
    }
  }).catch(error => {
    console.error('Error checking payment availability:', error);
  });
}
```

### iframe Integration

*   **DO** enable the Payment Request API within iframes by adding the `allowpaymentrequest` attribute to the `iframe` element.

```html
<iframe src="/payment-flow.html" allowpaymentrequest></iframe>
```

## Fallback Strategies

While the Payment Request API is widely supported, consider the following for broader compatibility:

*   **DO** implement feature detection for `PaymentRequest` and `canMakePayment` to gracefully handle environments where the API is not available.
*   **DO** provide alternative checkout methods (e.g., a traditional form-based checkout) as a fallback for users on unsupported browsers or platforms.