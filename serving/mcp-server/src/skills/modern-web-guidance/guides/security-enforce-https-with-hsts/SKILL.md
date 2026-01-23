---
description: Implement HTTP Strict Transport Security (HSTS) to enforce secure HTTPS connections and improve website performance by eliminating insecure HTTP redirects.
filename: enforce-https-with-hsts
category: security
---

# Enforce HTTPS with HSTS

Reference docs:
- https://developer.mozilla.org/docs/Web/HTTP/Headers/Strict-Transport-Security
- https://hstspreload.org/

## Best Practices

HSTS (HTTP Strict Transport Security) is an important security mechanism that tells browsers to only interact with your site using secure HTTPS connections. This prevents insecure HTTP connections and mitigates man-in-the-middle attacks.

### Initial Rollout

When deploying HSTS, it's crucial to start with a small `max-age` value to test your infrastructure. This allows you to catch any potential issues with subdomains or other resources not being correctly configured for HTTPS before a wider audience is affected.

```http
Strict-Transport-Security: max-age=10
```

### Incremental Increases

After a successful initial rollout with a minimal `max-age`, gradually increase the duration of the HSTS policy. This phased approach ensures continued stability as the policy's scope expands.

```http
Strict-Transport-Security: max-age=3600
```

### Full Deployment

Once you are confident that all aspects of your website and its subdomains are correctly serving over HTTPS, set a long `max-age` for comprehensive security. It is recommended to set `max-age` to one or two years for fully rolled-out HSTS policies.

```http
Strict-Transport-Security: max-age=63072000
```

### HSTS Preload List

To ensure even the very first visit to your website is secure (as HSTS policies only take effect after the first HTTPS visit), consider submitting your domain to the HSTS preload list. This hardcoded list in browsers ensures immediate HTTPS enforcement.

- Visit https://hstspreload.org/ to learn more about submitting your domain.

### Cautions

- **DO NOT** deploy HSTS if you are not prepared to serve all your content over HTTPS. Botching an HSTS deployment can lead to users being unable to access your site.
- **DO** ensure all subdomains and linked resources are accessible via HTTPS before implementing a long `max-age` or submitting to the preload list.
- **DO** monitor your website closely during and after HSTS deployment for any unexpected behavior.

### `.dev` Domains

- **NOTE:** Domains with the `.dev` top-level domain (TLD) are automatically included in the HSTS preload list and require a valid SSL certificate to function.