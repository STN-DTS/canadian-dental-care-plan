import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { test } from 'vitest';

type DownloadOptions = {
  sourceEvent?: unknown;
  eventText?: string;
  listText?: string;
  pages?: unknown[];
  empty?: boolean;
  listStatus?: number;
  downloadStatus?: number;
};

type UploadOptions = {
  failCommands?: string;
  failCleanup?: boolean;
  failCertificate?: boolean;
  failAuthPublish?: boolean;
  failSummary?: boolean;
  failPnpm?: boolean;
  missingCli?: boolean;
  certificate?: string;
  emptyArchive?: boolean;
  missingCredential?: boolean;
};

type CliCall = {
  args: string[];
  home: string;
  xdg: string;
  temp: string;
  directoryMode: number;
  certificateMode: number | null;
  certificate: string | null;
  published: string;
  secretEnv: string[];
};

type PnpmCall = { home: string; args: string[]; execPath: string };

const script = fileURLToPath(new URL('./upload-prod-test-results-sharepoint.ts', import.meta.url));
const workflow = readFileSync(new URL('../workflows/upload-prod-test-results-sharepoint.yaml', import.meta.url), 'utf8');
const artifact = { id: 123, name: 'test-reports-42-3', expired: false };
const event = {
  workflow_run: { id: 42, run_attempt: 3, head_branch: 'v1.2.3-rc.1', conclusion: 'success', event: 'push', head_repository: { full_name: 'org/repo' } },
};
const fakeFetch = `
import fs from 'node:fs';
globalThis.fetch = async (url) => {
  fs.appendFileSync(process.env.FETCH_CALLS, String(url) + '\\n');
  if (String(url).endsWith('/zip')) {
    return new Response(process.env.EMPTY_ARCHIVE === 'true' ? '' : 'zip-content', { status: Number(process.env.DOWNLOAD_STATUS || 200) });
  }
  const pages = JSON.parse(process.env.ARTIFACT_PAGES);
  const page = Number(new URL(url).searchParams.get('page'));
  return new Response(process.env.LIST_TEXT || JSON.stringify(pages[page - 1] ?? { artifacts: [] }), { status: Number(process.env.LIST_STATUS || 200) });
};
`;

function executeDownload({ sourceEvent = event, eventText, listText = '', pages = [{ artifacts: [artifact] }], empty = false, listStatus = 200, downloadStatus = 200 }: DownloadOptions = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'cdcp sharepoint test '));

  try {
    const eventPath = join(directory, 'event.json');
    const githubEnv = join(directory, 'env');
    const calls = join(directory, 'calls');
    const preload = join(directory, 'fetch.mjs');
    writeFileSync(eventPath, eventText ?? JSON.stringify(sourceEvent));
    writeFileSync(githubEnv, '');
    writeFileSync(calls, '');
    writeFileSync(preload, fakeFetch);
    const result = spawnSync(process.execPath, ['--import', preload, script, 'download'], {
      encoding: 'utf8',
      env: {
        ...process.env,
        ARTIFACT_PAGES: JSON.stringify(pages),
        DOWNLOAD_STATUS: String(downloadStatus),
        EMPTY_ARCHIVE: String(empty),
        FETCH_CALLS: calls,
        GH_TOKEN: 'github-token-canary',
        GITHUB_API_URL: 'https://api.github.test',
        GITHUB_ENV: githubEnv,
        GITHUB_EVENT_PATH: eventPath,
        GITHUB_REPOSITORY: 'org/repo',
        LIST_STATUS: String(listStatus),
        LIST_TEXT: listText,
        RUNNER_TEMP: directory,
      },
    });
    const published = readFileSync(githubEnv, 'utf8');
    const archivePath = published.match(/^REPORT_ARCHIVE_PATH=(.+)$/m)?.[1];
    return {
      ...result,
      published,
      calls: readFileSync(calls, 'utf8').trim().split('\n').filter(Boolean),
      archive: archivePath && result.status === 0 ? readFileSync(archivePath, 'utf8') : undefined,
      reportDirectories: readdirSync(directory).filter((name) => name.startsWith('cdcp-sharepoint-reports-')),
    };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test.each([{ workflow_run: { ...event.workflow_run, id: '42' } }, { workflow_run: { ...event.workflow_run, run_attempt: 0 } }, { workflow_run: null }])('rejects malformed source run data before fetching', (sourceEvent) => {
  const result = executeDownload({ sourceEvent });
  assert.equal(result.status, 1);
  assert.deepEqual(result.calls, []);
  assert.match(result.stderr, /valid release tag, run ID, and attempt/);
});

test.each([{}, { artifacts: null }, { artifacts: [{ ...artifact, id: '123' }] }, { artifacts: [{ ...artifact, expired: 'false' }] }])('rejects malformed artifact API data', (page) => {
  const result = executeDownload({ pages: [page] });
  assert.equal(result.status, 1);
  assert.equal(result.calls.length, 1);
  assert.match(result.stderr, /invalid data/);
});

const fakePnpm = `#!/usr/bin/env node
    const fs = require('node:fs');
    const { spawnSync } = require('node:child_process');
    const args = process.argv.slice(2);
    fs.appendFileSync(process.env.PNPM_CALLS, JSON.stringify({ home: process.env.HOME, args: args.slice(0, 4), execPath: process.execPath }) + '\\n');
    if (process.env.FAIL_PNPM === 'true') {
      process.stderr.write(process.env.SECRET_CANARY);
      process.exit(12);
    }
    const result = spawnSync(args[1], args.slice(2), { env: process.env, stdio: 'inherit' });
    process.exit(result.status ?? 1);
    `;
const fakeCli = `#!/usr/bin/env node
    const fs = require('node:fs');
    const path = require('node:path');
    const args = process.argv.slice(2);
    const certificatePath = args[args.indexOf('--certificateFile') + 1];
    const isLogin = args[0] === 'login';
    fs.appendFileSync(process.env.CLI_CALLS, JSON.stringify({
      args,
      home: process.env.HOME,
      xdg: process.env.XDG_CONFIG_HOME,
      temp: process.env.TMPDIR,
      directoryMode: fs.statSync(process.env.HOME).mode & 0o777,
      certificateMode: isLogin ? fs.statSync(certificatePath).mode & 0o777 : null,
      certificate: isLogin ? fs.readFileSync(certificatePath, 'utf8') : null,
      published: fs.readFileSync(process.env.GITHUB_ENV, 'utf8'),
      secretEnv: ['CLIENT_CERT_PFX', 'CLIENT_CERT_PFX_PASSWORD', 'CLIENT_ID', 'GH_TOKEN'].filter(key => process.env[key]),
    }) + '\\n');
    fs.writeFileSync(path.join(process.env.HOME, '.cli-m365-msal.json'), 'private-token');
    process.stdout.write(process.env.SECRET_CANARY);
    process.stderr.write(process.env.SECRET_CANARY);
    if ((process.env.FAIL_COMMANDS || '').split(',').includes(args[0])) process.exit(17);
    `;

function executeUpload({
  failCommands = '',
  failCleanup = false,
  failCertificate = false,
  failAuthPublish = false,
  failSummary = false,
  failPnpm = false,
  missingCli = false,
  certificate = Buffer.from('pfx-canary').toString('base64'),
  emptyArchive = false,
  missingCredential = false,
}: UploadOptions = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'cdcp sharepoint upload test '));

  try {
    const calls = join(directory, 'cli-calls');
    const pnpmCalls = join(directory, 'pnpm-calls');
    const githubEnv = join(directory, 'env');
    const summary = join(directory, 'summary');
    const archive = join(directory, 'v1.2.3.zip');
    const preload = join(directory, 'cleanup.mjs');

    for (const path of [calls, pnpmCalls, githubEnv, summary]) {
      writeFileSync(path, '');
    }

    writeFileSync(archive, emptyArchive ? '' : 'zip-content');
    symlinkSync(process.execPath, join(directory, 'node'));
    writeFileSync(join(directory, 'pnpm'), fakePnpm, { mode: 0o700 });

    if (!missingCli) {
      writeFileSync(join(directory, 'm365'), fakeCli, { mode: 0o700 });
    }

    writeFileSync(
      preload,
      `
    import fs from 'node:fs/promises';
    import { syncBuiltinESMExports } from 'node:module';
    if (process.env.FAIL_CLEANUP === 'true') {
      fs.rm = async () => { throw new Error(process.env.SECRET_CANARY); };
    }
    if (process.env.FAIL_CERTIFICATE === 'true') fs.writeFile = async () => { throw new Error(process.env.SECRET_CANARY); };
    const appendFile = fs.appendFile;
    fs.appendFile = async (path, ...args) => {
      if ((process.env.FAIL_AUTH_PUBLISH === 'true' && path === process.env.GITHUB_ENV) ||
          (process.env.FAIL_SUMMARY === 'true' && path === process.env.GITHUB_STEP_SUMMARY)) {
        throw new Error(process.env.SECRET_CANARY);
      }
      return await appendFile(path, ...args);
    };
    syncBuiltinESMExports();
    `,
    );
    const secretCanary = 'token-email@example.test-123456789';
    const result = spawnSync(process.execPath, ['--import', preload, script, 'upload'], {
      encoding: 'utf8',
      env: {
        ...process.env,
        CLI_CALLS: calls,
        CLIENT_CERT_PFX: certificate,
        CLIENT_CERT_PFX_PASSWORD: secretCanary,
        CLIENT_ID: missingCredential ? '' : secretCanary,
        FAIL_AUTH_PUBLISH: String(failAuthPublish),
        FAIL_CLEANUP: String(failCleanup),
        FAIL_CERTIFICATE: String(failCertificate),
        FAIL_COMMANDS: failCommands,
        FAIL_PNPM: String(failPnpm),
        FAIL_SUMMARY: String(failSummary),
        GH_TOKEN: secretCanary,
        GITHUB_ENV: githubEnv,
        GITHUB_STEP_SUMMARY: summary,
        PATH: `${directory}${delimiter}/usr/bin${delimiter}/bin`,
        PNPM_CALLS: pnpmCalls,
        REPORT_ARCHIVE_PATH: archive,
        RUNNER_TEMP: directory,
        SECRET_CANARY: secretCanary,
        SHAREPOINT_SITE_URL: 'https://sharepoint.test/sites/CDCP',
        SHAREPOINT_TEST_REPORT_FOLDER: '/sites/CDCP/Shared Documents/Test reports',
        TENANT_ID: 'tenant-canary',
      },
    });
    return {
      ...result,
      calls: readFileSync(calls, 'utf8')
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line): CliCall => JSON.parse(line)),
      pnpmCalls: readFileSync(pnpmCalls, 'utf8')
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line): PnpmCall => JSON.parse(line)),
      summary: readFileSync(summary, 'utf8'),
      authDirectories: readdirSync(directory).filter((name) => name.startsWith('cdcp-m365-auth-')),
      originalHome: process.env['HOME'],
      archive,
      secretCanary,
    };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test('uploads through workspace CLI with private certificate authentication and explicit overwrite', () => {
  const result = executeUpload();
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(
    result.calls.map((call) => call.args[0]),
    ['cli', 'login', 'spo', 'logout'],
  );
  const [config, login, upload] = result.calls;
  assert.ok(config && login && upload);
  assert.deepEqual(config.args, ['cli', 'config', 'set', '--key', 'disableTelemetry', '--value', 'true', '--output', 'none']);
  const home = login.home;
  assert.deepEqual(login.args, ['login', '--authType', 'certificate', '--appId', result.secretCanary, '--tenant', 'tenant-canary', '--certificateFile', join(home, 'client-cert.pfx'), '--password', result.secretCanary, '--output', 'none']);
  assert.equal(login.certificate, 'pfx-canary');
  assert.equal(login.certificateMode, 0o600);
  assert.deepEqual(upload.args, ['spo', 'file', 'add', '--webUrl', 'https://sharepoint.test/sites/CDCP', '--folder', '/sites/CDCP/Shared Documents/Test reports', '--path', result.archive, '--overwrite', 'true', '--output', 'none']);

  for (const call of result.calls) {
    assert.equal(call.home, home);
    assert.equal(call.xdg, home);
    assert.equal(call.temp, home);
    assert.equal(call.directoryMode, 0o700);
    assert.ok(call.published.includes(`M365_AUTH_DIRECTORY=${home}\n`));
    assert.deepEqual(call.secretEnv, []);
  }

  for (const call of result.pnpmCalls) {
    assert.equal(call.execPath, process.execPath);
    assert.equal(call.home, result.originalHome);
    assert.equal(call.args[0], 'exec');
    assert.equal(call.args[1], 'env');
    assert.equal(call.args[2], `HOME=${home}`);
    assert.equal(call.args[3], `XDG_CONFIG_HOME=${home}`);
  }

  assert.deepEqual(result.authDirectories, []);
  assert.equal(result.summary, 'Uploaded `v1.2.3.zip` to SharePoint.\n');
  assert.ok(!result.stdout.includes(result.secretCanary));
  assert.ok(!result.stderr.includes(result.secretCanary));
});

test.each<[string, RegExp]>([
  ['cli', /configuration failed/],
  ['login', /authentication failed/],
  ['spo', /upload failed/],
  ['logout', /logout failed/],
  ['spo,logout', /upload failed/],
])('fails safely on CLI command failure %s and cleans private state', (failCommands, reason) => {
  const result = executeUpload({ failCommands });
  assert.equal(result.status, 1);
  assert.equal(result.summary, '');
  assert.match(result.stderr, reason);
  assert.equal(result.calls.at(-1)?.args[0], 'logout');
  assert.deepEqual(result.authDirectories, []);
  assert.ok(!result.stdout.includes(result.secretCanary));
  assert.ok(!result.stderr.includes(result.secretCanary));

  if (failCommands.includes('logout')) {
    assert.match(result.stderr, /logout failed/);
  }

  if (failCommands === 'login' || failCommands === 'cli') {
    assert.ok(!result.calls.some((call) => call.args[0] === 'spo'));
  }
});

test.each(['', 'spo'])('reports cleanup failure without hiding an earlier primary failure %s', (failCommands) => {
  const result = executeUpload({ failCommands, failCleanup: true });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /authentication directory cleanup failed/);
  assert.match(result.stderr, failCommands ? /upload failed/ : /upload cleanup failed/);
  assert.equal(result.summary, '');
  assert.equal(result.authDirectories.length, 1);
  assert.ok(!result.stderr.includes(result.secretCanary));
});

test.each([
  { name: 'pnpm failure', options: { failPnpm: true } },
  { name: 'missing m365 executable', options: { missingCli: true } },
])('handles $name without secret output', ({ options }) => {
  const result = executeUpload(options);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /configuration failed/);
  assert.match(result.stderr, /logout failed/);
  assert.equal(result.summary, '');
  assert.equal(result.pnpmCalls.length, 2);
  assert.deepEqual(result.authDirectories, []);
  assert.ok(!result.stdout.includes(result.secretCanary));
  assert.ok(!result.stderr.includes(result.secretCanary));
});

test.each([
  { name: 'certificate writing', options: { failCertificate: true } },
  { name: 'authentication directory publication', options: { failAuthPublish: true } },
])('cleans authentication state when $name fails', ({ options }) => {
  const result = executeUpload(options);
  assert.equal(result.status, 1);
  assert.equal(result.summary, '');
  assert.deepEqual(result.authDirectories, []);
  assert.deepEqual(
    result.calls.map((call) => call.args[0]),
    ['logout'],
  );
  assert.ok(!result.stderr.includes(result.secretCanary));
});

test('reports summary publication failure after uploading and cleaning private state', () => {
  const result = executeUpload({ failSummary: true });
  assert.equal(result.status, 1);
  assert.equal(result.summary, '');
  assert.deepEqual(
    result.calls.map((call) => call.args[0]),
    ['cli', 'login', 'spo', 'logout'],
  );
  assert.deepEqual(result.authDirectories, []);
  assert.ok(!result.stderr.includes(result.secretCanary));
});

test('decodes multiline base64 certificate material without printing it', () => {
  const result = executeUpload({ certificate: 'cGZ4\r\nLWNhbmFyeQ==\n' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.calls[1]?.certificate, 'pfx-canary');
  assert.deepEqual(result.authDirectories, []);
});

test.each([{ certificate: 'not base64!' }, { emptyArchive: true }, { missingCredential: true }])('rejects invalid upload inputs before invoking the CLI', (options) => {
  const result = executeUpload(options);
  assert.equal(result.status, 1);
  assert.deepEqual(result.calls, []);
  assert.deepEqual(result.authDirectories, []);
  assert.equal(result.summary, '');
});

test('keeps credentials step-scoped and cancellation cleanup available without container tools', () => {
  assert.ok(!/\bdocker\b|container|M365_CLI_IMAGE/i.test(workflow));
  assert.match(workflow, /uses: \.\/\.github\/actions\/setup-pnpm/);
  assert.ok(!workflow.includes('actions/setup-node'));
  assert.match(workflow, /persist-credentials: false\n          ref: \$\{\{ github\.event\.repository\.default_branch \}\}/);
  assert.equal((workflow.match(/steps\.vault\.outputs\./g) ?? []).length, 3);
  assert.match(workflow, /exportEnv: false\n          exportToken: false/);
  assert.match(workflow, /run: node \.github\/scripts\/upload-prod-test-results-sharepoint\.ts download/);
  assert.match(workflow, /run: node \.github\/scripts\/upload-prod-test-results-sharepoint\.ts upload/);
  assert.match(workflow, /if: \$\{\{ always\(\) && \(env\.M365_AUTH_DIRECTORY != '' \|\| env\.REPORT_DIRECTORY != ''\) \}\}/);
  assert.match(workflow, /run: node \.github\/scripts\/upload-prod-test-results-sharepoint\.ts cleanup/);
  assert.ok(!workflow.includes('rm -rf'));
});

test('validates destination configuration before checkout and dependency installation', () => {
  const validation = workflow.indexOf('- name: Validate SharePoint destination');
  const checkout = workflow.indexOf('- name: Checkout trusted workflow scripts and workspace');
  const setup = workflow.indexOf('- name: Setup pnpm, Node.js, and dependencies');
  assert.ok(validation >= 0);
  assert.ok(validation < checkout);
  assert.ok(checkout < setup);
});

function executeCleanup({ authPath, failAuth = false, missing = false, symlink = false }: { authPath?: string; failAuth?: boolean; missing?: boolean; symlink?: boolean } = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'cdcp cleanup test '));
  const outside = mkdtempSync(join(tmpdir(), 'cdcp cleanup outside '));

  try {
    const auth = mkdtempSync(join(directory, 'cdcp-m365-auth-'));
    const reports = mkdtempSync(join(directory, 'cdcp-sharepoint-reports-'));
    const sentinel = join(outside, 'keep');
    writeFileSync(sentinel, 'private-canary@example.test');

    if (symlink) {
      rmSync(auth, { recursive: true });
      symlinkSync(outside, auth);
    }

    const preload = join(directory, 'cleanup.mjs');
    writeFileSync(
      preload,
      `
      import fs from 'node:fs/promises';
      import { syncBuiltinESMExports } from 'node:module';
      const remove = fs.rm;
      fs.rm = async (path, options) => {
        if (path === process.env.M365_AUTH_DIRECTORY) throw new Error('private-canary@example.test');
        return await remove(path, options);
      };
      syncBuiltinESMExports();
    `,
    );
    const args = failAuth ? ['--import', preload, script, 'cleanup'] : [script, 'cleanup'];
    const result = spawnSync(process.execPath, args, {
      encoding: 'utf8',
      env: {
        ...process.env,
        RUNNER_TEMP: directory,
        M365_AUTH_DIRECTORY: missing ? '' : authPath === 'outside' ? outside : authPath === 'root' ? directory : (authPath ?? auth),
        REPORT_DIRECTORY: missing ? '' : reports,
      },
    });
    return {
      ...result,
      authExists: existsSync(auth),
      reportsExist: existsSync(reports),
      outsideExists: existsSync(sentinel),
    };
  } finally {
    rmSync(directory, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
}

test('cleanup mode removes both published directories without credentials', () => {
  const result = executeCleanup();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.authExists, false);
  assert.equal(result.reportsExist, false);
  assert.equal(result.outsideExists, true);
});

test('cleanup mode accepts missing directory variables before any temporary state exists', () => {
  const result = executeCleanup({ missing: true });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.authExists, true);
  assert.equal(result.reportsExist, true);
});

test.each(['outside', 'root', 'cdcp-m365-auth-invalid'])('cleanup refuses invalid directory %s but still removes reports', (authPath) => {
  const result = executeCleanup({ authPath });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Refusing invalid cleanup directory \(M365_AUTH_DIRECTORY\)/);
  assert.equal(result.reportsExist, false);
  assert.equal(result.outsideExists, true);
});

test('cleanup still removes reports after authentication directory removal fails', () => {
  const result = executeCleanup({ failAuth: true });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Temporary directory cleanup failed \(M365_AUTH_DIRECTORY\)/);
  assert.equal(result.authExists, true);
  assert.equal(result.reportsExist, false);
  assert.ok(!result.stderr.includes('private-canary@example.test'));
});

test('cleanup removes an authentication symlink without deleting its target', () => {
  const result = executeCleanup({ symlink: true });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.authExists, false);
  assert.equal(result.outsideExists, true);
});
test('downloads only the exact source attempt artifact and names the archive after its release tag', () => {
  const result = executeDownload({ pages: [{ artifacts: [{ ...artifact, name: 'test-reports-42-2' }, artifact] }] });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.archive, 'zip-content');
  assert.equal(result.reportDirectories.length, 1);
  assert.match(result.published, /REPORT_ARCHIVE_PATH=.+\/v1\.2\.3-rc\.1\.zip\n/);
  assert.deepEqual(result.calls, ['https://api.github.test/repos/org/repo/actions/runs/42/artifacts?per_page=100&page=1', 'https://api.github.test/repos/org/repo/actions/artifacts/123/zip']);
});

test('paginates beyond a full artifact page', () => {
  const result = executeDownload({ pages: [{ artifacts: Array.from({ length: 100 }, () => ({ ...artifact, name: 'other' })) }, { artifacts: [artifact] }] });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.calls.length, 3);
  const secondPage = result.calls[1];
  assert.ok(secondPage);
  assert.match(secondPage, /page=2$/);
});

test.each<[string, (typeof artifact)[]]>([
  ['missing', []],
  ['expired', [{ ...artifact, expired: true }]],
  ['duplicate', [artifact, artifact]],
  ['wrong attempt', [{ ...artifact, name: 'test-reports-42-2' }]],
])('rejects %s source reports without downloading', (_label, artifacts) => {
  const result = executeDownload({ pages: [{ artifacts }] });
  assert.equal(result.status, 1);
  assert.equal(result.calls.length, 1);
  assert.equal(result.published, '');
});

test.each(['main', '../v1.2.3', 'v1.2', 'v1.2.3\ninjected'])('rejects invalid release tag %s before fetching', (head_branch) => {
  const result = executeDownload({ sourceEvent: { workflow_run: { ...event.workflow_run, head_branch } } });
  assert.equal(result.status, 1);
  assert.deepEqual(result.calls, []);
});

test('rejects zero-byte archives after publishing their cleanup path', () => {
  const result = executeDownload({ empty: true });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /empty/);
  assert.match(result.published, /REPORT_DIRECTORY=/);
  assert.deepEqual(result.reportDirectories, []);
});

test.each([{ listStatus: 403 }, { downloadStatus: 410 }])('fails on artifact API errors', (options) => {
  const result = executeDownload(options);
  assert.equal(result.status, 1);
  assert.ok(!result.stdout.includes('github-token-canary'));
  assert.ok(!result.stderr.includes('github-token-canary'));
  assert.deepEqual(result.reportDirectories, []);
});

test.each<[DownloadOptions, RegExp]>([
  [{ eventText: '{invalid' }, /Originating run contains invalid JSON/],
  [{ listText: '{invalid' }, /Artifact listing contains invalid JSON/],
])('reports malformed external JSON without printing its contents', (options, reason) => {
  const result = executeDownload(options);
  assert.equal(result.status, 1);
  assert.match(result.stderr, reason);
  assert.ok(!result.stderr.includes('{invalid'));
});

test('preserves the non-fork prerequisite and source-run eligibility', () => {
  assert.match(workflow, /check-repository:\n    if: \$\{\{ github\.event\.repository\.fork != true \}\}\n    runs-on: ubuntu-latest\n    permissions: \{\}/);
  assert.match(workflow, /upload-reports:\n    needs: check-repository/);
  const match = workflow.match(/if: >-\n([\s\S]*?)    runs-on: arc-runners-dshp-prod/);
  assert.ok(match?.[1]);
  const expression = match[1].trim().slice(3, -2);
  const eligible = (run: typeof event.workflow_run, fork: boolean | undefined, gate = 'success'): boolean => gate === 'success' && fork !== true && runInNewContext(expression, { github: { event: { workflow_run: run }, repository: 'org/repo' } });

  for (const fork of [false, undefined]) {
    for (const sourceEvent of ['push', 'workflow_dispatch']) {
      assert.equal(eligible({ ...event.workflow_run, event: sourceEvent }, fork), true);
    }
  }

  assert.equal(eligible(event.workflow_run, true), false);

  for (const gate of ['skipped', 'failure', 'cancelled']) {
    assert.equal(eligible(event.workflow_run, false, gate), false);
  }

  for (const conclusion of ['failure', 'cancelled', 'skipped']) {
    assert.equal(eligible({ ...event.workflow_run, conclusion }, false), false);
  }

  assert.equal(eligible({ ...event.workflow_run, event: 'pull_request' }, false), false);
  assert.equal(eligible({ ...event.workflow_run, head_repository: { full_name: 'fork/repo' } }, false), false);
});
