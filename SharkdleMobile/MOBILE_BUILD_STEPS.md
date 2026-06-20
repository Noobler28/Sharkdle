# Sharkdle Mobile Build

The original web files stay in `C:\Users\conno\Sharkdle`. The Cordova mobile copy lives in `C:\Users\conno\Sharkdle\SharkdleMobile\www`.

## Update The Mobile Copy

Run this from `C:\Users\conno\Sharkdle\SharkdleMobile` after changing the original web files:

```powershell
powershell -ExecutionPolicy Bypass -File .\sync-www.ps1
```

## Build Android

Run these from `C:\Users\conno\Sharkdle\SharkdleMobile`:

```powershell
cordova platform add android
cordova requirements android
cordova run android
```

`cordova run android` installs the app on a connected Android phone or emulator. For a debug APK instead, run:

```powershell
cordova build android
```

The APK is usually created under:

```text
platforms\android\app\build\outputs\apk\debug\app-debug.apk
```

## Build A Release-Signed APK

Android updates only work when every APK uses the same signing key. Copy the example signing config, fill it in locally, and do not commit it:

```powershell
Copy-Item .\build-release.example.json .\build-release.json
notepad .\build-release.json
npm.cmd run android:release:apk
```

The signed APK is created under:

```text
platforms\android\app\build\outputs\apk\release\
```

If the APK is unsigned, the keystore password, key password, or alias in `build-release.json` is missing or incorrect.

## One-Time Android Setup

If `cordova requirements android` fails, install or configure:

- Android Studio
- Android SDK Platform Tools
- Android SDK Build Tools
- Java JDK
- A phone with USB debugging enabled, or an Android Studio emulator

## Notes

This app loads Firebase, Google Fonts, Font Awesome, and a few external profile/social links over HTTPS, so the mobile app expects internet access.
