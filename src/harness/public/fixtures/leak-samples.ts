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

export const CLOUDTOP_HOME = `/usr/local/google/home/${FAKE_LDAP}`;
export const LINUX_HOME = `/home/${FAKE_LDAP}`;
export const MACOS_HOME = `/Users/${FAKE_LDAP}`;
export const WINDOWS_HOME = `C:\\Users\\${FAKE_LDAP}`;
export const CITC_PATH = `/google/src/cloud/${FAKE_LDAP}/ws`;

export const CLOUDTOP_HOST = `${FAKE_LDAP}.c.googlers.com`;
export const CORP_HOST = `${FAKE_LDAP}-desk.corp.google.com`;
export const GOOGLE_EMAIL = `${FAKE_LDAP}@google.com`;

/** A checkout under the Cloudtop home, with a worktree-style suffix. */
export const REPO_CHECKOUT = `${CLOUDTOP_HOME}/code/modern-web-guidance-src`;
export const REPO_CHECKOUT_SUFFIXED = `~/mwg2/modern-web-guidance-src-2`;
