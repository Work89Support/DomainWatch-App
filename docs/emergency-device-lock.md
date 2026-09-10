# Device emergency lock — release checklist

Scope: Android Agent only. No browser/device fingerprint promises; no account disable, global session revoke, master-link or incident deletion.

The handset immediately clears enrollment preferences and cached summaries, deletes its Android Keystore entry, stops monitoring and requests `/api/agent/emergency` using the former bearer held only in memory. The server revokes only that bearer enrollment, marks the agent inactive/emergency-locked, and invalidates outstanding QR codes. Missing/rotated tokens cannot target another agent. Admin reactivation clears the emergency status and issues a new QR; the old bearer is never restored.

Offline or failed requests: local wipe still runs; no credential is retained for background retry. The UI explicitly requires an admin to disable the agent manually. In-flight network operations may finish before cancellation; already submitted server data remains. Chrome cookies and sessions are outside the app sandbox and are not cleared. A new installation is not a hardware blacklist.

Release order: deploy additive `MobileAgent.emergencyLockedAt` schema and server/UI first; build and sign APK 1.0.8 with the existing signing key; verify its signature before updating download links. Do not publish an APK-only update claiming server revocation support.

Required physical-device checks (not replaced by unit tests):

- Cancel confirmation leaves enrollment intact; confirmation stops new scans and clears the result UI.
- Online command locks only selected agent; existing/unused QR and bearer cannot reconnect; other agent and browser account remain unchanged.
- Offline command clears local data and shows unconfirmed-server warning, including after restart. Admin manually disables it.
- Trigger during enrollment and probing: no late callback restores credentials/results; restart and boot do not start monitoring until fresh QR.
- Admin unlock + fresh QR succeeds, old QR fails. Verify new app signed by the same certificate upgrades 1.0.7.
- Android uninstall needs user confirmation; Chrome remains separate and its limitation is visible.

No production device has been locked or erased by implementation/testing.
