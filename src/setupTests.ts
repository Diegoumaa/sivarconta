import * as domMatchers from '@testing-library/jest-dom/matchers';
import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers';
import { beforeEach, expect } from 'vitest';

// Vitest 5 no longer reads the global Jest matcher declarations.
declare module 'vitest' {
  interface Matchers<R extends void | Promise<void> = void | Promise<void>, T = unknown>
    extends TestingLibraryMatchers<T, R> {}
}

expect.extend(domMatchers);
beforeEach(() => window.history.replaceState(null, '', '/'));
