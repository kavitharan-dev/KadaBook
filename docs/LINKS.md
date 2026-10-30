# KadaBook — download & admin links

Project: **kadabook-b8b8d** (Firebase)

---

## Mobile APK (Android)

| What | Link |
|------|------|
| **All builds** (pick latest **Finished**) | https://expo.dev/accounts/kavitharan/projects/kadabook/builds |
| **Latest finished APK** (v1.0.2, build 3) | https://expo.dev/artifacts/eas/UtLytkt6zU-wG3vfMAw_ReD01VgW6S7WZvHyAj5jl3c.apk |
| **Previous APK** (same version) | https://expo.dev/artifacts/eas/4LKq7UVM0e9RvWwqoHAcHu686Ev_a5qk8K7cWhp_MdU.apk |

Install: download APK on the phone → open → Install (allow unknown apps if asked). See [INSTALL_APK.md](../INSTALL_APK.md).

### APK with Firebase + latest gating code

EAS does **not** read your local `.env`. Before building:

```powershell
cd C:\Users\kavit\Desktop\kadabook
powershell -ExecutionPolicy Bypass -File .\scripts\Push-EasFirebaseEnv.ps1
npm run build:apk
```

When the new build **Finished**, use **Application Archive URL** from the builds page (or `npx eas build:list --platform android --limit 1`).

---

## Admin panel

| What | Link |
|------|------|
| **Local dev** | http://localhost:5173 (`cd admin-panel` → `npm run dev`) |
| **Firebase Hosting** (after deploy) | https://kadabook-b8b8d.web.app |
| **Alternate hosting URL** | https://kadabook-b8b8d.firebaseapp.com |

Deploy production admin (builds `admin-panel/dist` with your `admin-panel/.env`):

```powershell
cd C:\Users\kavit\Desktop\kadabook
npm run deploy:admin
```

Login: Firebase Auth user that has **`admins/{uid}`** with `role: super_admin`, `active: true`.

---

## Firebase Console

| What | Link |
|------|------|
| Project overview | https://console.firebase.google.com/project/kadabook-b8b8d/overview |
| Firestore | https://console.firebase.google.com/project/kadabook-b8b8d/firestore |
| Authentication | https://console.firebase.google.com/project/kadabook-b8b8d/authentication/users |

---

## One-command backend deploy (rules + admin site)

```powershell
cd C:\Users\kavit\Desktop\kadabook
npm run deploy:backend
```
