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
  coverageProvider: 'v8',
  collectCoverageFrom: [
    'src/**/*.{ts,js}',
    '!src/**/*.spec.ts',
    '!src/**/*.test.ts',
    '!src/**/*.mock.ts',
    '!src/**/*.decorator.ts',
    '!src/**/index.ts'
  ],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/lib/',
    '/dist/',
    '/examples/',
    '/scripts/'
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
