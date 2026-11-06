import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

import * as attributes from '~/.server/logging/log-attributes';

test('custom attribute constants have unique wire names matching their export names', () => {
  const entries = Object.entries(attributes);

  expect(entries).toHaveLength(56);
  expect(new Set(Object.values(attributes)).size).toBe(entries.length);

  for (const [name, value] of entries) {
    expect(value).toMatch(/^cdcp\.[a-z][a-z0-9_.]*$/);
    expect(name).toBe(`ATTR_${value.toUpperCase().replaceAll('.', '_')}`);
  }
});

test('application callers use the registry rather than inline custom attribute keys', () => {
  const appDirectory = fileURLToPath(new URL('../../../app/', import.meta.url));
  const inlineKeys: string[] = [];

  for (const file of readdirSync(appDirectory, { recursive: true, encoding: 'utf8' })) {
    if (!/\.tsx?$/.test(file)) {
      continue;
    }

    const source = readFileSync(path.join(appDirectory, file), 'utf8');

    if (/['"]cdcp\.[^'"]+['"]\s*:/.test(source)) {
      inlineKeys.push(file);
    }
  }

  expect(inlineKeys).toEqual([]);
});
