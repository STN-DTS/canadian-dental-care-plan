/**
 * Renovate loads this async config at startup to obtain a CDCP-scoped GitHub App
 * installation token and Node.js/pnpm constraints from the default branch.
 * Uses Node built-ins only; App credentials come from Vault-backed pod secrets.
 */
import { sign } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const repository = 'STN-DTS/canadian-dental-care-plan';
const repositoryPath = `/repos/${repository}`;

async function github(path, token, body) {
  const response = await fetch(`https://api.github.com${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'cdcp-renovate',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(`GitHub ${body ? 'POST' : 'GET'} ${path} failed with HTTP ${response.status}.`);
  }

  return await response.json();
}

export default async function config() {
  const clientId = process.env.RENOVATE_APP_CLIENT_ID;
  const keyFile = process.env.RENOVATE_APP_PRIVATE_KEY_FILE;

  if (!clientId || !keyFile) {
    throw new Error('RENOVATE_APP_CLIENT_ID and RENOVATE_APP_PRIVATE_KEY_FILE are required.');
  }

  if (!['full', 'null'].includes(process.env.RENOVATE_DRY_RUN)) {
    throw new Error('RENOVATE_DRY_RUN must explicitly be full or null.');
  }

  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ iat: now - 60, exp: now + 540, iss: clientId })).toString('base64url');
  const unsigned = `${header}.${payload}`;
  const key = await readFile(keyFile, 'utf8');
  const jwt = `${unsigned}.${sign('RSA-SHA256', Buffer.from(unsigned), key).toString('base64url')}`;
  const installation = await github(`${repositoryPath}/installation`, jwt);

  if (!Number.isSafeInteger(installation.id) || installation.id <= 0) {
    throw new Error('GitHub did not return a valid App installation ID.');
  }

  const { token, expires_at: expiresAt } = await github(`/app/installations/${installation.id}/access_tokens`, jwt, {
    repositories: [repository.split('/')[1]],
  });

  if (typeof token !== 'string' || !token || !(Date.parse(expiresAt) > Date.now() + 50 * 60 * 1000)) {
    throw new Error('GitHub must return an installation token valid for more than 50 minutes.');
  }

  const metadata = await github(repositoryPath, token);

  if (typeof metadata.default_branch !== 'string' || !metadata.default_branch) {
    throw new Error('GitHub did not return the repository default branch.');
  }

  const manifest = await github(`${repositoryPath}/contents/package.json?ref=${encodeURIComponent(metadata.default_branch)}`, token);

  if (manifest.encoding !== 'base64' || typeof manifest.content !== 'string') {
    throw new Error('GitHub did not return base64 package.json content.');
  }

  const workspace = JSON.parse(Buffer.from(manifest.content, 'base64').toString('utf8'));
  const node = /^>=(\d+\.\d+\.\d+)(?:\s|$)/.exec(workspace.engines?.node)?.[1];
  const pnpm = /^pnpm@(\d+\.\d+\.\d+)(?:\+|$)/.exec(workspace.packageManager)?.[1];

  if (!node || !pnpm) {
    throw new Error('Root package.json must declare a minimum Node.js version and an exact pnpm packageManager version.');
  }

  return {
    token,
    repositories: [repository],
    autodiscover: false,
    constraints: { node, pnpm },
  };
}
