const ADD_RETURN_KEY = "cointraq-add-return";

/** Record an explicit in-app transition to Add, including the current query. */
export function rememberAddReturnPath(): void {
  try {
    const path = `${window.location.pathname}${window.location.search}`;
    if (path === "/add" || path.startsWith("/add?")) return;
    sessionStorage.setItem(ADD_RETURN_KEY, path);
  } catch {}
}

/** Consume the one-shot return path; direct visits safely fall back home. */
export function consumeAddReturnPath(): string {
  try {
    const path = sessionStorage.getItem(ADD_RETURN_KEY);
    sessionStorage.removeItem(ADD_RETURN_KEY);
    if (path?.startsWith("/") && !path.startsWith("//") && path !== "/add" && !path.startsWith("/add?")) {
      return path;
    }
  } catch {}
  return "/";
}
