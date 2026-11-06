# Sensitive-data controls

## Field admission

Every emitted field needs a declared name, purpose, source, type, size bound, classification, and permitted destinations. Reuse applicable OpenTelemetry conventions without changing their semantics. A standard key is not privacy approval, and a custom namespace is not redaction. An outer allowlisted key does not approve arbitrary nested contents. Prefer scalar values and bounded arrays of approved enums.

| Data                                                                                                                                       | Rule                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SIN and equivalent national or government identifiers                                                                                      | Never emit raw, partial, masked-with-digits, hashed, or keyed-HMAC values. Central pseudonym approval does not authorize government-identifier derivatives. |
| Names, addresses, contact details, birth dates, personal health, dental, coverage, income, banking, or card data                           | Omit. Do not replace forbidden values with call-site hashes.                                                                                                |
| Passwords, private keys, tokens, authorization codes, state secrets, API keys, cookies, session IDs, credential-bearing connection strings | Never emit raw values. Use trace correlation instead.                                                                                                       |
| Requests, responses, DTOs, entities, sessions, bodies, headers, configuration, SQL parameters, cache values, uploads                       | Never serialize whole objects. Construct a safe projection.                                                                                                 |
| URLs, redirect targets, filenames, search terms, free text, downstream error bodies                                                        | Omit raw values. Use fixed operation names, route templates, or declared reason codes.                                                                      |
| Opaque internal record or actor IDs                                                                                                        | Allowed as named fields for a declared diagnostic or audit purpose. Limit scope and retention. They remain linkable protected data.                         |
| Pseudonyms                                                                                                                                 | Only from one central approved service with purpose, key lifecycle, access, and retention controls. No call-site HMAC or hashing.                           |
| Client addresses and user agents                                                                                                           | Omit by default. Require an explicit privacy-approved event schema and destination. Category alone grants no permission.                                    |
| Counts, durations, booleans, enums, and field names                                                                                        | Admit only when they cannot reveal prohibited personal facts. Field names must come from the schema, not arbitrary submitted keys.                          |

Never use an authentication identifier as a request ID. Validate incoming trace context through the tracing library. Generate a random correlation ID at ingress if tracing is absent. Do not accept arbitrary caller-provided strings as trusted correlation.

## Exception serialization

Use `error.type` for predictable low-cardinality failure classification, with a documented fixed code or an allowlisted canonical exception class. Use `exception.type` only for the admitted canonical class of an actual exception. Do not derive either from arbitrary error properties or duplicate the classification in a custom reason field. Stack frames are optional, not mandatory at every ERROR.

Admit exception messages only for first-party error types whose message contract is declared safe and tested. Library exceptions and generic errors do not qualify. Omit their messages; classify the failure with a fixed `error.type` rather than placing a substitute code in `exception.message`.

The serializer must remove unsafe stack first lines, nested cause messages, captured locals, arguments, URLs, response content, and custom properties. Review file paths and code locations before retaining frames. Bound stack length and cause depth.

Pass an exception instance only when the validated serializer runs before every output path. Otherwise project approved exception fields. Do not stringify the exception or fall back to printing the original object.

## Enforce before every output

Use safe projection, safe exception serialization, controlled enrichment, privacy filtering, and structured encoding before emission. Verify the actual order for each sink. Auto-instrumentation can export a separate copy before a local formatter runs.

Keep key and value-pattern redaction as a backstop. Mask the whole value. Never require a valid identifier checksum before suppressing private input. A mistyped SIN is still private input.

Do not mutate caller objects, traverse arbitrary getters, or invoke custom stringification. Reject undeclared fields. On serializer failure, emit a bounded static diagnostic through a known-safe fallback. Never print the rejected payload.

Encode CR, LF, and delimiters so input cannot forge another record. Apply size limits as well as privacy filtering. Truncation does not sanitize a secret prefix.

Protect transport, storage, exports, backups, and debug captures. Use approved access controls, integrity controls, retention schedules, and deletion procedures. Do not invent a universal retention period.

## Mandatory canaries

Use synthetic fixtures, never production data. Exercise the real configured output path in a local or test environment and inspect both serialized bytes and decoded exported fields. Send canaries to production or third-party sinks only with the owner's authorization.

| Case                                                                                                                                              | Required observation                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Synthetic secrets and personal markers in messages, attributes, nested arrays, interpolation arguments, exceptions, causes, and stack first lines | No marker reaches any sink. The safe event remains useful.                                         |
| Valid and invalid-checksum nine-digit identifiers with plain, spaced, and hyphenated forms                                                        | The field is absent or wholly replaced. No suffix remains.                                         |
| Authorization URL with code, state, or token                                                                                                      | No raw URL or query value survives.                                                                |
| A new undeclared DTO field                                                                                                                        | Output does not change.                                                                            |
| CRLF, delimiters, and oversized input                                                                                                             | One valid bounded structured record.                                                               |
| Error instances, circular objects, or serializer failure                                                                                          | No unsafe fallback, mutation, or recursive logging.                                                |
| DEBUG and TRACE enabled                                                                                                                           | The same disclosure restrictions hold.                                                             |
| Console, file, audit, bootstrap, emergency, and automatic OpenTelemetry export                                                                    | Every enabled sink passes independently. Collector filtering cannot excuse an unsafe earlier copy. |

When a sink cannot be exercised, record a validation gap.

If existing logs may contain protected data, stop the emitting path within the approved scope and invoke incident handling. Report locations and data classes, not values. Do not purge historical evidence without authorization.
