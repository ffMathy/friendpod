/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  testMatch: ['<rootDir>/test/**/*.test.ts?(x)'],
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  // The fetched model (~207 MB, gitignored) is not source; keep jest's file crawler out of it.
  modulePathIgnorePatterns: ['<rootDir>/assets/model/'],
};
