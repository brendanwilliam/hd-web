# Riot data contract matrix

This matrix covers the Riot Match-v5 and Timeline-v5 fields that Hands Diff
reads. Fixtures live in `tests/fixtures/riot/contracts.json` and coverage lives
in `tests/reports/riot-contracts.test.ts`.

| Source                | Read fields                                                                         | Fixture scenarios                            | Expected handling                                                                   |
| --------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------- |
| Match-v5 `info`       | `gameVersion`, start, map, queue, mode                                              | complete, sparse, malformed, version variant | Only supported Classic Summoner's Rift matches reconcile.                           |
| Match-v5 participants | IDs, team, champion, role, KDA, economy, damage totals                              | complete, sparse                             | Persist only recap-safe fields; never retain PUUIDs or raw participant objects.     |
| Match-v5 teams        | team ID, win                                                                        | complete, sparse                             | Preserve outcome when present; otherwise expose unavailable.                        |
| Timeline-v5 frames    | timestamp, participant economy, XP, CS, position, damage stats                      | complete, sparse, delayed, malformed         | Preserve frame precision. Missing or invalid frame timestamps produce no snapshot.  |
| Timeline-v5 events    | timestamp, type, participant/killer/victim IDs, assists, item, ward, building, team | complete, malformed                          | Preserve the allowlist only. Missing or invalid timestamps produce no stored event. |

Unknown Riot fields are intentionally ignored. They are neither persisted nor
rendered unless a separate privacy review expands this matrix.
