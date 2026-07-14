# Installing Studio S (no admin rights needed)

This Mac doesn't have administrator permissions, so the normal "drag to
Applications" flow needs two small tweaks. Follow these steps exactly.

## 1. Open the installer

Double-click **`Studio S Installer.dmg`** to mount it. A Finder
window opens showing `Studio S.app`.

## 2. Install to your personal Applications folder

Do **not** drag it to `/Applications` — that folder requires admin rights
and the copy will fail with "Permission denied."

Instead, drag `Studio S.app` into **`~/Applications`** (your
personal Applications folder, inside your home folder — not the same as
the system one at the top level).

If `~/Applications` doesn't exist yet, create it first:
```
mkdir -p ~/Applications
```
Apps here show up in Spotlight, Launchpad, and the Dock exactly like apps
in `/Applications` — the only difference is you don't need admin rights
to put things there.

## 3. First launch — bypass the Gatekeeper warning

The app isn't signed with an Apple Developer certificate, so macOS will
refuse to open it the first time ("Studio S can't be opened because
Apple cannot check it for malicious software"). You don't need admin
rights to get past this — just don't use the normal "Open Anyway" button
in System Settings (that one *does* ask for an admin password).

**Right-click method (easiest, no Terminal):**
1. Right-click (or Control-click) `Studio S.app` in `~/Applications`.
2. Choose **Open**.
3. Click **Open** again in the dialog that appears.

**Terminal method (if the right-click dialog still blocks you):**
```
xattr -dr com.apple.quarantine ~/Applications/"Studio S.app"
```
This removes the quarantine flag that triggers the warning. No `sudo`
needed since you own the file.

## 4. Launch normally

After the first launch, open the app from Spotlight, Launchpad, or the
Dock like any other app — no more warnings.

## Reinstalling / updating

To update to a newer version, just repeat steps 1–2 (drag the new
`.app` from a fresh installer over the old one in `~/Applications`,
replacing it). Step 3's quarantine bypass isn't usually needed again once
you've opened the same app once before, but if it reappears, rerun the
`xattr` command above.
