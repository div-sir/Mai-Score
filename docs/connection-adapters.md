# Connection adapters

Mai-Score keeps collection, rating resolution, and export as separate stages. A connection adapter only needs to produce a `CollectionResult`; the dxrating JSON, full JSON, and image exporters remain source-independent.

## Protocol

`CONNECTION_PROTOCOL_VERSION` versions messages exchanged between the popup, content script, and extension service worker. Reject messages with an unsupported version instead of silently interpreting a changed payload.

Each descriptor in `src/lib/connections.ts` declares:

- a stable connection ID;
- a user-facing label;
- a transport (`content-script`, `file`, or `api`);
- URL prefixes used for automatic selection;
- profile, asset, B50, and record-history capabilities;
- whether the adapter is active or only reserved for a future integration.

## Adding a source

1. Extend `ConnectionId`.
2. Register a descriptor in `CONNECTIONS`.
3. Implement the transport handler and return `CollectionResult`.
4. Include the connection ID and protocol version in the result.
5. Add parser fixtures and protocol tests.

Keep credentials inside their owning browser or extension context. Adapters should never put cookies, passwords, authorization headers, or unredacted HTML into exports.

## Planned transports

- `content-script`: authenticated score websites such as DX NET.
- `file`: user-selected JSON exports, with schema validation before normalization.
- `api`: explicit opt-in integrations using a dedicated background handler.

The active implementations are `dxnet-intl` and `dxnet-jp` — same transport, same parser, same chart database; only `matches` (and the `region` carried into exported records) differ between them. Reserved adapters are `rhythm-record-file`, `popn-konami`, `sdvx-konami`, and `ddr-konami`; they cannot receive collection messages until an authenticated, user-approved transport is implemented. Export formats must not special-case a connection ID unless the target format itself requires source-specific behavior.

`dxnet-jp` mirrors `dxnet-intl`'s parser on the assumption that SEGA's domestic and international DX NET sites share the same page template. That assumption has not been verified against a live, logged-in maimaidx.jp page — there was no way to do so from the environment this was written in. If domestic pages turn out to use different markup, `parser.ts` fails with its existing "couldn't find player data" style errors rather than returning wrong data, but treat real-world testing against a JP account as still outstanding before relying on this adapter.
