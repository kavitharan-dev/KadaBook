# KadaBook deploy and OTA updates

After the **one** APK that includes `expo-updates`, JavaScript, UI, and bug fixes ship with `eas update`. Banners, maintenance, and feature on/off ship by editing Firestore `config/app` (no update command).

Native identity (do not change these without a new APK):

| Field | Value |
|--------|--------|
| Name | KadaBook |
| Android package | `com.kadabook.shop` |
| Version (`app.json` `expo.version`) | `1.0.2` |
| Android `versionCode` | `3` (production builds may auto-increment on EAS) |
| Runtime | `appVersion` policy, so OTA only applies to the same `1.0.2` |

Replace logo files before the final APK, then do not change them via OTA (the store icon and splash are native):

- `assets/icon.png`
- `assets/adaptive-icon.png`
- `assets/splash.png`
- `assets/favicon.png`

In-app logo can change anytime with `config/app` field `logoUrl`.

---

## One-time, before the final APK

```powershell
cd C:\Users\kavit\Desktop\kadabook
npx eas login
npx eas update:configure
powershell -ExecutionPolicy Bypass -File .\scripts\Push-EasFirebaseEnv.ps1
npm run deploy:rules
```

`eas update:configure` confirms the updates URL. This project already has EAS project id `4b2ae4ed-5767-4abb-b448-3508a63c30f6` and `updates.url` set to `https://u.expo.dev/4b2ae4ed-5767-4abb-b448-3508a63c30f6`.

Create Firestore document **`config/app`** (console). Missing fields are safe; do not rename or delete fields later, only add new ones.

```json
{
  "minAppVersion": "1.0.2",
  "maintenanceMode": false,
  "maintenanceMessage": "",
  "announcement": { "enabled": false, "title": "", "message": "", "type": "info" },
  "banners": [],
  "features": { "sales": true, "expenses": true, "products": true, "reports": true, "export": true },
  "logoUrl": ""
}
```

`config/app` is public read and cannot be written by the app. Edit it in the Firebase console.

---

## First APK (includes expo-updates)

Preview channel (testers):

```powershell
npx eas build -p android --profile preview
```

Production channel (shops):

```powershell
npx eas build -p android --profile production
```

Install that APK once. Later JS updates will not apply to older APKs that were built before `expo-updates`.

---

## Daily OTA (no new APK)

Preview:

```powershell
npm run update:preview -- "describe the change"
```

Production:

```powershell
npm run update:prod -- "describe the change"
```

Phones on that channel download the update on next launch or when the app returns to the foreground, then reload. A small **Updating...** label shows while the download runs.

Remote-only changes (no `eas update`):

- Turn a feature off: `features.reports = false` (also `sales`, `expenses`, `products`, `export`)
- Home announcement: `announcement.enabled = true` plus `title` and `message`
- Image banners: `banners` array of `{ imageUrl, link, enabled }`
- Maintenance screen: `maintenanceMode = true` and `maintenanceMessage`
- Block old binaries: raise `minAppVersion` above the installed `expo.version`
- Swap the in-app logo: set `logoUrl` to an https image

---

## Rollback

List updates:

```powershell
npx eas update:list --branch production
```

Republish an older update group (use the group id from the list):

```powershell
npx eas update:republish --group <UPDATE_GROUP_ID> --destination-channel production
```

For preview, use channel `preview` and branch `preview`.

---

## When a new APK is required

Build a new APK only if you:

- Add or upgrade a native module (new `expo install` of a library with native code, or a permission that is not already in the binary)
- Change `expo.version` (runtime is tied to the app version, so `1.0.3` will not receive updates published for `1.0.2`)
- Change `android.package`, app name, icon, splash, or `versionCode` for Play
- Change `updates.url` or the EAS project id

Already in this binary after the next APK: `expo-updates`, `expo-bluetooth-thermal-printer` (58mm Bluetooth Classic, Android), `expo-print`, `expo-sharing`, `expo-font`.

Not included. Adding any of these later needs a new APK:

- Camera or barcode scanning
- Push notifications (`expo-notifications`)
- Contacts, location beyond the Bluetooth scan permission already added
- `expo-dev-client` (the `development` profile is an APK channel, not a dev client)
