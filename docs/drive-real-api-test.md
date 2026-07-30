# Google Drive real-service test plan

Use this only with a Google account listed as a test user on the Mai-Score OAuth consent screen. Drive sync is experimental in v0.7.0 until this matrix and Google's production authorization requirements are complete.

## Install a test build

1. For pre-release validation, download the latest `mai-score-extension-preview` artifact from CI. For post-release validation, use the packaged v0.7.0 extension.
2. Unzip it.
3. Open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select the unzipped folder.
4. Confirm the extension ID is `bkdgjhjohcohclggjadimcamjcacfjpk`.
5. Confirm `PREVIEW_BUILD.txt` names only the PR branch's exact Vercel preview origin.

The CI artifact rewrites the bundled Studio origin and adds only that exact preview host to `externally_connectable`. Packaged releases remain restricted to `mai-score.milifix.com`.

## Test matrix

Record the actual time, Chrome version, Google account type (test user only — never the address), and result for each case.

| Case | Steps | Expected |
| --- | --- | --- |
| Initial authorization | Open Studio from the Extension → Connect Google Drive → Continue with Google | Extension-owned authorization opens from a direct user click; returning to Studio changes the card to Connected |
| Cancel authorization | Revoke/disconnect, press Connect in Studio, then close consent | Studio stays disconnected and reports cancellation, not a generic failure |
| First sync | Collect B50 → open Studio → Sync history | A hidden `mai-score-history.json` is created in Drive `appDataFolder`; Studio reports the local history count |
| Repeat sync | Press Sync history again without changing local data | Count remains unchanged; the existing Drive file is updated rather than duplicated |
| Merge | Add a distinct collection in a second Chrome profile, then sync both profiles | Both collections survive; repeated sync converges without duplicates |
| Cancel deletion | Press Delete cloud history, then cancel the confirmation | No Drive request is sent and both cloud/local history remain |
| Delete cloud history | Confirm Delete cloud history | Studio reports permanent cloud deletion; local history remains visible |
| Delete again | Press Delete cloud history again and confirm | Studio reports that no cloud history file exists; operation still succeeds |
| Recreate after deletion | Press Sync history | The cloud file is recreated from the unchanged local history |
| Disconnect | Disconnect from Studio | Google grant is revoked and Chrome's cached token is removed; cloud and local history remain |
| Direct Studio visit | Open Studio directly without an Extension handoff | The Drive card uses the pinned official Extension ID and shows Connected or Not connected when v0.7.1 is installed |
| Missing Extension | Disable Mai-Score and reload Studio | The Drive card remains visible, reports that the Extension is unavailable, and does not show cloud actions |
| Reauthorize | Connect again from Studio, then Sync | Existing local history syncs normally with a fresh token |
| Network/API failure | Test offline or with a deliberately interrupted request | UI reports a failure and does not clear local history |

## General-availability gate

Do not remove Drive's experimental label or advertise it to general users until all cases above pass against Google's real API, the updated privacy page is deployed, the Web Store extension ID has a production OAuth client, and Google has approved the sensitive `drive.appdata` scope.
