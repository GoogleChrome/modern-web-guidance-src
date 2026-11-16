export const MIN_NODE_VERSION = 22;

export function formatNodeVersionError(currentVersion: string = process.version): string {
  return `modern-web-guidance requires Node.js >= ${MIN_NODE_VERSION} (current: ${currentVersion}). Please upgrade: https://nodejs.org/`;
}

export function checkNodeVersion(versionString: string = process.versions.node): boolean {
  const major = parseInt(versionString.split('.')[0], 10);
  return !Number.isNaN(major) && major >= MIN_NODE_VERSION;
}

export function ensureNodeVersion(
  nodeVersion: string = process.versions.node,
  fullVersion: string = process.version,
  exit: (code: number) => void = process.exit
): void {
  if (!checkNodeVersion(nodeVersion)) {
    console.error(formatNodeVersionError(fullVersion));
    exit(1);
  }
}
