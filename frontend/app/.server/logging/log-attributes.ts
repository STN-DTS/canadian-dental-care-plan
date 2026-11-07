export { ATTR_CDCP_ERROR_CODE } from '~/instrumentation/log-attributes';

/**
 * Application-owned log attribute names. Use official OpenTelemetry constants
 * for standard attributes. These names are a wire contract, not a sanitizer.
 *
 * Values reach the configured console and OpenTelemetry log sinks. Only use
 * fresh, allowlisted metadata; never attach DTOs, raw errors or arbitrary input.
 * Identifier fields remain linkable protected data, even when opaque or masked.
 * String bounds below describe their source domains, not runtime truncation.
 */

/** string[]: permitted flow keys from the application flow definition; never submitted values. */
export const ATTR_CDCP_APPLICATION_ALLOWED_FLOWS = 'cdcp.application.allowed_flows';

/** string: submission channel, `public` or `protected`. */
export const ATTR_CDCP_APPLICATION_CHANNEL = 'cdcp.application.channel';

/** string: approved opaque child-flow identifier, not a backend client number. */
export const ATTR_CDCP_APPLICATION_CHILD_ID = 'cdcp.application.child.id';

/** string: confirmation code with its last four digits masked; never the original code. */
export const ATTR_CDCP_APPLICATION_CONFIRMATION_CODE = 'cdcp.application.confirmation_code';

/** string: current context from the protected application state context enum. */
export const ATTR_CDCP_APPLICATION_CONTEXT = 'cdcp.application.context';

/** string: required context from the protected application state context enum. */
export const ATTR_CDCP_APPLICATION_EXPECTED_CONTEXT = 'cdcp.application.expected_context';

/** string: selected flow key from the application flow definition. */
export const ATTR_CDCP_APPLICATION_FLOW = 'cdcp.application.flow';

/** string: approved opaque local application-flow identifier; not an applicant identifier. */
export const ATTR_CDCP_APPLICATION_ID = 'cdcp.application.id';

/** string[]: missing `authCodeVerifier` / `authState` session field names; never values. */
export const ATTR_CDCP_AUTH_MISSING_SESSION_FIELDS = 'cdcp.auth.missing_session_fields';

/** boolean: result of provider session validation; never a provider session ID or token. */
export const ATTR_CDCP_AUTH_SESSION_VALID = 'cdcp.auth.session_valid';

/** string: code-defined audit action identifier, at most 128 lowercase ASCII letters, digits, dots or hyphens. */
export const ATTR_CDCP_AUDIT_EVENT_ID = 'cdcp.audit.event_id';

/** string: configured build date metadata; not an applicant or request timestamp. */
export const ATTR_CDCP_BUILD_DATE = 'cdcp.build.date';

/** string: configured build identifier. */
export const ATTR_CDCP_BUILD_ID = 'cdcp.build.id';

/** string: configured source revision. */
export const ATTR_CDCP_BUILD_REVISION = 'cdcp.build.revision';

/** string: configured application version. */
export const ATTR_CDCP_BUILD_VERSION = 'cdcp.build.version';

/** number: Redis entries deleted by an operation; nonnegative integer count. */
export const ATTR_CDCP_CACHE_DELETED_COUNT = 'cdcp.cache.deleted_count';

/** boolean: whether a cache lookup found a value; never the cached value. */
export const ATTR_CDCP_CACHE_HIT = 'cdcp.cache.hit';

/** number: configured individual-reference cache lifetime in milliseconds. */
export const ATTR_CDCP_CACHE_ITEM_TTL_MS = 'cdcp.cache.item.ttl_ms';

/** string: approved internal Redis key; never extend to keys containing personal data or secrets. */
export const ATTR_CDCP_CACHE_KEY = 'cdcp.cache.key';

/** number: configured reference-list cache lifetime in milliseconds. */
export const ATTR_CDCP_CACHE_LIST_TTL_MS = 'cdcp.cache.list.ttl_ms';

/** number: configured cache lifetime in milliseconds. */
export const ATTR_CDCP_CACHE_TTL_MS = 'cdcp.cache.ttl_ms';

/** number: cache lifetime in seconds; Redis TTL results may include -1 (no expiry) or -2 (absent). */
export const ATTR_CDCP_CACHE_TTL_SECONDS = 'cdcp.cache.ttl_seconds';

/** string: approved opaque backend client UUID for support correlation; never the client number or SIN. */
export const ATTR_CDCP_CLIENT_ID = 'cdcp.client.id';

/** string: service name from the fixed dependency-injection registration set. */
export const ATTR_CDCP_CONTAINER_SERVICE_NAME = 'cdcp.container.service.name';

/** string: key operation, `encrypt`, `decrypt`, `sign` or `verify`; never key material. */
export const ATTR_CDCP_CRYPTO_KEY_USAGE = 'cdcp.crypto.key_usage';

/** boolean: whether development-only CSP behavior is enabled; never the policy or nonce. */
export const ATTR_CDCP_CSP_DEVELOPMENT_MODE = 'cdcp.csp.development_mode';

/** string: local document rejection classification, `rejected` or `unsafe`; no upstream text or content. */
export const ATTR_CDCP_DOCUMENT_OUTCOME = 'cdcp.document.outcome';

/** number: 1-based upload submission number within one document upload flow. */
export const ATTR_CDCP_DOCUMENT_UPLOAD_ATTEMPT_NUMBER = 'cdcp.document_upload.attempt.number';

/** string: upload submission result, `uploaded`, `upload_failed`, `validation_failed` or `content_validation_failed`. */
export const ATTR_CDCP_DOCUMENT_UPLOAD_ATTEMPT_OUTCOME = 'cdcp.document_upload.attempt.outcome';

/** number: files in one upload submission that were not uploaded; 0 to the configured maximum file count. */
export const ATTR_CDCP_DOCUMENT_UPLOAD_FILES_FAILED_COUNT = 'cdcp.document_upload.files.failed_count';

/** number: files sent in one upload submission; 1 to the configured maximum file count. */
export const ATTR_CDCP_DOCUMENT_UPLOAD_FILES_SUBMITTED_COUNT = 'cdcp.document_upload.files.submitted_count';

/** number: files uploaded successfully in one upload submission; 0 to the configured maximum file count. */
export const ATTR_CDCP_DOCUMENT_UPLOAD_FILES_UPLOADED_COUNT = 'cdcp.document_upload.files.uploaded_count';

/** number: upload submissions recorded for one document upload flow when it finishes. */
export const ATTR_CDCP_DOCUMENT_UPLOAD_FLOW_ATTEMPT_COUNT = 'cdcp.document_upload.flow.attempt_count';

/** string: server-generated document upload flow UUID; never a filename or document identifier from the applicant. */
export const ATTR_CDCP_DOCUMENT_UPLOAD_FLOW_ID = 'cdcp.document_upload.flow.id';

/** number: files uploaded successfully so far in one document upload flow, across all submissions. */
export const ATTR_CDCP_DOCUMENT_UPLOAD_FLOW_UPLOADED_TOTAL = 'cdcp.document_upload.flow.uploaded_total';

/** string: feature key from the application feature configuration; never arbitrary user input. */
export const ATTR_CDCP_FEATURE_NAME = 'cdcp.feature.name';

/** number: configured hCaptcha rejection threshold; same score scale as cdcp.hcaptcha.score. */
export const ATTR_CDCP_HCAPTCHA_MAX_SCORE = 'cdcp.hcaptcha.max_score';

/** number: admitted numeric hCaptcha risk score; never the token or provider response. */
export const ATTR_CDCP_HCAPTCHA_SCORE = 'cdcp.hcaptcha.score';

/** string[]: HTTP method names from the route's finite allowed-method set. */
export const ATTR_CDCP_HTTP_ALLOWED_METHODS = 'cdcp.http.allowed_methods';

/** number: declared response content length in bytes, when finite and available. */
export const ATTR_CDCP_HTTP_RESPONSE_CONTENT_LENGTH_BYTES = 'cdcp.http.response_content_length_bytes';

/** number: Morgan response time in milliseconds, when available. */
export const ATTR_CDCP_HTTP_RESPONSE_TIME_MS = 'cdcp.http.response_time_ms';

/** string: approved backend letter record identifier; never letter content or filename. */
export const ATTR_CDCP_LETTER_ID = 'cdcp.letter.id';

/** string: letter sort order, `asc` or `desc`. */
export const ATTR_CDCP_LETTERS_SORT_ORDER = 'cdcp.letters.sort_order';

/** string: application locale, `en` or `fr`. */
export const ATTR_CDCP_LOCALE = 'cdcp.locale';

/** string: configured logger threshold from the application's LogLevel union. */
export const ATTR_CDCP_LOG_LEVEL = 'cdcp.log.level';

/** string: configured audit log file path/pattern; no applicant data or file content. */
export const ATTR_CDCP_LOG_AUDIT_FILE_PATH = 'cdcp.log.audit_file_path';

/** string: internally defined operation/metric prefix; never a raw URL or submitted operation name. */
export const ATTR_CDCP_OPERATION_NAME = 'cdcp.operation.name';

/** number: configured proxy TLS timeout in milliseconds. */
export const ATTR_CDCP_PROXY_TLS_TIMEOUT_MS = 'cdcp.proxy.tls_timeout_ms';

/** string: configured proxy origin only; exclude credentials, path, query and fragment. */
export const ATTR_CDCP_PROXY_URL = 'cdcp.proxy.url';

/** string: internal redirect pathname from application routing; never an authentication or external URL. */
export const ATTR_CDCP_REDIRECT_TARGET = 'cdcp.redirect.target';

/** number: actual reference-list result length; nonnegative integer, not IDs or selected values. */
export const ATTR_CDCP_REFERENCE_COUNT = 'cdcp.reference.count';

/** string: selected server render handler, `onAllReady` or `onShellReady`. */
export const ATTR_CDCP_RENDER_HANDLER = 'cdcp.render.handler';

/** number: retry ordinal supplied by the HTTP or Redis retry hook; not total request count. */
export const ATTR_CDCP_RETRY_COUNT = 'cdcp.retry.count';

/** number: scheduled retry delay in milliseconds. */
export const ATTR_CDCP_RETRY_DELAY_MS = 'cdcp.retry.delay_ms';

/** number: configured maximum HTTP retries; nonnegative integer. */
export const ATTR_CDCP_RETRY_LIMIT = 'cdcp.retry.limit';

/** string or null/undefined: resolved React Router route ID; null/undefined denotes no match/cache entry. */
export const ATTR_CDCP_ROUTE_ID = 'cdcp.route.id';

/** string: configured NODE_ENV runtime mode. */
export const ATTR_CDCP_RUNTIME_MODE = 'cdcp.runtime.mode';

/** number|string: configured listening port or named pipe; never a credential-bearing connection string. */
export const ATTR_CDCP_SERVER_LISTEN_TARGET = 'cdcp.server.listen_target';

/** number: entries read from the memory session store; nonnegative integer. */
export const ATTR_CDCP_SESSION_COUNT = 'cdcp.session.count';

/** string|null: session cookie expiry as an ISO timestamp, or null when no expiry is set. */
export const ATTR_CDCP_SESSION_EXPIRES_AT = 'cdcp.session.expires_at';

/** string: field name from the application's session schema; never its value or a session identifier. */
export const ATTR_CDCP_SESSION_KEY = 'cdcp.session.key';

/** boolean: whether the named application session field exists. */
export const ATTR_CDCP_SESSION_KEY_EXISTS = 'cdcp.session.key_exists';

/** string: configured session storage backend from SESSION_STORAGE_TYPE. */
export const ATTR_CDCP_SESSION_STORAGE = 'cdcp.session.storage';

/** string: approved opaque application user identifier; never a SIN, client number or provider token. */
export const ATTR_CDCP_USER_ID = 'cdcp.user.id';
