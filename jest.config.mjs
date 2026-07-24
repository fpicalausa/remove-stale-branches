/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
export default {
  preset: "ts-jest",
  testEnvironment: "node",
  moduleNameMapper: {
    "^@actions/core$": "<rootDir>/src/testHelpers/actionsCore.ts",
  },
};
