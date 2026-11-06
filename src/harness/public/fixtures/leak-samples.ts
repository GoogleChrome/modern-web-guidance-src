/**
 * Synthetic examples of the identifying strings the scrubber must catch.
 *
 * Everything here is made up. Tests import these instead of writing literal
 * paths or hostnames so that no real LDAP, machine name, or address ever
 * appears in the test suite, and so the shapes are reviewed in one place.
 */

/** A username that does not belong to anyone. */
export const FAKE_LDAP = 'exampleuser';
export const OTHER_FAKE_LDAP = 'anotheruser';
/** Stands in for `os.userInfo().username` so tests never depend on who runs them. */
export const FAKE_OS_USER = 'workstationuser';

export const CLOUDTOP_HOME = `/usr/local/google/home/${FAKE_LDAP}`;
export const LINUX_HOME = `/home/${FAKE_LDAP}`;
export const MACOS_HOME = `/Users/${FAKE_LDAP}`;
export const WINDOWS_HOME = `C:\\Users\\${FAKE_LDAP}`;
/** Forward slashes, as Git Bash and `file:///C:/Users/...` URLs write it. */
export const WINDOWS_HOME_FORWARD = `C:/Users/${FAKE_LDAP}`;
/** As it appears inside a JSON string: each backslash doubled. */
export const WINDOWS_HOME_JSON = `C:\\\\Users\\\\${FAKE_LDAP}`;
export const CITC_PATH = `/google/src/cloud/${FAKE_LDAP}/ws`;
export const COG_PATH = `/google/cog/cloud/${FAKE_LDAP}/ws`;
/** A Windows home seen through WSL. */
export const WSL_HOME = `/mnt/c/Users/${FAKE_LDAP}`;
/** A home directory written with backslashes but no drive letter, as UNC paths and some escaped JSON do. */
export const UNC_HOME = `\\\\home\\\\${FAKE_LDAP}`;

/** Credential shapes. None of these are real keys; they only have the right prefix and length. */
export const FAKE_GOOGLE_API_KEY = `AIzaSy${'X'.repeat(33)}`;
export const FAKE_SK_KEY = `sk-${'x'.repeat(24)}`;
export const FAKE_OAUTH_TOKEN = `ya29.${'a'.repeat(40)}`;
export const FAKE_GITHUB_TOKEN = `ghp_${'A'.repeat(36)}`;
export const PRIVATE_KEY_HEADER = '-----BEGIN RSA PRIVATE KEY-----';
export const FAKE_PRIVATE_KEY_BODY = 'MIIEpAIBAAKCAQEA' + 'A'.repeat(48);

export const CLOUDTOP_HOST = `${FAKE_LDAP}.c.googlers.com`;
export const CORP_HOST = `${FAKE_LDAP}-desk.corp.google.com`;
export const GOOGLE_EMAIL = `${FAKE_LDAP}@google.com`;

/** A checkout under the Cloudtop home, with a worktree-style suffix. */
export const REPO_CHECKOUT = `${CLOUDTOP_HOME}/code/modern-web-guidance-src`;
export const REPO_CHECKOUT_SUFFIXED = `~/mwg2/modern-web-guidance-src-2`;
