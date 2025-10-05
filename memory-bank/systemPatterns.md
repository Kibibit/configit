# System Patterns: @kibibit/configit
*Version: 1.0*
*Created: 2025-10-05*
*Last Updated: 2025-10-05*

## Architecture Overview

`@kibibit/configit` implements a **declarative configuration management system** using TypeScript decorators and class-based schemas. The architecture follows a **forced singleton pattern** with **multi-source hierarchical configuration** and **runtime validation**.

The system acts as a configuration adapter layer between various configuration sources (CLI, environment, files) and the application, ensuring type safety and validation before the configuration is used.

```
┌─────────────────────────────────────────────────────┐
│              Configuration Sources                  │
├──────────────┬──────────────┬──────────────────────┤
│  CLI Args    │  Env Vars    │  Config Files        │
│  (argv)      │  (process)   │  (JSON/YAML/etc)     │
└──────┬───────┴──────┬───────┴──────────┬───────────┘
       │              │                  │
       └──────────────┼──────────────────┘
                      │
                 ┌────▼─────┐
                 │  nconf   │  (Configuration Provider)
                 └────┬─────┘
                      │
              ┌───────▼────────┐
              │ ConfigService  │  (Singleton Manager)
              └───────┬────────┘
                      │
         ┌────────────┼────────────┐
         │            │            │
    ┌────▼────┐  ┌───▼────┐  ┌───▼─────┐
    │ Schema  │  │ Valid- │  │  File   │
    │ Gen     │  │ ation  │  │  I/O    │
    └─────────┘  └────────┘  └─────────┘
                      │
              ┌───────▼────────┐
              │  BaseConfig    │  (User-Defined Schema)
              │   Instance     │
              └───────┬────────┘
                      │
              ┌───────▼────────┐
              │  Application   │
              └────────────────┘
```

## Key Components

### 1. ConfigService (Main Controller)
**Purpose**: Singleton service that orchestrates configuration loading, validation, and access

**Responsibilities**:
- Initialize nconf with multiple configuration providers
- Enforce singleton pattern (forced reuse)
- Coordinate configuration validation
- Generate JSON schemas
- Handle configuration file I/O
- Manage shared configurations
- Provide validated configuration instance to application

**Key Methods**:
- `constructor(givenClass, passedConfig, options)`: Initialize and validate configuration
- `toPlainObject()`: Convert config instance to plain JavaScript object
- `writeConfigToFile(options)`: Persist configuration to file
- `validateInput(envConfig)`: Validate configuration against schema

### 2. BaseConfig (Abstract Schema)
**Purpose**: Base class for user-defined configuration schemas

**Responsibilities**:
- Define common configuration properties (NODE_ENV, saveToFile, etc.)
- Provide schema generation methods
- Handle file naming conventions
- Expose class-to-JSON-schema conversion

**Key Methods**:
- `toJsonSchema()`: Generate JSON schema from decorators
- `getFileName(ext, isSharedConfig)`: Generate environment-specific filename
- `getSchemaFileName()`: Generate schema filename
- `setName(genericClass)`: Set configuration name from class name

### 3. Decorators (@Configuration, @ConfigVariable)
**Purpose**: Metadata decorators for schema definition

**Responsibilities**:
- Mark classes as configuration schemas (`@Configuration()`)
- Define configuration properties with descriptions (`@ConfigVariable()`)
- Control serialization (expose/exclude properties)
- Integrate with class-validator for JSON schema generation

### 4. Validation System
**Purpose**: Runtime validation of configuration values

**Components**:
- **class-validator**: Decorator-based validation
- **ConfigValidationError**: Formatted error messages
- **validateSync()**: Synchronous validation execution

**Validation Flow**:
1. Load configuration from all sources (nconf)
2. Create config class instance with loaded data
3. Run class-validator on instance
4. Collect validation errors
5. Format and display errors
6. Exit process if errors exist

### 5. Configuration Provider (nconf wrapper)
**Purpose**: Hierarchical configuration loading from multiple sources

**Source Hierarchy** (highest to lowest precedence):
1. Command-line arguments (`argv`)
2. Environment variables (`env`)
3. Configuration files (`file`)
4. Shared configuration files (multiple)

**Features**:
- Parse values to correct types
- Support nested properties via separator (`__`)
- Transform keys (camelCase conversion)
- Transform values (uppercase boolean conversion)
- Encrypted configuration support

### 6. Environment Service
**Purpose**: Manage current environment state

**Responsibilities**:
- Track current NODE_ENV value
- Allow environment override
- Provide environment-aware configuration

### 7. Schema Generator
**Purpose**: Generate JSON schemas for IDE integration

**Process**:
1. Extract validation metadata from decorators
2. Convert to JSON Schema format
3. Add property descriptions
4. Write schema file to `.schemas/` directory
5. Reference schema in config files for autocomplete

### 8. File I/O System
**Purpose**: Read and write configuration files in multiple formats

**Supported Formats**:
- **JSON**: Standard JSON
- **JSONC**: JSON with Comments
- **HJSON**: Human JSON (relaxed syntax)
- **YAML**: YAML format

**Features**:
- Format conversion (JSON ↔ YAML ↔ JSONC ↔ HJSON)
- Schema reference injection
- Object wrapping support
- Ordered key output

## Design Patterns in Use

### 1. Forced Singleton Pattern
**Context**: Ensure single configuration instance per application

**Implementation**:
```typescript
let configService: ConfigService<any>;

constructor(...) {
  if (!passedConfig && configService) { 
    return configService; 
  }
  // ... initialization
  configService = this;
}
```

**Benefits**:
- Prevents multiple initialization
- Consistent configuration across modules
- Can be bypassed for testing via `passedConfig`

### 2. Decorator Pattern
**Context**: Add metadata to configuration properties

**Implementation**:
- `@Configuration()`: Mark config classes
- `@ConfigVariable(description)`: Document properties
- Uses TypeScript experimental decorators + class-validator

**Benefits**:
- Declarative schema definition
- Self-documenting configuration
- Compile-time and runtime validation

### 3. Factory Pattern
**Context**: Create configuration instances from classes

**Implementation**:
```typescript
private createConfigInstance(genericClass, data) {
  const configInstance = new genericClass(data);
  configInstance.setName(genericClass);
  return configInstance;
}
```

**Benefits**:
- Consistent instance creation
- Centralized naming logic
- Supports shared configs

### 4. Strategy Pattern
**Context**: Support multiple configuration file formats

**Implementation**:
- nconf formats registry
- Format-specific serialization strategies
- Runtime format selection via options

**Benefits**:
- Easy to add new formats
- Format-agnostic core logic
- User choice of format

### 5. Adapter Pattern
**Context**: Adapt nconf interface to typed configuration

**Implementation**:
- ConfigService wraps nconf
- Converts plain objects to typed classes
- Provides type-safe interface

**Benefits**:
- Type safety on top of dynamic nconf
- Validation layer integration
- Clean separation of concerns

### 6. Template Method Pattern
**Context**: Define configuration initialization process

**Implementation**:
- Constructor defines initialization steps
- Subclasses (user configs) define schema
- Base class provides common logic

**Process Steps**:
1. Initialize nconf with sources
2. Load configuration from sources
3. Validate against schema
4. Create typed instance
5. Return or exit based on flags

## Data Flow

### Initialization Flow
```
User Code
  │
  ├─> new ConfigService(MyConfig)
  │
  └─> ConfigService Constructor
       │
       ├─> Check Singleton (return if exists)
       ├─> Initialize nconf (argv, env, file)
       ├─> Load config from all sources
       ├─> Validate with class-validator
       ├─> Generate JSON schema
       ├─> Create typed instance
       └─> Return ConfigService
```

### Configuration Loading Order
```
1. CLI Arguments (--PORT=3000)
   │
   ├─> Merged into nconf
   │
2. Environment Variables (PORT=3000)
   │
   ├─> Transformed (camelCase, booleans)
   ├─> Merged into nconf
   │
3. Config File (.env.development.project.json)
   │
   ├─> Parsed by format handler
   ├─> Merged into nconf
   │
4. Shared Config Files (.env.development._shared_.internals.json)
   │
   ├─> Parsed by format handler
   ├─> Merged into nconf (lowest priority)
   │
5. Merged Configuration Object
   │
   └─> Validated & Returned
```

### Validation Flow
```
Merged Config Object
  │
  ├─> Create Class Instance (new MyConfig(data))
  │
  ├─> Run Validators (validateSync)
  │
  ├─> Collect Errors
  │
  ├─> If Errors:
  │    ├─> Format Error Messages
  │    ├─> Print to Console
  │    └─> Exit Process (1)
  │
  └─> If Valid:
       └─> Return Typed Instance
```

## Key Technical Decisions

### 1. Forced Singleton by Default
**Decision**: ConfigService returns first instance on subsequent instantiations

**Rationale**:
- Prevents configuration inconsistency
- Reduces memory usage
- Simplifies usage (no need to pass config around)
- Can be bypassed for testing

**Trade-offs**:
- Less flexible in multi-tenant scenarios
- Testing requires explicit bypass
- Global state (acceptable for config)

### 2. Class-Based Schema Definition
**Decision**: Use TypeScript classes with decorators instead of plain objects or JSON schemas

**Rationale**:
- Type safety at compile time
- IDE autocomplete support
- Decorators provide metadata
- Integration with validation libraries
- Self-documenting code

**Trade-offs**:
- Requires TypeScript
- Decorator experimental feature dependency
- More verbose than plain objects

### 3. Multi-Format Support
**Decision**: Support JSON, YAML, JSONC, HJSON instead of single format

**Rationale**:
- User preference flexibility
- Different projects have different standards
- YAML common in DevOps
- JSONC useful for commented configs
- HJSON human-friendly

**Trade-offs**:
- Increased complexity
- More dependencies
- Format-specific bugs

### 4. Immediate Process Exit on Errors
**Decision**: Exit process (code 1) on validation errors

**Rationale**:
- Fail-fast principle
- Prevent runtime errors later
- Clear error visibility
- Configuration is critical

**Trade-offs**:
- Not suitable for dynamic reloading
- Testing requires mocking process.exit
- Less graceful in some scenarios

### 5. JSON Schema Auto-Generation
**Decision**: Generate JSON schemas from decorators

**Rationale**:
- IDE autocomplete in config files
- Single source of truth (decorators)
- Better developer experience
- Prevents schema drift

**Trade-offs**:
- Requires write access to filesystem
- Schema files need to be committed
- Generation has performance cost

### 6. Hierarchical Configuration Search
**Decision**: Search up directory tree for config files

**Rationale**:
- Monorepo support
- Workspace-level configs
- Shared configs across projects
- Flexible file location

**Trade-offs**:
- Can be confusing which file is loaded
- Performance impact on large trees
- Potential security concerns

## Component Relationships

### Core Dependencies
```
ConfigService
  ├─> uses nconf (configuration provider)
  ├─> creates BaseConfig instances
  ├─> validates with class-validator
  ├─> transforms with class-transformer
  ├─> generates schemas with class-validator-jsonschema
  └─> throws ConfigValidationError

BaseConfig
  ├─> uses @Configuration decorator
  ├─> uses @ConfigVariable decorators
  ├─> provides toJsonSchema()
  └─> extended by user config classes

User Config Class (e.g., MyProjectConfig)
  ├─> extends BaseConfig
  ├─> decorated with @Configuration()
  ├─> properties decorated with @ConfigVariable()
  ├─> properties validated with class-validator decorators
  └─> instantiated by ConfigService
```

### Data Transformations
```
Configuration Sources → nconf → Plain Object → Config Class Instance → Application
                                    ↓
                                Validation
                                    ↓
                              JSON Schema
```

## Extensibility Points

### 1. Custom Configuration Classes
Users create classes extending `BaseConfig` with custom properties

### 2. Extended ConfigService
Users can extend `ConfigService` to add custom methods (see examples/extend-config)

### 3. Custom Validators
Users can add custom class-validator constraints

### 4. Shared Configurations
Multiple config classes can be composed via `sharedConfig` option

### 5. Custom Transforms
Environment variable transforms can be customized via options

---

*This document captures the system architecture and design patterns used in the project.*
