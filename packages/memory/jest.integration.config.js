module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/test/**/*.integration.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  testTimeout: 30000,
};

