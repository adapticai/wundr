module.exports = {
  preset: '{{JEST_PRESET}}',
  testEnvironment: '{{TEST_ENVIRONMENT}}',
  roots: ['<rootDir>/{{SOURCE_DIR}}'],
  testMatch: ['**/__tests__/**/*.{{FILE_EXTENSIONS}}', '**/?(*.)+(spec|test).{{FILE_EXTENSIONS}}'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: '{{TSCONFIG_PATH}}'
    }]{{#ADDITIONAL_TRANSFORMS}},
    {{ADDITIONAL_TRANSFORMS}}{{/ADDITIONAL_TRANSFORMS}}
  },
  collectCoverageFrom: [
    '{{SOURCE_DIR}}/**/*.{{{COVERAGE_EXTENSIONS}}}',
    '!{{SOURCE_DIR}}/**/*.d.ts',
    '!{{SOURCE_DIR}}/**/*.interface.ts',
    '!{{SOURCE_DIR}}/**/*.type.ts',
    '!{{SOURCE_DIR}}/**/index.ts'{{#COVERAGE_EXCLUDES}},
    '!{{.}}'{{/COVERAGE_EXCLUDES}}
  ],
  coverageDirectory: '{{COVERAGE_DIRECTORY}}',
  coverageReporters: [{{#COVERAGE_REPORTERS}}'{{.}}'{{#unless @last}}, {{/unless}}{{/COVERAGE_REPORTERS}}],
  {{#COVERAGE_THRESHOLDS}}coverageThreshold: {
    global: {
      branches: {{BRANCHES_THRESHOLD}},
      functions: {{FUNCTIONS_THRESHOLD}},
      lines: {{LINES_THRESHOLD}},
      statements: {{STATEMENTS_THRESHOLD}}
    }
  },{{/COVERAGE_THRESHOLDS}}
  moduleNameMapper: {
    {{#PATH_MAPPINGS}}'^{{ALIAS}}/(.*)$': '<rootDir>/{{PATH}}/$1'{{#unless @last}},{{/unless}}{{/PATH_MAPPINGS}}
  },
  {{#SETUP_FILES}}setupFilesAfterEnv: [{{#SETUP_FILES}}'<rootDir>/{{.}}'{{#unless @last}}, {{/unless}}{{/SETUP_FILES}}],{{/SETUP_FILES}}
  clearMocks: {{CLEAR_MOCKS}},
  restoreMocks: {{RESTORE_MOCKS}},
  verbose: {{VERBOSE}},
  {{#MAX_WORKERS}}maxWorkers: {{MAX_WORKERS}},{{/MAX_WORKERS}}
  {{#TIMEOUT}}testTimeout: {{TIMEOUT}},{{/TIMEOUT}}
  {{#CACHE_DIRECTORY}}cacheDirectory: '{{CACHE_DIRECTORY}}',{{/CACHE_DIRECTORY}}
  {{#GLOBAL_SETUP}}globalSetup: '{{GLOBAL_SETUP}}',{{/GLOBAL_SETUP}}
  {{#GLOBAL_TEARDOWN}}globalTeardown: '{{GLOBAL_TEARDOWN}}',{{/GLOBAL_TEARDOWN}}
  {{#REPORTERS}}reporters: [{{#REPORTERS}}'{{.}}'{{#unless @last}}, {{/unless}}{{/REPORTERS}}]{{/REPORTERS}}
};