# Timeline lifecycle rules

This contract is the rules authority for `hd-web#30`. It supports Summoner's
Rift only and exactly these objectives: the six elemental drakes, Elder Dragon,
Baron Nashor, Rift Herald, and Voidgrubs. It does not infer ordinary camps.

## Sources and baseline

The current rules baseline is patch **26.15.0**, reviewed on 2026-08-14 against
the League Wiki's [Monster](https://wiki.leagueoflegends.com/en-us/Monster),
[Dragon Slayer](https://wiki.leagueoflegends.com/en-us/Dragon_Slayer), and
[Death](https://wiki.leagueoflegends.com/en-us/Death) pages. The early champion
death-timer override beginning in 14.16 is sourced from Riot's
[14.16 patch notes](https://www.leagueoflegends.com/en-us/news/game-updates/patch-14-16-notes/).

Rules are owned, patch-effective data. Compare game versions numerically; use
the most recent rule whose `effectiveFromPatch` is no later than the match
version. Add a new rule only when Riot changes a timer.

## Lifecycle semantics

- Elemental dragons first spawn at 5:00 and respawn five minutes after a kill.
  The first three elements are distinct; the third establishes the Rift and all
  later elemental dragons use that element. A team's fourth stack grants its
  permanent Dragon Soul and replaces later elemental spawning with Elder.
- Elder respawns six minutes after each kill. Elder Aspect is a separate,
  150-second buff granted only to living slayer-team members and lost on death.
- Baron begins at 20:00 and respawns after six minutes. Voidgrubs appear at
  8:00 and permanently despawn at 14:45, or 14:55 while in combat. Rift Herald
  appears at 15:00 and permanently despawns at 19:45, or 19:55 in combat.
- A kill event is an observed event-time fact. Spawn, respawn, and champion
  return timestamps derived from these rules are `rule_predicted`; participant
  levels are frame-resolution observations. Resurrection, special-death, and
  unparseable-version cases remain `unknown` or `unavailable`.
- Never call an unseen objective `despawned` without one of the configured,
  verified despawn rules. End unresolved deaths at game end without asserting a
  respawn.
