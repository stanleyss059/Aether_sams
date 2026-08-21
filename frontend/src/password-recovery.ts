const STORAGE_KEY = "aether.passwordRecovery";

export function markPasswordRecovery() {
  try {
    sessionStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // Recovery still works for this tab if routing already landed on /reset-password.
  }
}

export function clearPasswordRecovery() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore blocked storage.
  }
}

export function isPasswordRecovery() {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function detectRecoveryLink() {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const query = new URLSearchParams(window.location.search);
  if (hash.get("type") === "recovery" || query.get("type") === "recovery") {
    markPasswordRecovery();
    return true;
  }
  return false;
}
