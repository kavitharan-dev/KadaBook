/**
 * Native build (ios/android): React Native's own canonical way to find the
 * Metro dev server's address (used internally for the dev menu / Flipper),
 * via the proper Codegen spec rather than the legacy NativeModules.SourceCode
 * bridge access, which isn't reliable under the new architecture
 * (TurboModules).
 *
 * This file is intentionally separate from devServerOrigin.web.ts: Metro
 * resolves `./devServerOrigin` to the `.web.ts` sibling for web builds and
 * never parses this one there. Importing
 * `react-native/Libraries/Core/Devtools/getDevServer` directly from code
 * that's bundled for web breaks the build (it pulls in a native-only
 * NativeSourceCode spec with no web shim) even if the call itself is
 * wrapped in a runtime `Platform.OS` check -- Metro's bundler statically
 * resolves every `require`/`import` it sees regardless of surrounding
 * conditionals, so the only way to keep it out of the web bundle is to keep
 * it out of this file's web counterpart entirely.
 */
export function getDevServerOrigin(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const getDevServer = require('react-native/Libraries/Core/Devtools/getDevServer').default as () => { url: string };
    return getDevServer().url.replace(/\/$/, '');
  } catch {
    return '';
  }
}
