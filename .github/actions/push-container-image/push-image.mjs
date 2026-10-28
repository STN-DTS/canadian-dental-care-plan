import { spawn } from 'node:child_process';
import { appendFileSync } from 'node:fs';

async function pushImage(reference, applicationName) {
  console.log(`Pushing container image: ${reference}`);
  const digest = await new Promise((resolve, reject) => {
    const docker = spawn('docker', ['push', reference], { stdio: ['ignore', 'pipe', 'pipe'] });
    let imageDigest;

    for (const stream of [docker.stdout, docker.stderr]) {
      let pending = '';

      const inspect = (line) => {
        imageDigest ??= line.match(/(?:^|\s)digest:\s+(sha256:\S+)/)?.[1];
      };

      stream.setEncoding('utf8');
      stream.on('data', (chunk) => {
        process.stdout.write(chunk);
        const lines = (pending + chunk).split(/[\r\n]/);
        pending = lines.pop();

        for (const line of lines) {
          inspect(line);
        }
      });
      stream.on('end', () => inspect(pending));
    }

    docker.once('error', reject);
    docker.once('close', (code) => {
      if (code !== 0) {
        reject(Object.assign(new Error(`Docker push failed for ${reference}`), { exitCode: code ?? 1 }));
      } else {
        resolve(imageDigest);
      }
    });
  });

  const tag = reference.slice(reference.lastIndexOf(':') + 1);
  const source = `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/commit/${process.env.GITHUB_SHA}`;
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `| ${applicationName} | \`${tag}\` | \`${reference}\` | [\`${process.env.GITHUB_SHA.slice(0, 8)}\`](${source}) |\n`);
  console.log(`\nDocker push completed for ${reference}.`);
  return digest;
}

async function main() {
  const imageRef = process.env['INPUT_IMAGE-REF'];
  const applicationName = process.env['INPUT_APPLICATION-NAME'] ?? 'CDCP frontend';
  const additionalImageRefs = process.env['INPUT_ADDITIONAL-IMAGE-REFS'] ?? '';

  if (!imageRef) {
    throw new Error('image-ref is required');
  }

  appendFileSync(process.env.GITHUB_STEP_SUMMARY, '## Published container tags\n\n| Application | Tag | Image | Source commit |\n| --- | --- | --- | --- |\n');

  const digest = await pushImage(imageRef, applicationName);
  await additionalImageRefs.split(/\r?\n/).reduce(async (previous, reference) => {
    await previous;

    if (reference) {
      await pushImage(reference, applicationName);
    }
  }, Promise.resolve());

  if (!/^sha256:[a-f0-9]{64}$/.test(digest ?? '')) {
    throw new Error('Unable to determine the pushed image digest.');
  }

  appendFileSync(process.env.GITHUB_OUTPUT, `image-digest=${digest}\n`);
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `\nImage digest: \`${digest}\`\n`);
  console.log(`Container publication completed. Primary image digest: ${digest}`);
}

try {
  await main();
} catch (error) {
  console.error(error.message);
  process.exitCode = error.exitCode ?? 1;
}
