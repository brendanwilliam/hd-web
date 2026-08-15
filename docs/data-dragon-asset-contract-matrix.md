# Data Dragon asset contract matrix

Hands Diff constructs champion image URLs only in the report timeline. The
fixtures in `tests/fixtures/data-dragon/assets.json` and tests in
`tests/reports/data-dragon-assets.test.ts` protect that boundary.

| Assumption    | Fixture coverage                           | Safe behavior                                                                                    |
| ------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Match patch   | exact and malformed versions               | Use an exact `x.y.z` patch only; otherwise begin with `latest`.                                  |
| Fallback      | primary and fallback failures              | Retry `latest` after an exact-patch failure, then render the event marker.                       |
| Champion path | apostrophe, punctuation, whitespace, empty | Trim and URL-encode valid names; do not request an asset for an empty or control-character name. |
| Attribution   | shared attribution constant                | Keep Riot attribution visible in the report timeline.                                            |

No Data Dragon response body, champion metadata, or third-party payload is
persisted or rendered. New asset paths require an update to this matrix and its
deterministic fixtures.
