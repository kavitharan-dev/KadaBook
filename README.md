# KadaBook

Simple accounting for small shops — sales, expenses, products, and reports. Works on **Android**, **iOS**, and **web** (Expo).

## Install (first time)

**Requirements:** [Node.js](https://nodejs.org/) LTS (v20+), npm.

**For shop phones (Android):** build and download **APK** — [INSTALL_APK.md](INSTALL_APK.md)

```powershell
npm run build
```

Download: https://expo.dev/accounts/kavitharan/projects/kadabook/builds → **Android** → **Download**.

**For developers only (test on PC):**

```powershell
cd C:\Users\kavit\Desktop\kadabook
npm install
npm run start:phone
```

- **Phone testing with Expo Go:** Scan QR (dev only). Prefer **APK** for shop use.
- **Web:** In the Expo terminal press **`w`**, or run `npm run web`.
- **Verify build:** **More** → line `KadaBook v1.0.0 · …` (build tag changes when you pull updates).

Automated check on PC:

```powershell
npm run typecheck
```

(Must finish with no errors.)

---

## Android APK build

```powershell
npm run build
```

Produces a **`.apk`** on EAS. Download from [your builds page](https://expo.dev/accounts/kavitharan/projects/kadabook/builds). Details: [INSTALL_APK.md](INSTALL_APK.md).

Optional iPhone (TestFlight, not APK): `npm run build:ios` — needs Apple Developer account.

### Firebase keys in the APK

Your `.env` is **not** uploaded to EAS (gitignored). Before cloud build, add the same `EXPO_PUBLIC_FIREBASE_*` values as **EAS environment variables** for the `preview` environment:

```powershell
eas env:create --environment preview --name EXPO_PUBLIC_FIREBASE_API_KEY --value "YOUR_KEY" --visibility plaintext
eas env:create --environment preview --name EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN --value "kadabook-b8b8d.firebaseapp.com" --visibility plaintext
eas env:create --environment preview --name EXPO_PUBLIC_FIREBASE_PROJECT_ID --value "kadabook-b8b8d" --visibility plaintext
eas env:create --environment preview --name EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET --value "kadabook-b8b8d.firebasestorage.app" --visibility plaintext
eas env:create --environment preview --name EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID --value "1098569845013" --visibility plaintext
eas env:create --environment preview --name EXPO_PUBLIC_FIREBASE_APP_ID --value "YOUR_APP_ID" --visibility plaintext
```

(Use values from your local `.env`. Skip this block only if you want **local-only** data — no Firebase sync.)

One-time EAS setup: `eas login` and `eas build:configure` (see INSTALL_APK.md).

---

## Database: two modes

| Mode | When | Where data lives |
|------|------|------------------|
| **Local (default)** | No `.env` file | This phone only (AsyncStorage). **More → Database** shows *This phone only*. |
| **Firebase (cloud)** | `.env` filled + rules deployed | Firestore under `users/{your uid}/…`. **More → Database** shows *Firebase Firestore*. |

You do **not** install MySQL or a separate server — cloud mode is **Google Firebase** (Auth + Firestore).

---

## Firebase setup (cloud database)

### 1. Create a Firebase project

1. Open [Firebase Console](https://console.firebase.google.com/).
2. **Add project** → name it (e.g. `KadaBook`) → finish the wizard.

### 2. Enable sign-in

1. **Build → Authentication → Sign-in method**.
2. Turn on **Email/Password** → Save.

Phone numbers in the app are stored as Firebase emails like `9876543210@phone.kadabook.app` (same password you choose at sign-up).

### 3. Create Firestore

1. **Build → Firestore Database → Create database**.
2. Choose a region close to your users (e.g. `asia-south1` for India).
3. Start in **production mode** (you will deploy rules from this repo next).

### 4. Register a web app and copy keys

1. Project **Settings → General → Your apps → Web** (`</>`).
2. Register the app and copy the `firebaseConfig` values.
3. In the project folder, copy `.env.example` to `.env` and fill in:

```env
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...
EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=...
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
EXPO_PUBLIC_FIREBASE_APP_ID=...
```

4. **Stop Expo and start again** (`npx expo start`) so env vars load.

When keys are set, the login screen shows that data syncs with Firebase. **More → Database** shows `Firebase Firestore`.

### 5. Deploy security rules

Rules live in [`firestore.rules`](firestore.rules). Each user can only read/write their own data under `users/{uid}`.

Install the Firebase CLI once:

```bash
npm install -g firebase-tools
firebase login
```

Copy `.firebaserc.example` to `.firebaserc` and set your real `projectId`, then:

```bash
firebase deploy --only firestore:rules
```

If you see **permission denied** in the app, rules are usually missing or the wrong project is selected.

---

## Firestore structure

```
users/{userId}
  email          string
  phone          string | null
  shopName       string
  createdAt      timestamp

  sales/{saleId}
    amount       number
    createdAt    timestamp

  expenses/{expenseId}
    amount       number
    category     string
    createdAt    timestamp

  products/{productId}
    name         string
    price        number
    createdAt    timestamp
```

The app uses **real-time listeners** (`onSnapshot`), so Home, Sales, and Reports update when data changes on another device.

---

## App features

| Area | What it does |
|------|----------------|
| **Login / Create account** | Email or phone + password |
| **Home** | Today’s sales, shortcuts, this month summary |
| **Sales** | Day-by-day sales list, add via **New Sale** |
| **Products** | Product list with prices |
| **Reports** | Daily / weekly / monthly charts and expenses |
| **More** | Shop name, account info, sign out |

### Languages (English / Tamil / Sinhala)

Open **More → Language** and pick **English**, **Tamil**, or **Sinhala**. Labels and messages update across tabs, sales, expenses, reports, and delete confirmations. Copy is stored in the app (`src/i18n/`) — no live ChatGPT call at runtime.

### New sale flow

After you tap **Add / Save** on **New Sale**, the app **stays on the sale screen** so you can enter the next amount. Use **Close & go to Dashboard** (or the back arrow) when you are done — that returns you to the **Home** tab.

---

## System testing checklist

Run **`npm run typecheck`** first (automated). Then on **Expo Go** or **web**, walk through:

| # | Test | Expected |
|---|------|----------|
| 1 | **Sign up / Login** | Home opens; no endless “Checking your account…” |
| 2 | **Home → Today’s Sales card (tap)** | Opens **Sales** tab with today’s list |
| 3 | **New Sale → Quick** | Add amount → appears in Sales + bottom history; **Close & go to Dashboard** → Home |
| 4 | **New Sale → Sale – All** | Product bill; stock blocks over-add; **Bill** → one invoice in Sales |
| 5 | **Products** | Selling / purchase price, stock, unit |
| 6 | **Reports** | Daily / Weekly / Monthly → **Print this report**; low stock → **Print report** |
| 7 | **Sales row → Print** | PDF/share or clear error dialog (no red Promise crash) |
| 8 | **More → Language** | English / Tamil / Sinhala labels change |
| 9 | **More → Settings → Receipt** | Save prefix/footer; print shows custom invoice |
| 10 | **More → Settings → Theme** | Light / dark |
| 11 | **More → Tips & Help** | Help cards open |
| 12 | **Sign out → Sign in** | Local: data on same phone. Firebase: data syncs from cloud |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Still says “This phone only” | Add `.env` keys and restart Expo |
| Login works, no sales saving | Run `firebase deploy --only firestore:rules` |
| `auth/invalid-credential` | Wrong password or account not created |
| Phone login, forgot password | Use the email form `YOURDIGITS@phone.kadabook.app` in reset, or sign up again |
| **Phone shows old app / no new features** | See **Phone not updating** below |

### Phone not updating (Expo Go)

1. **Right app:** Your screenshots are **billeez POS** (Play Store). Code changes in this folder are **KadaBook** — open **Expo Go** and scan the QR from your PC, not the billeez icon.
2. **Right server:** Stop old terminals. In the project folder run **`npm run start:phone`** (not `--web` only). Do **not** set `CI=1` — that disables reloads.
3. **Same network:** Phone and PC on the same Wi‑Fi. If it still fails, use **`npm run start:tunnel`** and scan the new QR.
4. **Force refresh:** In Expo Go, open the project → **Reload**, or remove the project and scan the QR again. On PC press **`r`** in the Expo terminal after saving code.
5. **Confirm build:** **More** tab should show the current **KadaBook** build tag. If you still see **billeez** or an old tag, you are not on this dev build.

---

## Tamil quick note

ஃபயர்பேஸ் இல்லாமல் தரவு இந்த போனில் மட்டும் சேமிக்கப்படும். `.env` கீகள் சேர்த்து `firestore.rules` deploy செய்தால் கடை விற்பனை, செலவு, பொருட்கள் cloud-ல் sync ஆகும்.
