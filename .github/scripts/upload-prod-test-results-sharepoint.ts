import { spawnSync } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { appendFile, chmod, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

type Artifact = { id: number; name: string; expired: boolean };
type SourceRun = { id: number; run_attempt: number; head_branch: string };

class UploadError extends Error {}

function required(name: string): string {
  const value = process.env[name];

  if (!value || /[\r\n]/.test(value)) {
    throw new UploadError(`Required configuration is missing or invalid (${name}).`);
  }

  return value;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function positiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function releaseTag(value: unknown): value is string {
  return typeof value === 'string' && /^v[0-9]+\.[0-9]+\.[0-9]+[A-Za-z0-9._-]*$/.test(value) && !/[\r\n]/.test(value);
}

function sourceRun(value: unknown): SourceRun {
  const run = record(value) ? value['workflow_run'] : undefined;

  if (!record(run) || !positiveInteger(run['id']) || !positiveInteger(run['run_attempt']) || !releaseTag(run['head_branch'])) {
    throw new UploadError('Originating run does not identify a valid release tag, run ID, and attempt.');
  }

  return { id: run['id'], run_attempt: run['run_attempt'], head_branch: run['head_branch'] };
}

function artifactPage(value: unknown): Artifact[] {
  if (!record(value) || !Array.isArray(value['artifacts'])) {
    throw new UploadError('Artifact listing contains invalid data.');
  }

  return value['artifacts'].map((artifact: unknown) => {
    if (!record(artifact) || !positiveInteger(artifact['id']) || typeof artifact['name'] !== 'string' || typeof artifact['expired'] !== 'boolean') {
      throw new UploadError('Artifact listing contains invalid data.');
    }

    return { id: artifact['id'], name: artifact['name'], expired: artifact['expired'] };
  });
}

async function cleanup(): Promise<void> {
  const directories = [
    { name: 'M365_AUTH_DIRECTORY', prefix: 'cdcp-m365-auth-' },
    { name: 'REPORT_DIRECTORY', prefix: 'cdcp-sharepoint-reports-' },
  ];
  const outcomes = await Promise.all(
    directories.map(async ({ name, prefix }) => {
      const directory = process.env[name];

      if (!directory) {
        return true;
      }

      const path = resolve(directory);
      const leaf = basename(path);

      if (/[\r\n]/.test(directory) || dirname(path) !== resolve(required('RUNNER_TEMP')) || !leaf.startsWith(prefix) || leaf.length === prefix.length) {
        process.stderr.write(`Refusing invalid cleanup directory (${name}).\n`);
        return false;
      }

      try {
        await rm(path, { recursive: true, force: true });
        return true;
      } catch {
        process.stderr.write(`Temporary directory cleanup failed (${name}).\n`);
        return false;
      }
    }),
  );

  if (outcomes.includes(false)) {
    throw new UploadError('SharePoint upload cleanup failed.');
  }
}

function json(text: string, failure: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new UploadError(failure);
  }
}

async function download(): Promise<void> {
  const event = json(await readFile(required('GITHUB_EVENT_PATH'), 'utf8'), 'Originating run contains invalid JSON.');
  const run = sourceRun(event);
  const artifactName = `test-reports-${run.id}-${run.run_attempt}`;
  const headers = {
    Authorization: `Bearer ${required('GH_TOKEN')}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  const baseUri = `${required('GITHUB_API_URL')}/repos/${required('GITHUB_REPOSITORY')}/actions`;
  const matches: Artifact[] = [];

  /* eslint-disable no-await-in-loop */
  for (let page = 1; ; page++) {
    const response = await fetch(`${baseUri}/runs/${run.id}/artifacts?per_page=100&page=${page}`, { headers });

    if (!response.ok) {
      throw new UploadError(`Listing test-report artifacts failed (HTTP ${response.status}).`);
    }

    const result = json(await response.text(), 'Artifact listing contains invalid JSON.');
    const artifacts = artifactPage(result);
    matches.push(...artifacts.filter((artifact) => artifact.name === artifactName));

    if (artifacts.length < 100) {
      break;
    }
  }
  /* eslint-enable no-await-in-loop */

  const artifact = matches.at(0);

  if (matches.length !== 1 || !artifact || artifact.expired) {
    throw new UploadError('Expected one unexpired test-report artifact from the originating run attempt.');
  }

  const githubEnv = required('GITHUB_ENV');
  const directory = await mkdtemp(join(required('RUNNER_TEMP'), 'cdcp-sharepoint-reports-'));
  const archivePath = join(directory, `${run.head_branch}.zip`);

  try {
    await appendFile(githubEnv, `REPORT_DIRECTORY=${directory}\nREPORT_ARCHIVE_PATH=${archivePath}\n`);
    const response = await fetch(`${baseUri}/artifacts/${artifact.id}/zip`, { headers });

    if (!response.ok) {
      throw new UploadError(`Downloading test reports failed (HTTP ${response.status}).`);
    }

    if (!response.body) {
      throw new UploadError('Downloaded test-report archive has no body.');
    }

    await pipeline(Readable.from(response.body), createWriteStream(archivePath, { mode: 0o600 }));

    if ((await stat(archivePath)).size === 0) {
      throw new UploadError('Downloaded test-report archive is empty.');
    }
  } catch (error) {
    try {
      await rm(directory, { recursive: true, force: true });
    } catch {
      process.stderr.write('Test-report directory cleanup failed.\n');
    }

    throw error;
  }
}

function m365(home: string, args: string[], failure: string): void {
  const env: NodeJS.ProcessEnv = { ...process.env, CLIMICROSOFT365_NOUPDATE: '1' };
  delete env['CLIENT_CERT_PFX'];
  delete env['CLIENT_CERT_PFX_PASSWORD'];
  delete env['CLIENT_ID'];
  delete env['GH_TOKEN'];
  // env changes HOME only after pnpm resolves the workspace executables.
  const result = spawnSync('pnpm', ['exec', 'env', `HOME=${home}`, `XDG_CONFIG_HOME=${home}`, `TMPDIR=${home}`, `TMP=${home}`, `TEMP=${home}`, 'm365', ...args, '--output', 'none'], {
    env,
    stdio: 'ignore',
  });

  if (result.error || result.signal || result.status !== 0) {
    throw new UploadError(failure);
  }
}

async function upload(): Promise<void> {
  const clientId = required('CLIENT_ID');
  const certificate = process.env['CLIENT_CERT_PFX']?.replace(/[\r\n]/g, '');

  if (!certificate) {
    throw new UploadError('SharePoint certificate is required.');
  }

  const password = process.env['CLIENT_CERT_PFX_PASSWORD'] ?? '';
  const tenant = required('TENANT_ID');
  const site = required('SHAREPOINT_SITE_URL');
  const folder = required('SHAREPOINT_TEST_REPORT_FOLDER');
  const archive = resolve(required('REPORT_ARCHIVE_PATH'));
  const filename = basename(archive);

  if (!filename.endsWith('.zip') || !releaseTag(filename.slice(0, -4))) {
    throw new UploadError('Test-report archive does not identify a valid release tag.');
  }

  const archiveStat = await stat(archive);

  if (!archiveStat.isFile() || archiveStat.size === 0) {
    throw new UploadError('Test-report archive is missing or empty.');
  }

  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(certificate)) {
    throw new UploadError('SharePoint certificate is not valid base64.');
  }

  const githubEnv = required('GITHUB_ENV');
  const summary = required('GITHUB_STEP_SUMMARY');
  const home = await mkdtemp(join(required('RUNNER_TEMP'), 'cdcp-m365-auth-'));
  let failure: { error: unknown } | undefined;
  let cleanupFailed = false;

  try {
    await appendFile(githubEnv, `M365_AUTH_DIRECTORY=${home}\n`);
    await chmod(home, 0o700);
    process.umask(0o077);
    const certificatePath = join(home, 'client-cert.pfx');
    await writeFile(certificatePath, Buffer.from(certificate, 'base64'), { mode: 0o600 });
    m365(home, ['cli', 'config', 'set', '--key', 'disableTelemetry', '--value', 'true'], 'Microsoft 365 configuration failed.');
    m365(home, ['login', '--authType', 'certificate', '--appId', clientId, '--tenant', tenant, '--certificateFile', certificatePath, '--password', password], 'Microsoft 365 authentication failed.');
    m365(home, ['spo', 'file', 'add', '--webUrl', site, '--folder', folder, '--path', archive, '--overwrite', 'true'], 'SharePoint test-report upload failed.');
  } catch (error) {
    failure = { error };
  } finally {
    try {
      m365(home, ['logout'], 'Microsoft 365 logout failed.');
    } catch {
      cleanupFailed = true;
      process.stderr.write('Microsoft 365 logout failed.\n');
    }

    try {
      await rm(home, { recursive: true, force: true });
    } catch {
      cleanupFailed = true;
      process.stderr.write('Microsoft 365 authentication directory cleanup failed.\n');
    }
  }

  if (failure) {
    throw failure.error;
  }

  if (cleanupFailed) {
    throw new UploadError('SharePoint upload cleanup failed.');
  }

  await appendFile(summary, `Uploaded \`${filename}\` to SharePoint.\n`);
}

try {
  switch (process.argv[2]) {
    case 'download':
      await download();
      break;
    case 'upload':
      await upload();
      break;
    case 'cleanup':
      await cleanup();
      break;
    default:
      throw new UploadError('Expected download, upload, or cleanup mode.');
  }

  process.stdout.write('SharePoint report step completed.\n');
} catch (error) {
  process.stderr.write(`${error instanceof UploadError ? error.message : 'SharePoint report step failed.'}\n`);
  process.exitCode = 1;
}
