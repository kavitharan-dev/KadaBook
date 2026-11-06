/** Web build: the dev server is wherever the page itself was loaded from. */
export function getDevServerOrigin(): string {
  return typeof window !== 'undefined' ? window.location.origin : '';
}
