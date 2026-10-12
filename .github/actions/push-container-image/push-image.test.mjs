import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./push-image.mjs', import.meta.url));
const primary = 'registry.example/cdcp:1.2.3-abcdef12-00007';
const digest = `sha256:${'a'.repeat(64)}`;
const fakeDocker = `#!/usr/bin/env node
const fs = require("node:fs");
const args = process.argv.slice(2);
fs.appendFileSync(process.env.DOCKER_CALLS, JSON.stringify(args) + "\\n");
if (args[1] === process.env.FAIL_IMAGE) process.exit(17);
const digests = JSON.parse(process.env.PUSH_DIGESTS);
const output = process.env.DIGEST_STREAM === "stderr" ? process.stderr : process.stdout;
output.write("digest: " + (digests[args[1]] ?? process.env.DEFAULT_DIGEST) + " size: 123" + (process.env.NO_TRAILING_NEWLINE === "true" ? "" : "\\n"));
`;

function execute({ additional = '', failImage = '', defaultDigest = digest, digests = {}, digestStream = 'stdout', noTrailingNewline = false } = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'cdcp-push-test.'));
  try {
    const calls = join(directory, 'calls.jsonl');
    const output = join(directory, 'output');
    const summary = join(directory, 'summary');
    for (const file of [calls, output, summary]) writeFileSync(file, '');
    writeFileSync(join(directory, 'docker'), fakeDocker, { mode: 0o700 });
    const result = spawnSync(process.execPath, [script], {
      encoding: 'utf8',
      env: {
        ...process.env,
        DEFAULT_DIGEST: defaultDigest,
        DIGEST_STREAM: digestStream,
        DOCKER_CALLS: calls,
        FAIL_IMAGE: failImage,
        GITHUB_OUTPUT: output,
        GITHUB_REPOSITORY: 'org/repo',
        GITHUB_SERVER_URL: 'https://github.com',
        GITHUB_SHA: 'abcdef1234567890',
        GITHUB_STEP_SUMMARY: summary,
        'INPUT_ADDITIONAL-IMAGE-REFS': additional,
        'INPUT_APPLICATION-NAME': 'CDCP frontend',
        'INPUT_IMAGE-REF': primary,
        NO_TRAILING_NEWLINE: String(noTrailingNewline),
        PATH: `${directory}${delimiter}${process.env.PATH}`,
        PUSH_DIGESTS: JSON.stringify(digests),
        RUNNER_TEMP: directory,
      },
    });
    return {
      ...result,
      calls: readFileSync(calls, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse),
      output: readFileSync(output, 'utf8'),
      summary: readFileSync(summary, 'utf8'),
      temporaryLogs: readdirSync(directory).filter((name) => name.startsWith('image-push.')),
    };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test('pushes only the supplied primary reference and reports its digest', () => {
  const result = execute();
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.calls, [['push', primary]]);
  assert.equal(result.output, `image-digest=${digest}\n`);
  assert.ok(result.summary.includes(`| CDCP frontend | \`1.2.3-abcdef12-00007\` | \`${primary}\``));
  assert.ok(result.summary.includes('https://github.com/org/repo/commit/abcdef1234567890'));
  assert.ok(result.summary.includes(`Image digest: \`${digest}\``));
  assert.deepEqual(result.temporaryLogs, []);
});

test('pushes additional references in order, skips empty lines, and retains the primary digest', () => {
  const first = 'registry.example/cdcp:1.2.3-abcdef12';
  const second = 'registry.example/cdcp:another-tag';
  const result = execute({
    additional: `\n${first}\n\n${second}`,
    digests: { [first]: `sha256:${'b'.repeat(64)}`, [second]: `sha256:${'c'.repeat(64)}` },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.calls, [
    ['push', primary],
    ['push', first],
    ['push', second],
  ]);
  assert.equal(result.output, `image-digest=${digest}\n`);
  const position = (reference) => result.summary.indexOf(reference + String.fromCharCode(96));
  assert.ok(position(primary) < position(first));
  assert.ok(position(first) < position(second));
});

test('fails on an invalid primary digest without producing a digest output', () => {
  const result = execute({ defaultDigest: 'sha256:invalid' });
  assert.equal(result.status, 1);
  assert.equal(result.output, '');
  assert.match(result.stderr, /Unable to determine the pushed image digest/);
  assert.deepEqual(result.temporaryLogs, []);
});

test('captures a digest from stderr without a trailing newline', () => {
  const result = execute({ digestStream: 'stderr', noTrailingNewline: true });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.output, `image-digest=${digest}\n`);
});

test('fails immediately when the primary push fails', () => {
  const result = execute({ additional: 'registry.example/cdcp:extra', failImage: primary });
  assert.equal(result.status, 17);
  assert.deepEqual(result.calls, [['push', primary]]);
  assert.equal(result.output, '');
  assert.deepEqual(result.temporaryLogs, []);
});

test('fails when an additional push fails and does not publish a digest output', () => {
  const additional = 'registry.example/cdcp:extra';
  const result = execute({ additional, failImage: additional });
  assert.equal(result.status, 17);
  assert.deepEqual(result.calls, [
    ['push', primary],
    ['push', additional],
  ]);
  assert.equal(result.output, '');
  assert.deepEqual(result.temporaryLogs, []);
});
