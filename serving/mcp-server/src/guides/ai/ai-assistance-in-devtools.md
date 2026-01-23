---
description: Utilize AI assistance within Chrome DevTools to understand website functionality, debug issues, and gain insights into styling, network requests, sources, and performance.
filename: ai-assistance-in-devtools
category: ai
---

# AI Assistance in DevTools

This guide covers how to leverage the AI Assistance panel in Chrome DevTools to understand your website's workings with AI.

## Overview

The **AI assistance panel** allows you to interact with Gemini directly within DevTools. Conversations initiated from this panel are automatically contextualized with technical details about the inspected page. You can use provided example prompts or your own questions to start conversations and ask follow-up questions to resolve tasks.

Chats in the **AI assistance** panel can help you understand:

*   **Styling**: Inquire about elements from the DOM tree to understand their display, interactions, and to get potential fixes for styling challenges.
*   **Network requests**: Ask about requests made by your page to understand their origin, duration, or failure reasons.
*   **Sources**: Get information about files loaded by your web page, their contents, and their purpose.
*   **Performance**: Ask questions about activities in a performance profile recorded in the Performance panel and receive suggestions for improvement.

## Requirements

To use the **AI assistance** panel, ensure you meet the following requirements:

*   **Chrome version**: Use a recent version of Chrome.
*   **AI Innovations enabled**: For unmanaged users, ensure AI Innovations are enabled in DevTools settings. For managed environments, administrators control this via the `DevToolsGenAiSettings` Enterprise policy.

## How Your Data is Used

This notice, along with Google's privacy notice, details how AI Innovations in Chrome DevTools handle your data.

Chrome DevTools **AI assistance** uses data exposed by the inspected page through Web APIs. Depending on your organization's settings, data may be used for model training to improve and develop Google products, services, and machine learning technologies.

Human reviewers may access input data, generated output, related feature usage, and your feedback for quality assurance and product improvement. Avoid including sensitive or personal information in your prompts or feedback. Your data will be stored in a de-identified manner and retained for up to 18 months. Data collection for product improvement may be disabled if your Google Account is managed by an organization.

Key points to remember when using **AI assistance**:

*   **Experimental technology**: This feature uses experimental technology and may produce inaccurate or offensive content. Your feedback (voting on responses) helps improve it.
*   **Subject to change**: This feature is experimental and may be updated or changed in the future.
*   **Code snippet caution**: Use generated code snippets with care.

Your use of **AI assistance** is subject to the [Google Terms of Service](https://policies.google.com/terms).

## Known Issues

**AI assistance** relies on Google's large language models (LLMs). LLMs are an active research area, and their responses can sometimes be questionable or incorrect. Always double-check the generated information.

### Wrong Explanations

LLMs can generate content that sounds plausible but may be misleading or inaccurate. While they often provide useful insights, they might sometimes produce:

*   Hallucinated CSS features, properties, or syntax.
*   References to non-existent elements or class names.

You can help improve accuracy by submitting feedback when you encounter incorrect explanations.

### Prompt Injection

Like many LLM applications, this feature is susceptible to prompt injection, where the LLM can be tricked into accepting unintended instructions.

For example, a user might ask the AI to respond in a specific style (like Renaissance language) and about a renaissance-themed background color. The AI might then provide a response in that style, demonstrating its susceptibility to such instructions.