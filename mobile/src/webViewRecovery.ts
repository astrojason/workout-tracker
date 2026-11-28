/**
 * iOS kills a WebView's web content process to reclaim memory, typically while the app sits in
 * the background. The WebView then draws nothing and never recovers on its own, leaving a blank
 * screen until the app is force-quit. Reloading brings the page back; an active workout survives
 * because the web app keeps it in localStorage.
 */
export function recoverFromKilledPage(view: { reload: () => void } | null, setLoading: (loading: boolean) => void): void {
  setLoading(true);
  if (!view) throw new Error("The web page was closed by iOS, and the WebView isn't available to reload it. Close and reopen the app.");
  view.reload();
}
