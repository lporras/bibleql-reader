# Signing and notarizing the macOS builds

`release.yml` signs the macOS builds with a Developer ID certificate and sends them to Apple's
notary service, so a downloaded DMG opens without a Gatekeeper warning. `tauri-action` does both
when the `APPLE_*` secrets below are set. It needs a paid Apple Developer membership. This is
separate from iOS signing, and from the Mac App Store, which would also rule out
`macos-private-api`.

## One-time setup

1. Create the certificate. In Xcode, go to *Settings → Accounts →* your Apple ID *→ Manage
   Certificates → + → Developer ID Application*. Only the Account Holder can create one.
2. Export it. In Keychain Access, under *My Certificates*, right-click
   *Developer ID Application: …*, choose *Export*, save it as a `.p12`, and set a password.
3. Create an app-specific password at <https://account.apple.com> (*Sign-In and Security →
   App-Specific Passwords*). Notarization signs in with it.
4. Add the repo secrets, then delete the `.p12`:

   ```bash
   base64 -i certificate.p12 | gh secret set APPLE_CERTIFICATE
   gh secret set APPLE_CERTIFICATE_PASSWORD    # the .p12 password
   gh secret set APPLE_SIGNING_IDENTITY        # "Developer ID Application: Name (TEAMID)"
   gh secret set APPLE_ID                      # your Apple ID email
   gh secret set APPLE_PASSWORD                # the app-specific password
   gh secret set APPLE_TEAM_ID                 # your 10-character team ID
   ```

   `security find-identity -v -p codesigning` prints the exact signing identity.

## Checking a release

Download the DMG from the draft release, so it's quarantined like a user's copy, install the app,
and run:

```bash
spctl -a -vv "/Applications/BibleQL Reader.app"       # expect: accepted, source=Notarized Developer ID
xcrun stapler validate "/Applications/BibleQL Reader.app"
```

Then open it normally. There should be no warning.
