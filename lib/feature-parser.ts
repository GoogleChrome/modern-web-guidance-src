export function extractFeatureIds(description: string): string[] {
  const featureIds = new Set<string>();

  // Pattern 1: GitHub form template:
  // ### web-feature-id
  //
  // value
  const formRegex = /### web-feature-id\s*\r?\n\s*([^\r\n#]+)/gi;
  let match;
  while ((match = formRegex.exec(description)) !== null) {
    const val = match[1].trim();
    if (val) featureIds.add(val);
  }

  // Pattern 2: Bold or plain label:
  // **Web Feature ID**: value
  // Web Feature ID: value
  // Feature ID: value
  const labelRegex = /(?:\*\*|)?(?:Web\s+)?Feature ID(?:\*\*|)?:\s*([^\r\n]+)/gi;
  while ((match = labelRegex.exec(description)) !== null) {
    const val = match[1].trim();
    if (val) featureIds.add(val);
  }

  // Pattern 3: webstatus.dev URLs:
  // https://webstatus.dev/features/value
  const urlRegex = /https:\/\/webstatus\.dev\/features\/([a-zA-Z0-9_-]+)/gi;
  while ((match = urlRegex.exec(description)) !== null) {
    const val = match[1].trim();
    if (val) featureIds.add(val);
  }

  const cleanedFeatures = new Set<string>();
  for (const id of featureIds) {
    if (id.startsWith('http://') || id.startsWith('https://')) {
      try {
        const url = new URL(id);
        const parts = url.pathname.split('/').filter(Boolean);
        const lastPart = parts[parts.length - 1];
        if (lastPart) {
          cleanedFeatures.add(lastPart);
        }
      } catch {
        cleanedFeatures.add(id);
      }
    } else {
      const clean = id.replace(/^[`*_\u00a0]+|[`*_\u00a0]+$/g, '').trim();
      if (clean) {
        cleanedFeatures.add(clean);
      }
    }
  }

  return Array.from(cleanedFeatures);
}
