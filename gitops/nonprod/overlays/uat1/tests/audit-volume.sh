#!/usr/bin/env bash
set -euo pipefail

image=${AUDIT_TEST_IMAGE:-dtsrhpdevscedacr.azurecr.io/canada-dental-care-plan/canada-dental-care-plan-frontend:0.0.0-2d0f1116}
volume=$(podman volume create)
trap 'podman volume rm "$volume" >/dev/null' EXIT

podman run --rm --network none --read-only --user 0:0 \
  --volume "$volume:/app/logs" --entrypoint /nodejs/bin/node "$image" \
  -e 'const fs = require("node:fs"); fs.chownSync("/app/logs", 0, 65532); fs.chmodSync("/app/logs", 0o2770);'

podman run --rm --network none --read-only --interactive \
  --volume "$volume:/app/logs" --env AUDIT_LOG_ENABLED=true \
  --entrypoint /nodejs/bin/node "$image" --input-type=module <<'NODE'
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { once } from 'node:events';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

assert.equal(process.cwd(), '/app');
assert.equal(process.getuid(), 65532);
assert.equal(process.getgid(), 65532);
assert.equal(process.env.AUDIT_LOG_DIRNAME, undefined);

const assets = '/app/build/server/assets';
let loggerModule;
let loggerExport;
let singletonExport;
for (const name of await fs.readdir(assets)) {
  if (!name.endsWith('.js')) continue;
  const filename = path.join(assets, name);
  const source = await fs.readFile(filename, 'utf8');
  const exports = source.match(/export\s*\{([^}]+)\}/g)?.join('\n') ?? '';
  const loggerMatch = exports.match(/\bcreateLogger\s+as\s+(\w+)/);
  const singletonMatch = exports.match(/\bsingleton\s+as\s+(\w+)/);
  if (loggerMatch && singletonMatch) {
    assert.equal(loggerModule, undefined, 'Expected a single compiled logger module');
    loggerModule = filename;
    loggerExport = loggerMatch[1];
    singletonExport = singletonMatch[1];
  }
}
assert.ok(loggerModule, 'Compiled createLogger and singleton exports were not found');
const module = await import(pathToFileURL(loggerModule).href);
const log = module[loggerExport]('audit-volume-test');
log.audit('%j', { eventId: 'distroless-audit-volume-test', details: 'synthetic test data' });
const winston = module[singletonExport]('winstonLogger');
const finished = once(winston, 'finish');
winston.end();
await finished;
console.log('PASS: the compiled application logger runs as nonroot and writes to /app/logs.');
NODE

podman run --rm --network none --read-only --interactive --user 65534:65532 \
  --volume "$volume:/logs:ro" --entrypoint /nodejs/bin/node "$image" \
  --input-type=module <<'NODE'
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const files = (await fs.readdir('/logs')).filter((name) => name.startsWith('audit-') && name.endsWith('.log'));
assert.equal(files.length, 1, 'Expected one audit log in the shared volume');
const lines = (await fs.readFile(`/logs/${files[0]}`, 'utf8')).trim().split('\n');
assert.ok(lines.some((line) => JSON.parse(line).eventId === 'distroless-audit-volume-test'),
  'Synthetic audit entry is missing from the shared volume');
assert.equal((await fs.stat(`/logs/${files[0]}`)).gid, 65532);
console.log('PASS: a different nonroot user reads the audit entry through the shared /logs mount.');
NODE
