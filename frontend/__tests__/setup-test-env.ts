import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';

import { afterEach, vi } from 'vitest';

vi.mock(import('react-i18next'));
vi.mock(import('~/.server/logging'));

afterEach(() => {
  cleanup();
});
