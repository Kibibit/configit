# Technical Context: @kibibit/configit
*Version: 1.0*
*Created: 2025-10-05*
*Last Updated: 2025-10-05*

## Technology Stack

### Core Language & Runtime
- **TypeScript** (v5.0.4): Primary development language providing type safety and modern JavaScript features
- **Node.js** (v18+): Runtime environment for the library
- **Target**: CommonJS modules (`lib/index.js` as main entry)

### Core Dependencies

#### Configuration Management
- **nconf** (v0.12.0): Multi-source hierarchical configuration with provider system
- **nconf-yaml** (v1.0.2): YAML format support for nconf
- **@kibibit/nconf-jsonc** (v1.0.0): JSON with Comments format support
- **@kibibit/nconf-hjson** (v1.0.0): Human JSON format support
- **yaml** (v2.2.2): YAML parsing and stringification
- **hjson** (v3.2.2): Human-readable JSON variant

#### Validation & Schema
- **class-validator** (v0.14.0): Decorator-based validation for TypeScript classes
- **class-transformer** (v0.5.1): Plain object to class instance transformation
- **class-validator-jsonschema** (v5.0.0): Generate JSON schemas from class-validator decorators

#### Utilities
- **lodash** (v4.17.21): Utility library for data manipulation
- **colors** (v1.4.0): Terminal output colorization
- **find-root** (v1.1.0): Find project root by locating package.json
- **fs-extra** (v11.1.1): Enhanced file system operations
- **@kibibit/kb-error** (v1.0.3): Custom error handling

### Development Dependencies

#### Testing
- **jest** (v29.5.0): Testing framework
- **ts-jest** (v29.1.0): TypeScript preprocessor for Jest
- **jest-mock-process** (v2.0.0): Mock process.env and process functions
- **jest-stare** (v2.5.0): HTML test report generation
- **@types/jest** (v29.5.1): TypeScript definitions for Jest

#### Code Quality
- **eslint** (v8.39.0): JavaScript/TypeScript linting
- **@typescript-eslint/eslint-plugin** (v5.59.1): TypeScript-specific ESLint rules
- **@typescript-eslint/parser** (v5.59.1): TypeScript parser for ESLint
- **eslint-plugin-import** (v2.27.5): ES6 import/export linting
- **eslint-plugin-simple-import-sort** (v10.0.0): Auto-sort imports
- **eslint-plugin-unused-imports** (v2.0.0): Remove unused imports

#### Git & Release Management
- **husky** (v8.0.3): Git hooks management
- **commitlint** (v17.6.1): Enforce conventional commit messages
- **@commitlint/config-angular** (v17.6.1): Angular commit message convention
- **commitizen** (v4.3.0): Interactive commit message builder
- **cz-conventional-changelog-emoji** (v0.1.0): Commitizen adapter with emojis

#### Semantic Release
- **semantic-release** (v21.0.2): Automated version management and package publishing
- **@semantic-release/changelog**: Generate changelog
- **@semantic-release/commit-analyzer**: Analyze commits for version bumps
- **@semantic-release/git**: Commit release assets
- **@semantic-release/github**: GitHub release integration
- **@semantic-release/npm**: NPM publishing
- **@semantic-release/release-notes-generator**: Generate release notes

#### Tooling
- **typescript** (v5.0.4): TypeScript compiler
- **ts-node** (v10.9.1): TypeScript execution for Node.js
- **rimraf** (v5.0.0): Cross-platform rm -rf
- **cross-env** (v7.0.3): Cross-platform environment variables
- **all-contributors-cli** (v6.25.0): Recognize project contributors

## Development Environment Setup

### Prerequisites
- Node.js 18+ (LTS recommended)
- npm 8+ or compatible package manager

### Installation
```bash
# Clone repository
git clone https://github.com/Kibibit/configit.git
cd configit

# Install dependencies
npm install

# Build library
npm run build
```

### Project Structure
```
configit/
├── src/                      # TypeScript source files
│   ├── config.service.ts     # Main ConfigService class
│   ├── config.model.ts       # BaseConfig class and decorators
│   ├── config.errors.ts      # Custom error classes
│   ├── json-schema.validator.ts  # Schema decorators
│   ├── environment.service.ts    # Environment management
│   └── index.ts              # Public API exports
├── lib/                      # Compiled JavaScript output
├── examples/                 # Usage examples
│   ├── simple-node/          # Basic usage
│   ├── extend-config/        # Extended ConfigService
│   ├── yaml-config/          # YAML configuration
│   ├── jsonc-config/         # JSONC configuration
│   ├── shared-configs/       # Shared config example
│   ├── uppercase-booleans/   # Boolean conversion
│   └── convert-config-file/  # Format conversion
├── .cursor/                  # Cursor IDE configuration
│   └── rules/                # CursorRIPER framework
├── memory-bank/              # AI assistant memory files
└── package.json              # Package metadata
```

## Technical Constraints

### Node.js Only
- Library is designed for Node.js runtime only
- Not suitable for browser environments (uses `fs`, `process`, `nconf`)

### TypeScript Required
- Best experience with TypeScript projects
- JavaScript projects can use it but lose type safety benefits

### Decorator Support
- Requires TypeScript `experimentalDecorators: true`
- Uses class-validator decorators for validation

### Forced Singleton
- Single ConfigService instance per process (by design)
- Can be bypassed by passing config to constructor for testing

### File System Access
- Requires file system access to read/write configuration files
- Searches directory tree for configuration files

## Build and Deployment

### Build Process
```bash
# Clean previous build
npm run prebuild  # Runs rimraf lib

# Compile TypeScript
npm run build     # Runs tsc
```

### Output
- Compiled to `lib/` directory
- Includes `.js` files and `.d.ts` type definitions
- Package publishes both `src/` and `lib/` folders

### Package Publishing
- Automated via `semantic-release`
- Triggered on push to `main` (stable) or `beta` branches
- Follows semantic versioning
- Publishes to npm registry with public access

### Release Channels
- **main**: Stable releases (e.g., `1.0.0`)
- **beta**: Pre-release versions (e.g., `1.0.0-beta.26`)

## Testing Approach

### Unit Testing
- **Framework**: Jest with ts-jest
- **Coverage**: Enabled via `npm run test:cov`
- **Watch Mode**: `npm run test:watch`
- **Snapshots**: Used for validation error messages and schemas

### Test Files
- `src/config.service.spec.ts`: ConfigService tests
- `src/config.model.spec.ts`: BaseConfig tests
- `src/config.errors.spec.ts`: Error handling tests
- `src/__snapshots__/`: Jest snapshots

### Integration Testing
- Example folders serve as integration tests
- Each example can be run with `npm run test:<example-name>`
- Tests:
  - `test:simple` - Basic usage
  - `test:extend` - Extended service
  - `test:yaml` - YAML configuration
  - `test:shared-configs` - Shared configs
  - `test:uppercase-booleans` - Boolean conversion

### Debug Configuration
```bash
# Debug Jest tests
npm run test:debug
```

### CI/CD Testing
- GitHub Actions workflows:
  - `build.yml`: Build verification
  - `tests.yml`: Test execution
- Code coverage reported to Codecov

## Code Quality Standards

### Linting
```bash
# Check for issues
npm run lint

# Auto-fix issues
npm run lint:fix
```

### ESLint Configuration
- TypeScript-specific rules
- Import sorting enforcement
- Unused import detection
- Custom rules in `.eslintrc.js`

### Commit Standards
- Conventional Commits enforced via commitlint
- Angular commit message convention
- Husky pre-commit hooks
- Commitizen for interactive commits

### Code Style
- TypeScript strict mode
- ESLint formatting rules
- Consistent import ordering
- Explicit return types preferred

## Development Workflow

### Adding New Features
1. Create feature branch
2. Implement changes with tests
3. Run `npm run lint:fix`
4. Run `npm test`
5. Commit using conventional commits
6. Create PR to `beta` or `main` branch

### Release Process
1. Merge PR to `beta` or `main`
2. semantic-release analyzes commits
3. Determines version bump (major/minor/patch)
4. Updates CHANGELOG.md
5. Creates GitHub release
6. Publishes to npm
7. Commits version changes

### Breaking Changes
- Use `BREAKING CHANGE:` in commit message footer
- Triggers major version bump
- Documented in release notes

---

*This document describes the technologies used in the project and how they're configured.*
