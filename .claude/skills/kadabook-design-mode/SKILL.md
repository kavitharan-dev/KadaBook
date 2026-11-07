---
name: kadabook-design-mode
description: Wire a KadaBook screen into the in-app visual Design Mode (select a widget, drag/resize it, Save writes the new value straight into that screen's designConfig file as the new default). Use this when asked to make a screen's spacing/sizing visually editable, or to extend Design Mode to a screen beyond Login.
---

# KadaBook Design Mode

A dev-only, self-serve visual tuning tool, built because repeatedly round-tripping
"make the logo bigger" / "move this up" through chat was the wrong workflow.
Live in `src/devtools/designMode/`, wired up on all three auth screens
(`src/screens/LoginScreen.tsx`, `src/screens/AuthScreens.tsx` for Forgot
Password and Create Account) — `LoginScreen.tsx` is the clearest single-screen
reference; `AuthScreens.tsx` shows the pattern repeated twice in one file with
two separate `designConfig` files (`forgotPassword.ts`, `signUp.ts`).

Also wired on the Home dashboard (`src/screens/HomeScreen.tsx`, `designConfig/home.ts`
— currently just the `closeDayButton` widget: height, borderRadius, marginTop) and on
the shared bottom tab bar (`src/components/AppTabBar.tsx`, `designConfig/tabBar.ts`
— the `bar` widget: paddingTop/paddingHorizontal/paddingVertical/borderRadius/minBottomGap).
The tab bar is a good example of the "shared chrome, not owned by any one screen" case:
it's rendered once via the `Tab.Navigator`'s `tabBar` prop (`AuthenticatedAppStack.tsx`),
not inside a screen file, so its `Designable` wraps it directly inside `AppTabBar.tsx`
itself under its own pseudo-screen name (`"tabBar"`) rather than being threaded from
wherever it's used — same reasoning as wrapping a shared component where it's rendered,
just with no single screen to attribute it to.

## How it works end to end

1. A screen's tunable numeric values live in `src/designConfig/<screen>.ts`
   as a plain `export const <screen>Layout = { widgetId: {key: number, ...}, ... } as const;`
   object — nothing else, no component logic. The screen imports this and
   uses the values instead of hardcoded literals.
2. The screen wraps each tunable element in `<Designable screen="<screen>" id="widgetId" base={...}>{(v) => ...}</Designable>`
   (`src/devtools/designMode/Designable.tsx`). Outside `__DEV__`, or when
   Design Mode is off, this is a transparent passthrough — zero behavior or
   performance change.
3. A floating toggle (bottom-right, 🎨) and a steppers panel are mounted once
   near the app root (`App.tsx` → `DesignModeProvider` + `DesignModeOverlay`)
   — not per-screen. Turning Design Mode on outlines every `Designable` on
   the current screen; tapping one selects it and shows +/- steppers for its
   values, plus a drag handle (resize corner and/or vertical nudge,
   depending on what the screen wired up).
4. **Save** POSTs the full merged value set for that screen to a Metro dev
   middleware (`metro.config.js`, route `POST /__design/save`), which
   rewrites `src/designConfig/<screen>.ts` on disk. Metro Fast Refresh picks
   up the change immediately — the new values are now the real default, no
   code edit needed. **This only works while connected to the local Metro
   dev server** (`npm start` / `npm run web`) — it cannot write anything on
   an already-built/installed app, by design (there's no "write to a shared
   backend" path here; see the architecture plan this was built from for why).

## Wiring a new screen

Using `LoginScreen.tsx` as the template:

1. Create `src/designConfig/<screen>.ts` with the screen's current hardcoded
   values, one top-level key per tunable widget (e.g. `hero`, `card`,
   `footer`). Each widget's value is a flat `Record<string, number>`.
2. In the screen, replace the hardcoded literals with `<screen>Layout.widgetId.key`.
3. Wrap each tunable element:
   ```tsx
   <Designable screen="<screen>" id="hero" base={screenLayout.hero} resizeKeys={['width', 'height']}>
     {(v) => <Image style={{ width: v.width, height: v.height }} ... />}
   </Designable>
   ```
   - `resizeKeys: [widthKey, heightKey]` — adds a corner drag handle that
     adjusts both at once (use for things sized by width+height, like a logo).
   - `offsetKey: string` — adds a single vertical-drag handle for one value
     (use for a height, margin, or padding — anything that's one number).
     A widget **can use both at once** (e.g. the logo has `resizeKeys` for
     size *and* `offsetKey="marginTop"` for position — both handles show
     together when selected). Any OTHER keys in `base` still get steppers in
     the panel even without a drag handle (drag is for coarse adjustment,
     steppers are for exact values).
   - **Give every widget both a size-ish key and a position-ish key where it
     makes sense** (e.g. `{width, height, marginTop}`, or `{height,
     marginBottom}`), not just whichever one was asked for first — the point
     of this tool is that one widget exposes padding/margin/position/size
     together so it's "easy to edit" in one place, not a series of one-off
     additions.
   - If the rendered value is multiplied by the screen's responsive `scale`
     factor (e.g. `v.width * scale`, as the logo and shop image are), **pass
     `scale={scale}` to `Designable` too**. Drag deltas are measured in real
     screen pixels, which only equal design units when `scale` is 1 — without
     dividing by it, dragging on a device where `scale != 1` moves the base
     value by the wrong amount, and the saved value renders wrong-sized on a
     *different* device than the one used to edit it. Omit the prop (defaults
     to 1) for values that aren't scaled at render time.
4. If the widget is rendered inside a shared component (not directly in the
   screen file — e.g. `LoginButton` is rendered from `LoginForm`, not
   `LoginScreen`), wrap it where it's actually rendered and thread the
   resulting value down as a prop (see `LoginForm.tsx`'s `buttonHeight` prop
   and `LoginButton`'s `height` override for the pattern). Don't try to wrap
   a component from a distance.
5. `npx tsc --noEmit`, then verify in the running app: toggle Design Mode,
   confirm every wrapped widget outlines and is selectable, bump a value via
   steppers, confirm live preview updates, Save, confirm
   `src/designConfig/<screen>.ts` on disk has the new value and a fresh page
   load shows it as the new default with Design Mode off.

## Gotchas already hit

- **`metro.config.js` `enhanceMiddleware` self-recursion**: don't read
  `config.server.enhanceMiddleware` from *inside* the new middleware function
  after you've already reassigned `config.server` — capture the original
  function in a variable *before* reassigning, or the middleware recurses
  into itself infinitely (`RangeError: Maximum call stack size exceeded`).
- **Gesture callbacks and React state**: `react-native-gesture-handler`'s
  `Gesture.Pan()` callbacks run as UI-thread worklets by default when
  Reanimated's babel plugin is active (it is, in this project) — calling a
  plain JS function like a `setState` setter directly from `.onUpdate()`
  without `runOnJS` either fails or needs careful worklet-safe code. Simplest
  fix, used throughout `Designable.tsx`: `.runOnJS(true)` on the gesture
  builder, which runs its callbacks as normal JS-thread functions. Slightly
  less smooth than 60fps UI-thread tracking, but this is a dev tool, not a
  product animation — correctness and simplicity win here.
- **Don't recreate `Gesture.Pan()` every render**: a naive `const pan =
  Gesture.Pan()...` in the render body gets rebuilt on every re-render, and
  `onUpdate` → `setValue` → re-render happens on every drag frame — so the
  gesture was being torn down and reattached mid-drag, which reads as the
  dragged value randomly jumping/shrinking instead of tracking the pointer.
  Wrap each gesture in `useMemo` (deps: the ids/keys/scale it closes over,
  not the reactive `value`) so the *same* gesture instance survives those
  re-renders, and toggle `.enabled(...)` imperatively after the memo instead
  of putting `selected` in the dependency array. Compute deltas from a
  `useRef` snapshot taken in `onStart`, not from the reactive `value`, so
  `onUpdate` has a single fixed baseline for the whole drag.
- **A handle with a higher `zIndex` can still be unclickable**: `zIndex`
  only resolves paint/hit-testing order *within a shared stacking context*.
  `Designable`'s handles are positioned `absolute` inside a wrapper that
  didn't otherwise establish a stacking context, so a plain sibling rendered
  *after* it in the JSX (e.g. the wordmark `Text` under the logo) painted on
  top and silently ate the handle's clicks on web, even with `zIndex: 10` on
  the handle itself — `elementFromPoint` at the handle's own coordinates
  returned the sibling text, not the handle. Fixed by giving the whole
  `Designable` wrapper (`styles.wrap`) its own `zIndex`/`position` once a
  handle is actually showing (`wrapSelected`), not just the handle. If a new
  widget's handle looks right but drags do nothing, check this first —
  `document.elementFromPoint(x, y)` in a browser console (or in a Playwright
  `page.evaluate`) at the handle's coordinates is the fastest way to confirm
  what's actually receiving the pointer.
- **Stale panel after Save**: the overlay panel reads a `selectedBase`
  snapshot captured at tap-to-select time, not a live subscription to the
  config module. After a successful Save, `saveScreen` explicitly deselects
  (clears `selectedId`/`selectedBase`) rather than leave the panel showing
  pre-save numbers until Fast Refresh catches up — re-tap the widget to see
  fresh values.
- **Full-object writes, not diffs**: the middleware overwrites the *entire*
  `designConfig` file with whatever's POSTed. `DesignModeContext` tracks
  every mounted `Designable`'s current base via a `register`/`unregister`
  registry specifically so `saveScreen` can reconstruct the complete object
  (edited widget + every untouched one) before posting — posting a partial
  object truly does wipe the untouched keys (hit this once manually testing
  the endpoint directly with curl).
- **Finding the dev server's address on native breaks the web build if done
  carelessly**: on web, the dev server is just `window.location.origin`. On
  native (phone via Expo Go/dev client), the only reliable way is RN's own
  internal `react-native/Libraries/Core/Devtools/getDevServer` (reading
  `NativeModules.SourceCode.scriptURL` directly doesn't resolve correctly
  under the new architecture/TurboModules, so Save silently fails with no
  visible error beyond the panel's red error line on every native test).
  But that internal module imports a native-only `NativeSourceCode` spec
  with **no web shim** — merely `require()`-ing it (even behind a runtime
  `Platform.OS === 'web'` check, even in a `try/catch`) makes Metro fail to
  bundle the *entire app* for web, because Metro resolves every
  `require`/`import` it statically sees regardless of surrounding
  conditionals. The fix is `src/devtools/designMode/devServerOrigin.ts`
  (native implementation) + `devServerOrigin.web.ts` (web implementation,
  just `window.location.origin`) as separate files — Metro's platform
  extension resolution picks the right one per build and never even parses
  the other, so the native-only import never reaches the web bundle. If a
  dev-only feature needs a native module with no web equivalent, split it
  into `.web.ts`/base-file pairs like this rather than branching at runtime
  inside one file.
