# KadaBook APK — download & install (Android)

**No QR. No Expo Go.** Only a **`.apk`** file for shop phones.

---

## Database not connected after installing APK?

The APK you built **did not include Firebase keys** (EAS does not upload your `.env`).

**Check in app:** **More → Database** shows *This phone only* = not connected to cloud.

**Fix (PC):**

```powershell
cd C:\Users\kavit\Desktop\kadabook
npm run sync:eas-env
npm run build
```

1. Install the **new** APK from the build link (uninstall old KadaBook first if needed).
2. **Sign up again** or login — data syncs to Firestore.
3. Firebase Console → Firestore → `users` should appear.

Also ensure Firestore rules are deployed:

```powershell
npm run deploy:rules
```

And Firebase Console → **Authentication → Email/Password** = Enabled.

---

## Download your APK (after build)

1. Open: **https://expo.dev/accounts/kavitharan/projects/kadabook/builds**
2. Click the latest **Android** build with status **Finished**.
3. Press **Download** → you get **`application.apk`** (rename to **KadaBook.apk** if you like).
4. Copy to phones: **WhatsApp**, **Google Drive**, or USB.

### Install on Android phone

1. Open **KadaBook.apk** → **Install**.
2. If blocked: **Settings → Install unknown apps** → allow for Chrome / Files.
3. Open **KadaBook** → Create account / Login.

---

## “App not installed” / “Something went wrong” (Samsung M02 etc.)

Try in order:

1. **Uninstall old KadaBook** — Settings → Apps → KadaBook → Uninstall (even if icon missing; search “KadaBook”).
2. **Delete old APK** in Downloads; download again from the **latest Finished** build on Expo (full size ~40MB+, not a few KB).
3. Install from **My Files → Downloads** (not WhatsApp).
4. **Free space** 500 MB+.
5. **Settings → Apps → Special access → Install unknown apps → My Files → Allow.**

If it still fails, install from PC to see the real error:

```powershell
adb install -r KadaBook.apk
```

Common codes: `INSTALL_FAILED_UPDATE_INCOMPATIBLE` = uninstall old app first; `INSTALL_FAILED_INSUFFICIENT_STORAGE` = free space.

Rebuild on PC after code updates: `npm run build` (app is now version **1.0.1**, versionCode **2**).

---

## Build a new APK (PC)

```powershell
cd C:\Users\kavit\Desktop\kadabook
npm run build
```

Same as:

```powershell
npm run build:android
```

Wait until the terminal shows a link, or check the builds page above.

### Firebase (cloud) inside the APK

EAS does not upload your `.env`. Before building, run once (use your real keys from `.env`):

```powershell
eas env:create --environment preview --name EXPO_PUBLIC_FIREBASE_API_KEY --value "YOUR_KEY" --visibility plaintext
eas env:create --environment preview --name EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN --value "kadabook-b8b8d.firebaseapp.com" --visibility plaintext
eas env:create --environment preview --name EXPO_PUBLIC_FIREBASE_PROJECT_ID --value "kadabook-b8b8d" --visibility plaintext
eas env:create --environment preview --name EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET --value "kadabook-b8b8d.firebasestorage.app" --visibility plaintext
eas env:create --environment preview --name EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID --value "1098569845013" --visibility plaintext
eas env:create --environment preview --name EXPO_PUBLIC_FIREBASE_APP_ID --value "YOUR_APP_ID" --visibility plaintext
```

Then `npm run build` again.

### Update link inside the app (optional)

After you have a public HTTPS link to the APK (Drive / Expo artifact):

```powershell
eas env:create --environment preview --name EXPO_PUBLIC_APK_DOWNLOAD_URL --value "https://..." --visibility plaintext
npm run build
```

**More → Open APK download link** will appear in the app.

---

## Tamil

1. PC: `npm run build`  
2. Link: https://expo.dev/accounts/kavitharan/projects/kadabook/builds → **Download APK**  
3. Phone: APK open → **Install**  
4. Expo Go / QR **வேண்டாம்**

---

## iPhone?

iOS uses **TestFlight**, not APK. See README if you need iPhone later (`npm run build:ios`).
