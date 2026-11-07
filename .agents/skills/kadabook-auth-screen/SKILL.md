---
name: kadabook-auth-screen
description: Build or restyle a KadaBook auth-flow screen (Login, Forgot Password, Create Account, or any future screen in that stack) to pixel-match a supplied mockup image, reusing the shared AuthScreenFrame shell, LoginIcons set, and the responsive/background-fit patterns worked out for this app. Use this whenever the user gives a new auth-screen design (image) and asks to build or restyle that screen.
---

# KadaBook auth-screen pattern

This captures how `LoginScreen`, `ForgotPasswordScreen`, and `SignUpScreen` were
built to match hand-supplied mockups pixel-for-pixel, and the bugs that cost real
time to find. Reuse this instead of rediscovering it.

## Assets convention

All auth-screen assets live in `assets/auth-screens/`:

- `auth-bg.png` — the shared full-bleed blue gradient background for every screen
  in this stack (dark swoosh top-left, dark wave bottom, light center).
- `<screen>-<subject>-img.png` — the hero illustration for one screen (e.g.
  `login-myshop-img.png`, `forgotpassword-lock-img.png`, `createnew-shop-img.png`).
  These are transparent PNGs (confirm with a quick alpha-channel check before
  assuming otherwise — some are P-mode palette PNGs, some RGBA, but all have
  `alpha=0` at the corners; the Read tool's own preview renders transparency as
  white, which is **not** the same as an opaque white background).
- `sample-ui/<screen>-screen.png` — the full mockup (phone-bezel composite) to
  match. Read it directly, don't guess proportions from memory.

When a new screen's mockup arrives, it'll follow this same trio: one hero image,
reuse of `auth-bg.png`, and a `sample-ui/` reference.

## Structural shell: `AuthScreenFrame`

`src/components/AuthScreenFrame.tsx` is the shared shell for every screen in this
stack. It owns:

- `StatusBar` + `ScrollView` + `ImageBackground` wiring.
- A `scale` factor (passed to children as a render-prop: `children: (scale) =>
  ReactNode`) computed from `useWindowDimensions()` against a `BASE_WIDTH = 393`
  baseline, clamped `[0.86, 1.18]`, and based on the tablet-capped *effective*
  width (not raw device width) so a tablet's centered column doesn't inflate the
  hero art further.
- Optional `onBack` (renders a white rounded-square back-chevron button
  top-left) and `topRight` (e.g. the login screen's language pill) slots.
- Tablet centering via the existing `useResponsive()` convention
  (`contentMaxWidth`/`isTablet`), consistent with how `NewSaleScreen`,
  `KitchenUi`, etc. already do it elsewhere in the app.

Build a new screen as `<AuthScreenFrame bg={...} onBack={...}>{(scale) => <>...
</>}</AuthScreenFrame>`, not by hand-rolling the ImageBackground/ScrollView again.

### Why the background is sized by `onLayout`, not percentages

`ImageBackground` is placed **inside** the scroll content (not wrapping it), and
its height is set explicitly from a measured value:

```tsx
const [contentHeight, setContentHeight] = useState(0);
const bgHeight = Math.max(screenHeight, contentHeight);
...
<ImageBackground style={[styles.background, { height: bgHeight }]}>
  <View onLayout={(e) => setContentHeight(e.nativeEvent.layout.height)}>...
```

Percentage heights (`height: '100%'` / `minHeight: '100%'`) do **not** reliably
resolve through a `ScrollView`'s content chain, especially on web — the
background `Image` silently falls back to its own raw pixel dimensions instead
of the screen/content size (diagnosable by checking `document.scrollHeight`
against the source PNG's native height — if they match exactly, that's this bug).
That breaks two things: the page overflows horizontally to the image's native
width, and the bottom wave decoration stops lining up with whatever sits at the
bottom of the content when the content needs to scroll. Measuring real content
height and setting an explicit numeric height sidesteps both.

### Never give a child a width >100% to "bleed" past its frame

A hero image at `width:'108%'` (for a deliberate overflow-bleed effect) with no
`overflow:'hidden'` ancestor will visibly spill past the real device's screen
edge. If you want a bleed effect, clip it explicitly; otherwise keep hero art at
`width:'100%'`.

## Visual language

- **Pill buttons**: `height: 54, borderRadius: 27` (i.e. `height / 2`), blue
  gradient (`#079EFA → #0957E5 → #062FAE`), white label, optional trailing
  `icon` — this is `LoginButton` (`src/components/LoginButton.tsx`), shared
  across all three screens. Pass `icon={<SendIcon />}` etc. rather than forking
  the component; for a plain arrow, embedding `"Label  →"` in the string (as the
  Login button does) is fine too.
- **Fields**: white-ish row (`rgba(255,255,255,.92)` bg, `#CBD8EA` border,
  `borderRadius:14`, `height:53`) with a left icon and optional trailing
  element (eye toggle, chevron). `AuthField` in `AuthScreens.tsx` is the
  reusable version with a generic `icon: ReactNode` prop; `LoginForm`'s private
  `Field` is the same shape kept local since it only needs mail/lock.
- **Icons**: all hand-authored as `react-native-svg` line icons in
  `src/components/LoginIcons.tsx` (not raster assets) — mail, lock, store,
  person, phone, pin, chevrons, send, eye/eye-off, users, the feature-row set
  (sales/stock/reports/cloud), footer shop icon, laurel branches. Match that
  file's stroke style (`strokeWidth` ~1.6–2, muted gray `#607493` for field
  icons, brand blue `#075BE2` for accents) when a mockup needs one that doesn't
  exist yet, instead of introducing a new visual language.
- **Password visibility toggle**: `EyeIcon`/`EyeOffIcon` + local `showPassword`
  state, wired the same way in every form that has a password field.
- **Animations**: reuse the existing hooks, don't invent new ones —
  `useFloatLoop` on the hero image, `useLogoEntrance` for the logo block,
  `useIconPress` for any pressable icon/button, `FadeUp` for the
  card/form block, `useBarGrow` for the animated mini bar-chart feature icon.

## The contrast trap

`auth-bg.png` is dark only at the top-left corner and the bottom wave — the
**center, where almost all the content sits, is near-white**. Text styled for
"on a dark background" (light blue/white) is correct only for the footer text
that sits on the bottom wave (see `LoginScreen`'s `footerText`) or for chrome
that has its own solid fill (the back button, filled stepper dots). Everything
else — titles, subtitles, field placeholders, feature labels, stepper labels,
link text, helper copy — needs dark/muted colors (`#09265E` for headings,
`#5D7195` for muted copy, `#075BE2` for accents), the same palette `LoginScreen`
uses inside its white card. Forgetting this is the single easiest mistake here:
it renders as "invisible" text that's actually just low-contrast light-on-light,
not missing.

## Steps for a new screen in this stack

1. Read the new `sample-ui/<screen>-screen.png` mockup and the matching hero
   image directly (don't rely on description).
2. Confirm the hero image's alpha channel if unsure (`PIL`: `Image.open(path).convert('RGBA')`,
   check corner pixel alpha == 0).
3. Build the screen with `AuthScreenFrame`, reusing `LoginButton`, `AuthField`
   (or the local field pattern), and `LoginIcons`. Add any new icon needed to
   `LoginIcons.tsx` rather than inlining one-off SVGs in the screen file.
4. Apply the contrast rule above to every text style.
5. Typecheck (`npx tsc --noEmit`), then visually verify: start the web dev
   server (`npm run web`), screenshot with Playwright at a few widths (360,
   393, 768) and confirm `document.documentElement.scrollWidth` never exceeds
   the viewport width (that's the overflow bug's signature).
6. When testing multiple auth screens with Playwright in the same page, remember
   React Navigation on web keeps prior screens mounted — selectors like
   `input[placeholder="Password"]` can resolve to more than one element
   (`.last()` or a more specific selector fixes it).
