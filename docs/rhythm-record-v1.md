# Rhythm Record v1

`mai-score/rhythm-record/v1` is a transport format for rhythm-game records. It is intentionally not a universal scoring formula: each game keeps its own score and lamp semantics while sharing stable song, chart, result, player, source, and summary containers.

The machine-readable contract is [`schemas/rhythm-record-v1.schema.json`](../schemas/rhythm-record-v1.schema.json).

## Common mapping

| Container | Shared purpose |
| --- | --- |
| `source` | Game, connection adapter, region, game version, and source URL |
| `player` | Optional display data, service identifiers, and asset URLs |
| `song` | Stable song ID, title, artist, and jacket reference |
| `chart` | Stable chart ID, chart type, difficulty, displayed level, and optional numeric level |
| `result` | Raw score, achievement, grade, lamp, combo, misses, judgments, and named rating system |
| `grouping` | Optional ranking bucket such as maimai B15/B35 |
| `gameSpecific` | Fields that should not be forced into another game's terminology |
| `summaries` | Aggregates such as Best 50, VOLFORCE, or a user-selected course |

## Reserved game mappings

| Game ID | Expected common fields | `gameSpecific` examples |
| --- | --- | --- |
| `maimai-dx` | `achievementRate`, DX Rating, displayed/internal level | combo flag, sync flag, B15/B35 |
| `popn-music` | raw score, clear status, miss/BAD count | button count, clear medal details |
| `sound-voltex` | raw/EX score, grade, clear status, VOLFORCE rating | effective rate, skill analyzer context |
| `dance-dance-revolution` | raw/EX score, grade, clear status, judgments | play style, flare skill, fast/slow counts |

Adapters must preserve the source's own terms. For example, a DDR clear lamp must not be rewritten as a maimai combo flag.

## Privacy and identity

- Keep service IDs optional and namespaced under `player.identifiers`.
- Never export session cookies, access tokens, passwords, request headers, or raw authenticated HTML.
- A connection adapter should normalize only the records explicitly requested by the user.
- `recordId` needs to be unique inside an envelope; it does not need to reveal a private service identifier.

## Versioning

Breaking field changes require a new schema string. New optional games, adapter IDs, `gameSpecific` keys, or summary systems do not require a schema version bump.
