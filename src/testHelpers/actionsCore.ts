// Minimal stub for @actions/core used under ts-jest, which cannot resolve the
// package's ESM-only exports. Only the members exercised by the tests are kept.
export const startGroup = (_name: string): void => {};
export const endGroup = (): void => {};
