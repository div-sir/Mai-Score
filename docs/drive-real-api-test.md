# Google Drive real-service test plan

Use this only with a Google account listed as a test user on the Mai-Score OAuth consent screen. The PR artifact is a development build, not a release candidate.

## Install the PR build

1. Open PR #13's latest **CI** run and download the `mai-score-extension-preview` artifact.
2. Unzip it.
3. Open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select the unzipped folder.
4. Confirm the extension ID is `bkdgjhjohcohclggjadimcamjcacfjpk`.
5. Confirm `PREVIEW_BUILD.txt` names only the PR branch's exact Vercel preview origin.

The CI artifact rewrites the bundled Studio origin and adds only that exact preview host to `externally_connectable`. The source manifest and public release remain restricted to `mai-score.milifix.com`.

## Test matrix

Record the actual time, Chrome version, Google account type (test user only — never the address), and result for each case.

| Case | Steps | Expected |
| --- | --- | --- |
| Initial authorization | Open the popup → Google Drive → Connect | Google consent appears from a direct user click; success changes the popup to Connected |
| Cancel authorization | Revoke/disconnect, press Connect, then close consent | Popup stays disconnected and reports cancellation, not a generic failure |
| First sync | Collect B50 → open Studio → Sync history | A hidden `mai-score-history.json` is created in Drive `appDataFolder`; Studio reports the local history count |
| Repeat sync | Press Sync history again without changing local data | Count remains unchanged; the existing Drive file is updated rather than duplicated |
| Merge | Add a distinct collection in a second Chrome profile, then sync both profiles | Both collections survive; repeated sync converges without duplicates |
| Cancel deletion | Press Delete cloud history, then cancel the confirmation | No Drive request is sent and both cloud/local history remain |
| Delete cloud history | Confirm Delete cloud history | Studio reports permanent cloud deletion; local history remains visible |
| Delete again | Press Delete cloud history again and confirm | Studio reports that no cloud history file exists; operation still succeeds |
| Recreate after deletion | Press Sync history | The cloud file is recreated from the unchanged local history |
| Disconnect | Disconnect from the popup | Google grant is revoked and Chrome's cached token is removed; cloud and local history remain |
| Missing authorization | After disconnect, press Sync or Delete in Studio | Studio tells the user to authorize from the popup |
| Reauthorize | Connect again, then Sync | Existing local history syncs normally with a fresh token |
| Network/API failure | Test offline or with a deliberately interrupted request | UI reports a failure and does not clear local history |

## Release gate

Do not mark v0.7.0 ready until all cases above pass against Google's real API, the updated privacy page is deployed, the Web Store extension ID has a production OAuth client, and Google has approved the sensitive `drive.appdata` scope.
