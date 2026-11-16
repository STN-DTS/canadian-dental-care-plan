import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/** Written by the server that error-correlation.config.ts starts. */
const serverLogPath = resolve(import.meta.dirname, '../../test-results/error-correlation-server.log');

/**
 * Returns the `handleError` Winston record for a correlation ID, or undefined if it is not written yet.
 * Use with `expect.poll`, because the server writes the record asynchronously.
 */
export async function findHandleErrorRecord(correlationId: string) {
  // Only newline-terminated records are complete; the server may still be writing the last line.
  const lines = (await readFile(serverLogPath, 'utf8')).split('\n').slice(0, -1);
  return lines
    .filter((line) => line.startsWith('{'))
    .map((line) => JSON.parse(line) as Record<string, unknown>)
    .find((record) => record.label === 'entry.server/handleError' && record.correlationId === correlationId);
}
