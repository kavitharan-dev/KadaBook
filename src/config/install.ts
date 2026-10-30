/** Public HTTPS link to the latest .apk (Google Drive, Expo artifact, your site). Set in .env before `npm run build:apk`. */
export const APK_DOWNLOAD_URL = (process.env.EXPO_PUBLIC_APK_DOWNLOAD_URL ?? '').trim();

export function hasApkDownloadLink() {
  return APK_DOWNLOAD_URL.startsWith('https://');
}
