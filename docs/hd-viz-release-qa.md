# HD Viz release QA

Run after deploying the merged web service and rebuilding the current OBS branch.

1. Authenticate a device token and upload the shared schema-v3 fixture. Confirm
   ordered normalized records, capture precision, truncation, and no raw payload
   fields are returned by report selectors.
2. Capture one Classic game with Accessibility granted, then denied. Confirm a
   granted capture uploads only allowlisted fields; denied capture explains the
   missing input layer without exposing applications, text, or screen coordinates.
3. Verify a legacy v2 report remains readable and reports playback unavailable.
   Verify a Practice Tool report remains input-only.
4. Seek using pointer, click, and keyboard. The timeline and activity map must
   show the same clamped game-relative cursor, including paused game time.
5. Check narrow layout, keyboard focus order, non-SVG timeline equivalent,
   contrast, Riot attribution, objective/dragon labels, and precision annotations.

Replay synchronization is an adapter seam only. No replay is fetched, embedded,
or implied until a licensed and approved integration exists.
