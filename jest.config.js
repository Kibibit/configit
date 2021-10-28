module.exports = {
  testEnvironment: 'node',
  roots: [
    '<rootDir>/src'
  ],
  setupFilesAfterEnv: [
    './jest.setup.ts'
  ],
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/?(*.)+(spec|test).+(ts|tsx|js)'
  ],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest'
  },
  collectCoverageFrom: [
    '**/*.(t|j)s',
    '!**/*.decorator.ts',
    '!**/*.mock.ts',
    '!**/index.ts',
    '!**/dev-tools/**/*.ts'
  ],
  reporters: [
    'default',
    [
      'jest-stare',
      {
        'resultDir': './test-results',
        'reportTitle': 'jest-stare!',
        'additionalResultsProcessors': [
          'jest-junit'
        ],
        'coverageLink': './coverage/lcov-report/index.html'
      }
    ]
  ],
  coverageReporters: [
    'json',
    'lcov',
    'text',
    'clover',
    'html'
  ],
  coverageDirectory: './test-results/coverage'
};
