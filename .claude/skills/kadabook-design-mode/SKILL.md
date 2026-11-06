---
name: kadabook-design-mode
description: Wire a KadaBook screen into the in-app visual Design Mode (select a widget, drag/resize it, Save writes the new value straight into that screen's designConfig file as the new default). Use this when asked to make a screen's spacing/sizing visually editable, or to extend Design Mode to a screen beyond Login.
---

# KadaBook Design Mode

A dev-only, self-serve visual tuning tool, built because repeatedly round-tripping
"make the logo bigger" / "move this up" through chat was the wrong workflow.
Live in `src/devtools/designMode/`, first wired up on `LoginScreen`
(`src/screens/LoginScreen.tsx`). Read that file as the reference
implementation before wiring a new screen.

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
     A widget can only use one of `resizeKeys` or `offsetKey` per instance;
     any OTHER keys in its `base` still get steppers in the panel even
     without a drag handle (drag is for coarse adjustment, steppers are for
     exact values — not every key needs a drag handle).
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
