/**
 * Builds `npx` argv for `modern-web install`.
 *
 * Important: `-y` appears twice for the default (non-`--choose`) path:
 * - First `-y` is consumed by `npx` (skip its package-install prompt).
 * - Second `-y` is passed through to `skills add` (skip its confirmation prompts).
 * Without the second `-y`, non-TTY environments abort with:
 * "Interactive prompt required but stdin is not a TTY..."
 *
 * When `choose` is set, omit the skills `-y` / `--skill` flags so the interactive
 * skill picker still works on a TTY.
 *
 * On Windows, pass `--copy` so `skills add` copies into agent directories instead of
 * creating symlinks (which often fail with EPERM without Developer Mode).
 */
export function buildSkillsInstallNpxArgs(options: {
  choose?: boolean;
  platform?: NodeJS.Platform;
} = {}): string[] {
  const platform = options.platform ?? process.platform;
  const args = [
    "-y",
    "skills",
    "add",
    "GoogleChrome/modern-web-guidance",
    ...(options.choose ? [] : ["-y", "--skill", "modern-web-guidance"]),
  ];

  if (platform === "win32") {
    args.push("--copy");
  }

  return args;
}
