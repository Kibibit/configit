# Implementation Plan: Configuration Management Enhancements
*Version: 1.0*
*Created: 2025-10-05*
*Last Updated: 2025-10-05*
*Status: READY TO START*

## Overview
Implementation of three major configuration enhancements for @kibibit/configit:
1. **Source Restrictions** - Restrict config properties to env vars only, files only, or both
2. **Custom File Naming** - Override default `.env.{env}.{name}.{ext}` pattern
3. **Backward Compatibility** - All existing configs work without modification

## Design Decisions
- **Source Restriction API**: Dual approach - decorator metadata + helper decorators
- **File Naming API**: Decorator options + method override support
- **Compatibility Strategy**: Smart defaults - all features optional and additive

## Implementation Phases

### 🔷 Phase 1: Foundation - Type System & Decorator Infrastructure
**Goal**: Establish type system and decorator infrastructure without behavioral changes

---

#### ✅ Step 1: Add TypeScript types and enums for source restrictions
**Status**: ✅ COMPLETED
**Branch**: N/A
**Commit**: READY FOR REVIEW

**Files to Create**:
- `src/config.types.ts` - New file for shared types

**Files to Modify**:
- `src/json-schema.validator.ts` - Import and use new types

**Implementation**:
```typescript
// config.types.ts
export enum EConfigSource {
  env = 'env',
  file = 'file',
  both = 'both'
}

export interface IConfigVariableOptions {
  exclude?: boolean;
  source?: EConfigSource;
}

export interface IConfigurationOptions {
  fileName?: string;
  filePattern?: string;
}
```

**Tests to Add**:
- `src/config.types.spec.ts` - Verify enum values and interfaces exist

**Commit Message**:
```
feat(types): add configuration source restriction types

- Add EConfigSource enum (env, file, both)
- Add IConfigVariableOptions interface with source property
- Add IConfigurationOptions interface for decorator options
- Create config.types.ts for shared type definitions
- Add unit tests for type definitions

BREAKING CHANGE: None (types are additive)
```

**Verification**:
- ✅ Build passes
- ✅ All existing tests pass (39 total tests)
- ✅ New tests pass (16 new tests for config.types)
- ✅ No linter errors

**Notes**: 
- Discovered existing `IConfigVariableOptions` in `json-schema.validator.ts`
- Extended existing interface instead of creating duplicate
- Kept `EConfigSource` enum and `IConfigurationOptions` in config.types.ts
- All 39 tests passing, 40 snapshots passing

---

#### ⬜ Step 2: Extend @ConfigVariable decorator to accept source metadata
**Status**: NOT STARTED
**Branch**: N/A
**Commit**: N/A
**Dependencies**: Step 1

**Files to Modify**:
- `src/json-schema.validator.ts` - Update ConfigVariable decorator
- `src/config.model.spec.ts` - Add tests for new decorator signature

**Implementation**:
```typescript
export function ConfigVariable(
  description: string | string[],
  options?: IConfigVariableOptions
): PropertyDecorator {
  return (target: any, propertyKey: string | symbol) => {
    // Store description (existing behavior)
    const desc = Array.isArray(description) ? description.join('') : description;
    Reflect.defineMetadata('jsonSchema', { description: desc }, target, propertyKey);
    
    // Store source restriction (new behavior)
    const source = options?.source || EConfigSource.both;
    Reflect.defineMetadata('configSource', source, target, propertyKey);
    
    // Store exclude option (existing behavior)
    if (options?.exclude) {
      Reflect.defineMetadata('exclude', true, target, propertyKey);
    }
  };
}
```

**Tests to Add**:
- Test decorator with source: 'env'
- Test decorator with source: 'file'
- Test decorator with source: 'both'
- Test decorator with no source (defaults to 'both')
- Test backward compatibility (string description still works)
- Test backward compatibility (array description still works)
- Test metadata retrieval

**Commit Message**:
```
feat(decorators): extend ConfigVariable to accept source restrictions

- Update ConfigVariable decorator to accept IConfigVariableOptions
- Add source metadata storage using Reflect.metadata
- Maintain backward compatibility with string/array description
- Default source to 'both' when not specified
- Add comprehensive tests for decorator metadata

BREAKING CHANGE: None (backward compatible signature)
```

**Verification**:
- ✅ Build passes
- ✅ All existing tests pass
- ✅ New tests pass
- ✅ Backward compatibility verified

**Notes**: N/A

---

#### ⬜ Step 3: Create @EnvOnly and @FileOnly helper decorators
**Status**: NOT STARTED
**Branch**: N/A
**Commit**: N/A
**Dependencies**: Step 2

**Files to Modify**:
- `src/json-schema.validator.ts` - Add helper decorators
- `src/index.ts` - Export new decorators
- `src/config.model.spec.ts` - Add tests

**Implementation**:
```typescript
export function EnvOnly(): PropertyDecorator {
  return (target: any, propertyKey: string | symbol) => {
    Reflect.defineMetadata('configSource', EConfigSource.env, target, propertyKey);
  };
}

export function FileOnly(): PropertyDecorator {
  return (target: any, propertyKey: string | symbol) => {
    Reflect.defineMetadata('configSource', EConfigSource.file, target, propertyKey);
  };
}
```

**Tests to Add**:
- Test @EnvOnly sets correct metadata
- Test @FileOnly sets correct metadata
- Test decorators work alongside @ConfigVariable
- Test metadata retrieval
- Test decorator precedence if multiple source decorators used

**Commit Message**:
```
feat(decorators): add EnvOnly and FileOnly helper decorators

- Add @EnvOnly() decorator for environment-only properties
- Add @FileOnly() decorator for file-only properties
- Export new decorators from index
- Add tests for helper decorators
- Document decorator stacking behavior

BREAKING CHANGE: None (new optional decorators)
```

**Verification**:
- ✅ Build passes
- ✅ All existing tests pass
- ✅ New tests pass
- ✅ Decorators exported and importable

**Notes**: N/A

---

### 🔷 Phase 2: Custom File Naming
**Goal**: Enable custom configuration file naming patterns

---

#### ⬜ Step 4: Extend @Configuration decorator to accept fileName option
**Status**: NOT STARTED
**Branch**: N/A
**Commit**: N/A
**Dependencies**: Step 1

**Files to Modify**:
- `src/json-schema.validator.ts` - Update Configuration decorator
- `src/config.model.spec.ts` - Add tests

**Implementation**:
```typescript
export function Configuration(options?: IConfigurationOptions): ClassDecorator {
  return (target: Function) => {
    Reflect.defineMetadata('configFileName', options?.fileName, target);
    Reflect.defineMetadata('isConfiguration', true, target);
  };
}
```

**Tests to Add**:
- Test decorator with fileName option
- Test decorator with no options (backward compatibility)
- Test metadata storage and retrieval
- Test multiple configs with different fileNames

**Commit Message**:
```
feat(decorators): add fileName option to Configuration decorator

- Extend @Configuration to accept IConfigurationOptions
- Add fileName option for custom config file naming
- Store fileName in class metadata
- Maintain backward compatibility with no-option usage
- Add tests for custom fileName metadata

BREAKING CHANGE: None (options are optional)
```

**Verification**:
- ✅ Build passes
- ✅ All existing tests pass
- ✅ New tests pass
- ✅ Backward compatibility verified

**Notes**: N/A

---

#### ⬜ Step 5: Update BaseConfig.getFileName to use decorator metadata
**Status**: NOT STARTED
**Branch**: N/A
**Commit**: N/A
**Dependencies**: Step 4

**Files to Modify**:
- `src/config.model.ts` - Update getFileName method
- `src/config.model.spec.ts` - Add/update tests

**Implementation**:
```typescript
getFileName(ext: string, isSharedConfig = false) {
  // Check for decorator metadata first
  const customFileName = Reflect.getMetadata('configFileName', this.constructor);
  
  if (customFileName) {
    // Custom fileName ignores shared config and environment prefixes
    return `${customFileName}.${ext}`;
  }
  
  // Fall back to existing logic for backward compatibility
  return [
    '.env.',
    getEnvironment(), '.',
    isSharedConfig ? '_shared_.' : '',
    kebabCase(this.name), '.',
    ext
  ].join('');
}
```

**Tests to Add**:
- Test custom fileName from @Configuration decorator
- Test default behavior when no custom fileName
- Test with various file extensions (json, yaml, jsonc)
- Test shared config naming (should ignore custom name or apply differently?)
- Test getSchemaFileName still works correctly

**Commit Message**:
```
feat(config): implement custom fileName support in BaseConfig

- Update getFileName to check for decorator metadata
- Use custom fileName when @Configuration({ fileName }) is set
- Fall back to default .env.{env}.{name}.{ext} pattern
- Maintain backward compatibility for existing configs
- Add comprehensive tests for custom naming

BREAKING CHANGE: None (default behavior unchanged)
```

**Verification**:
- ✅ Build passes
- ✅ All existing tests pass
- ✅ New tests pass
- ✅ Manual test: Create config with custom fileName and verify file is named correctly

**Notes**: Need to decide if shared configs should respect custom fileName

---

### 🔷 Phase 3: Source Restriction Implementation
**Goal**: Enforce source restrictions with validation and helpful errors

---

#### ⬜ Step 6: Implement source tracking in ConfigService
**Status**: NOT STARTED
**Branch**: N/A
**Commit**: N/A
**Dependencies**: Steps 1-3

**Files to Modify**:
- `src/config.service.ts` - Add source tracking to ConfigService
- `src/config.service.spec.ts` - Add tests

**Implementation**:
```typescript
export class ConfigService<T extends BaseConfig> {
  // Add new property
  private configSources: {
    argv: any;
    env: any;
    file: any;
  } = { argv: {}, env: {}, file: {} };

  private initializeNconf() {
    nconf.argv({ parseValues: true });
    nconf.env({ /* ... */ });
    nconf.file('environment', { /* ... */ });
    
    // After nconf initialization, store sources
    this.configSources = {
      argv: { ...nconf.stores.argv?.store },
      env: { ...nconf.stores.env?.store },
      file: { ...(nconf.stores.environment?.store || {}) }
    };
  }
}
```

**Tests to Add**:
- Test configSources property exists
- Test argv source is captured
- Test env source is captured
- Test file source is captured
- Test with missing config file (file source empty)

**Commit Message**:
```
feat(service): add configuration source tracking

- Store original config sources (argv, env, file) for validation
- Add configSources property to ConfigService
- Prepare infrastructure for source restriction validation
- Add tests for source tracking
- No behavioral changes (tracking only)

BREAKING CHANGE: None (internal implementation)
```

**Verification**:
- ✅ Build passes
- ✅ All existing tests pass
- ✅ New tests pass

**Notes**: N/A

---

#### ⬜ Step 7: Add source restriction validation phase
**Status**: NOT STARTED
**Branch**: N/A
**Commit**: N/A
**Dependencies**: Step 6

**Files to Modify**:
- `src/config.service.ts` - Add validateSourceRestrictions method
- `src/config.service.spec.ts` - Add validation tests

**Implementation**:
```typescript
private validateSourceRestrictions(configInstance: T): string[] {
  const violations: string[] = [];
  const properties = Object.keys(configInstance);
  
  for (const prop of properties) {
    const sourceRestriction = Reflect.getMetadata(
      'configSource',
      configInstance,
      prop
    );
    
    // Skip if no restriction or explicitly set to 'both'
    if (!sourceRestriction || sourceRestriction === EConfigSource.both) {
      continue;
    }
    
    // Check where the value actually came from
    const fromArgv = prop in this.configSources.argv;
    const fromEnv = prop in this.configSources.env;
    const fromFile = prop in this.configSources.file;
    
    // Env restriction: value must come from env or argv (not file)
    if (sourceRestriction === EConfigSource.env) {
      if (fromFile && !fromEnv && !fromArgv) {
        violations.push(`${prop} (expected: env, actual: file)`);
      }
    }
    
    // File restriction: value must come from file only
    if (sourceRestriction === EConfigSource.file) {
      if ((fromEnv || fromArgv) && !fromFile) {
        const actualSource = fromArgv ? 'argv' : 'env';
        violations.push(`${prop} (expected: file, actual: ${actualSource})`);
      }
    }
  }
  
  return violations;
}

// Call in constructor after config creation
const violations = this.validateSourceRestrictions(this.config);
if (violations.length > 0) {
  // Throw error (Step 8 will add proper error class)
  throw new Error(`Source violations: ${violations.join(', ')}`);
}
```

**Tests to Add**:
- Test @EnvOnly property passes when from env
- Test @EnvOnly property fails when from file
- Test @FileOnly property passes when from file
- Test @FileOnly property fails when from env
- Test no restriction allows any source
- Test validation called during initialization
- Test multiple violations reported together

**Commit Message**:
```
feat(validation): implement source restriction validation

- Add validateSourceRestrictions method to ConfigService
- Validate properties match their source restrictions
- Check @EnvOnly properties come from environment only
- Check @FileOnly properties come from file only
- Add tests for source restriction violations
- Call validation after config loading

BREAKING CHANGE: Configs with source restrictions will now throw errors if violated
```

**Verification**:
- ✅ Build passes
- ✅ All existing tests pass (no configs use restrictions yet)
- ✅ New tests pass
- ✅ Validation properly rejects violations

**Notes**: Using temporary error class until Step 8

---

#### ⬜ Step 8: Add error messages for source violations
**Status**: NOT STARTED
**Branch**: N/A
**Commit**: N/A
**Dependencies**: Step 7

**Files to Modify**:
- `src/config.errors.ts` - Add ConfigSourceViolationError class
- `src/config.errors.spec.ts` - Add tests
- `src/config.service.ts` - Use new error class
- `src/index.ts` - Export new error class

**Implementation**:
```typescript
export class ConfigSourceViolationError extends Error {
  constructor(violations: Array<{ property: string; expected: string; actual: string }>) {
    const violationMessages = violations.map(v => 
      [
        `  • "${v.property}"`,
        `    Expected: ${v.expected}`,
        `    Actual: ${v.actual}`,
        v.actual === 'file'
          ? `    Fix: Remove "${v.property}" from your config file`
          : `    Fix: Remove the ${v.actual === 'argv' ? 'CLI argument' : 'environment variable'}`
      ].join('\n')
    ).join('\n\n');
    
    const message = [
      '╔════════════════════════════════════════╗',
      '║  Configuration Source Violations      ║',
      '╚════════════════════════════════════════╝',
      '',
      `Found ${violations.length} source restriction violation(s):`,
      '',
      violationMessages,
      '',
      'Source restrictions ensure sensitive data (like secrets) come from',
      'secure sources and defaults stay consistent across environments.'
    ].join('\n');
    
    super(message);
    this.name = 'ConfigSourceViolationError';
  }
}
```

**Tests to Add**:
- Test error message format
- Test error name
- Test single violation message
- Test multiple violations message
- Test helpful fix suggestions
- Snapshot test for error output

**Commit Message**:
```
feat(errors): add ConfigSourceViolationError with helpful messages

- Create ConfigSourceViolationError class
- Add descriptive error messages for source violations
- Include remediation steps in error message
- Add visual formatting for better readability
- Update ConfigService to use new error class
- Add tests and snapshots for error formatting
- Export error class from index

BREAKING CHANGE: None (improves existing error from Step 7)
```

**Verification**:
- ✅ Build passes
- ✅ All existing tests pass
- ✅ New tests pass
- ✅ Error messages are helpful and actionable
- ✅ Snapshot tests capture error format

**Notes**: N/A

---

### 🔷 Phase 4: Documentation & Examples
**Goal**: Document features and provide working examples

---

#### ⬜ Step 9: Create example project demonstrating new features
**Status**: NOT STARTED
**Branch**: N/A
**Commit**: N/A
**Dependencies**: Steps 1-8

**Files to Create**:
- `examples/source-restrictions/package.json`
- `examples/source-restrictions/tsconfig.json`
- `examples/source-restrictions/src/config.model.ts`
- `examples/source-restrictions/src/index.ts`
- `examples/source-restrictions/app-config.json`
- `examples/source-restrictions/README.md`
- `examples/source-restrictions/.env.example`

**Implementation**:
```typescript
// config.model.ts
@Configuration({ fileName: 'app-config' })
export class SecureAppConfig extends BaseConfig {
  @ConfigVariable('Database password - MUST be from environment')
  @EnvOnly()
  @IsString()
  DB_PASSWORD: string;
  
  @ConfigVariable('API secret key - MUST be from environment')
  @EnvOnly()
  @IsString()
  API_SECRET: string;
  
  @ConfigVariable('Default items per page - committed config')
  @FileOnly()
  @IsNumber()
  DEFAULT_PAGE_SIZE: number = 20;
  
  @ConfigVariable('Application name - committed config')
  @FileOnly()
  @IsString()
  APP_NAME: string = 'MyApp';
  
  @ConfigVariable('Server port - can override in any environment', { source: 'both' })
  @IsNumber()
  PORT: number = 3000;
  
  @ConfigVariable('Enable debug mode - flexible')
  @IsBoolean()
  DEBUG: boolean = false;
}

// index.ts - demonstrates usage
import { ConfigService } from '@kibibit/configit';
import { SecureAppConfig } from './config.model';

const configService = new ConfigService(SecureAppConfig);

console.log('Configuration loaded successfully!');
console.log('Port:', configService.config.PORT);
console.log('Page Size:', configService.config.DEFAULT_PAGE_SIZE);
console.log('App Name:', configService.config.APP_NAME);
// DB_PASSWORD not logged for security
```

**README.md Content**:
- Explain the example
- Show how to run it
- Demonstrate what happens with violations
- Show both decorator approaches

**Tests to Add**:
- Example should compile
- Example should run successfully with correct config
- Example should fail with source violations

**Commit Message**:
```
docs(examples): add source-restrictions example project

- Create new example demonstrating source restrictions
- Show @EnvOnly, @FileOnly, and @ConfigVariable({ source }) usage
- Demonstrate custom fileName configuration
- Include sample config file and .env.example
- Add comprehensive README explaining the example
- Show both decorator approaches (metadata vs helpers)
- Demonstrate error scenarios

BREAKING CHANGE: None (documentation only)
```

**Verification**:
- ✅ Build passes
- ✅ Example compiles without errors
- ✅ Example runs successfully
- ✅ Can manually test violations work
- ✅ README is clear and helpful

**Notes**: N/A

---

#### ⬜ Step 10: Update README and documentation
**Status**: NOT STARTED
**Branch**: N/A
**Commit**: N/A
**Dependencies**: Step 9

**Files to Modify**:
- `README.md` - Add features section
- `src/config.model.ts` - Add JSDoc comments
- `src/json-schema.validator.ts` - Add JSDoc comments
- `CHANGELOG.md` - Add feature entries

**Changes to README.md**:
```markdown
## Features
- ✨ **Source Restrictions** - Enforce that sensitive configs come from env vars only
- ✨ **Custom File Naming** - Override the default `.env.{env}.{name}.{ext}` pattern
- Supports JSON\YAML files\env variables\cli flags as configuration inputs
- ... (existing features)

## Source Restrictions

Ensure configuration properties come from the right sources:

### Using Helper Decorators
\`\`\`typescript
@Configuration()
export class SecureConfig extends BaseConfig {
  @EnvOnly()  // Must come from environment
  @IsString()
  DATABASE_PASSWORD: string;
  
  @FileOnly()  // Must come from config file
  @IsNumber()
  DEFAULT_PAGE_SIZE: number = 20;
}
\`\`\`

### Using Decorator Metadata
\`\`\`typescript
@ConfigVariable('Secret', { source: 'env' })
@IsString()
API_KEY: string;
\`\`\`

## Custom File Naming
\`\`\`typescript
@Configuration({ fileName: 'app-config' })
export class AppConfig extends BaseConfig {
  // Results in: app-config.json instead of .env.development.app.json
}
\`\`\`

Or override programmatically:
\`\`\`typescript
getFileName(ext: string) {
  return \`my-config.\${ext}\`;
}
\`\`\`
```

**JSDoc to Add**:
```typescript
/**
 * Restricts this configuration property to environment variables only.
 * Attempting to set this value from a config file will throw an error.
 * 
 * Use this for sensitive data like passwords, API keys, and secrets.
 * 
 * @example
 * ```typescript
 * @EnvOnly()
 * @IsString()
 * DATABASE_PASSWORD: string;
 * ```
 */
export function EnvOnly(): PropertyDecorator
```

**Commit Message**:
```
docs(readme): document source restrictions and custom naming

- Add comprehensive documentation for source restrictions
- Document @EnvOnly and @FileOnly decorators
- Document @ConfigVariable source option
- Explain custom fileName configuration
- Add usage examples to README
- Update feature list with new capabilities
- Add JSDoc comments to all new APIs
- Update CHANGELOG with new features

BREAKING CHANGE: None (documentation only)
```

**Verification**:
- ✅ Documentation is clear and comprehensive
- ✅ All examples are accurate
- ✅ JSDoc comments are helpful
- ✅ Links work correctly

**Notes**: N/A

---

## Progress Tracking

### Current Status
- **Current Step**: Step 1 completed, ready for review
- **Phase**: 1 - Foundation
- **Last Completed**: Step 1 - TypeScript types and enums
- **Next Up**: Step 2 - Extend @ConfigVariable decorator

### Completed Steps
- ✅ Step 1: TypeScript types and enums (2025-10-05)

### Blocked/Issues
None

### Deviations from Plan
None

---

## Testing Strategy

### Unit Tests
- Each step includes specific unit tests
- Tests must pass before commit is ready for review
- All existing tests must continue passing

### Integration Tests
- Step 9 provides full integration testing
- Manual verification at Steps 5 and 9

### Regression Testing
- Run full test suite before each commit
- Verify existing examples still work

---

## Rollback Strategy
Each commit is atomic and can be reverted individually:
- Steps 1-3: Can be reverted without affecting anything (no usage yet)
- Steps 4-5: Can be reverted independently of source restrictions
- Steps 6-8: Can be reverted as a group if needed
- Steps 9-10: Documentation only, safe to revert

---

## Review Checklist
Before marking step as complete:
- [ ] Code implemented as specified
- [ ] Unit tests written and passing
- [ ] All existing tests still passing
- [ ] Build passes without errors or warnings
- [ ] Linter passes
- [ ] Manual verification (if applicable)
- [ ] Commit message follows Angular conventions
- [ ] Ready for code review

---

## Notes & Learnings
*(To be updated as we implement)*

### Design Decisions Made During Implementation
None yet

### Challenges Encountered
None yet

### Improvements for Future Features
None yet

---

*This plan will be updated after each step completion to reflect actual implementation details and any necessary adjustments.*
