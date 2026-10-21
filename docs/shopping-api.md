# Shopping on the frame

The bundled Home HQ dashboard reads and writes the household Shopping API. Select a
list at the top of Shopping, or use **New list**. Quick Add opens an item form;
tap an existing item's name to edit its name, text quantity (for example `2 bags`),
or category. The checkbox checks/unchecks an item. Checked items remain in **Got it**
with struck-through names. Removal and **Clear checked** ask for confirmation.
**Undo** uses the server's receipt for the latest supported action (check, uncheck,
remove, or clear). Adding/editing item details is not offered as an undoable action.

The selected list refreshes every 30 seconds and after saves. **Refresh** fetches
immediately. The desktop app may need its own Refresh to show frame changes.
The Today shopping summary reflects the selected list. Old prototype groceries and
store filters are not uploaded; stores and notes are not fields in this API.

## Private configuration

Keep the connection JSON outside Git. It contains `endpoint` (an HTTPS URL ending
in `/v1/shopping/dispatch`) and `apiKey`. The supplied API helper's private JSON is
accepted; extra metadata fields are not copied to the frame.

```sh
python3 scripts/configure-frame-shopping.py \
  --serial FRAME_IP:5555 --config /private/path/Shopping_API.private.json
```

The helper installs `shopping-connection.json` into the app's private files folder,
sets app ownership and mode 0600, and verifies it without printing the key. The key
is not in JavaScript, HTML, the APK assets, localStorage, or the saved dashboard URL.
Root/ADB access can still read the private configuration. Configuration updates take
effect on the next request; no APK rebuild is necessary for a key change.

The native `ShoppingNode` sends authenticated HTTPS POST requests. Its local
`/__node/shopping` adapter is intercepted only inside WebView; it does not open a
listening port or add an Android JavaScript bridge. It requires POST, the exact
bundled dashboard Origin, a local main page, and an allowed operation. Because
WebView's interception API does not expose request bodies, the bounded JSON command
is percent-encoded in `X-Shopping-Command`. Credentials are added only on the native
upstream request. Redirects are not followed and TLS validation remains enabled.
Ordinary Vite/browser previews display connection-unavailable status; they cannot
use the frame's credential-bearing adapter.

## Save and recovery behavior

- Item revisions protect edits, check/uncheck, and removal. Clear uses the list's
  content revision captured when confirmation opens. A 409 refreshes current data
  without replaying the edit against a newer revision. Close/reopen a conflicted
  editor to review the latest value.
- Each write is stored locally with its UUID/action key before transmission. A lost
  response leaves **Retry save** available; retry sends the identical command/key.
  Pending commands survive reload. New writes and list switching pause until the
  pending save is resolved. The server's idempotency receipts prevent duplicates.
- The last successful snapshot is cached for offline viewing and marked stale.
  New offline edits are disabled; this is not a general offline editing queue.
  The UI reports success only after an API acknowledgement. Storage failure blocks
  new writes; a corrupt cached display cannot erase a recoverable pending command.
- Undo is revision-aware on the server and can fail if another client changed the
  affected items. The most recent undo button is session-local.

## Build and checks

```sh
node dashboard/tests/shopping_node.cjs
npm --prefix dashboard run build
KIOSK_SITE="$PWD/dashboard/dist" bash dashboard/kiosk/build.sh
adb -s FRAME_IP:5555 install -r dashboard/kiosk/build/homehq.apk
adb -s FRAME_IP:5555 shell am start -n com.wesbos.homehq/.Home
```

Set `BUILD_TOOLS` to the installed Android SDK build-tools directory if necessary.
See the build journal for actual on-device verification. The model test covers lost
responses after commit, exact retries across reload, conflicts, offline cache,
authentication errors, and unavailable/corrupt storage. Photo regression tests remain
in `shopping_photos.cjs`; obsolete prototype-shopping tests were replaced.
