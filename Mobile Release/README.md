# Sharkdle Android Release

Download the latest public Android APK from this folder when a signed release build is uploaded.

## Updating

Android only allows an APK to update an installed app when both APKs use the same signing key. Sharkdle uses the package id `com.sharkdle.app`, so each public APK must be signed with the original Sharkdle release keystore.

If Android says "App not installed", the APK is probably unsigned, debug-signed, or signed with a different key than the version already on the phone.

## App Update Check

The Android app checks `latest.json` for the latest release version. When the version is newer than the installed app, Sharkdle opens this release folder so the player can download and install the update manually.
