# Project Brief: @kibibit/configit
*Version: 1.0*
*Created: 2025-10-05*
*Last Updated: 2025-10-05*

## Project Overview
`@kibibit/configit` is a general-purpose TypeScript configuration library that provides strict schema validation for application configurations. The library prevents production breakage caused by configuration mistakes, missing secrets, or invalid environment variables by enforcing type-safe configuration schemas at runtime.

The library is designed to work across multiple application types including CLI tools, server applications (Express, NestJS), and any JavaScript/TypeScript application that requires validated configuration management.

## Core Problem Statement
Applications often fail in production due to:
- Missing or incorrectly named environment variables
- Type mismatches in configuration values
- Missing required secrets or API keys
- Configuration files with invalid structure
- Lack of configuration validation until runtime errors occur

`configit` solves these problems by providing compile-time and runtime validation of configuration using TypeScript decorators and class-validator, ensuring configuration issues are caught early in development or during CI/CD pipelines.

## Core Requirements

### Must-Have Features (Implemented)
1. **Schema-Based Validation**
   - Define configuration using TypeScript classes with decorators
   - Runtime validation using `class-validator`
   - Type-safe configuration access throughout the application

2. **Multiple Configuration Sources**
   - Command-line arguments (CLI flags)
   - Environment variables (with separator support: `__`)
   - Configuration files (JSON, YAML, JSONC, HJSON)
   - Hierarchical configuration merging with proper precedence

3. **Automatic JSON Schema Generation**
   - Generate JSON schemas from configuration classes
   - IDE autocomplete support via schema files
   - Documentation embedded in schemas via decorators

4. **Configuration File Management**
   - Initialize configuration files (`--init` or `--saveToFile`)
   - Convert between formats (JSON ↔ YAML ↔ JSONC ↔ HJSON)
   - Save configuration files anywhere above project's `package.json`

5. **Shared Configuration Support**
   - Multiple configuration files for different concerns
   - Shared configuration across projects
   - Selective configuration overrides

6. **Meaningful Error Messages**
   - Clear validation error output
   - Detailed error messages showing which config values are invalid
   - Immediate process exit on configuration errors

7. **Forced Singleton Pattern**
   - Single configuration instance per application
   - Reusable across modules
   - Testable with mock configurations

8. **Environment-Specific Configuration**
   - Support for multiple environments (development, production, staging, test, etc.)
   - Environment-aware file naming (`.env.{environment}.{name}.{ext}`)

9. **Developer Experience Features**
   - Uppercase boolean conversion (`True`/`False` → `true`/`false`)
   - Camel case conversion for environment variables
   - Configuration encryption support
   - Validation-only mode (`--validate`)

10. **Testability**
    - Pass mock configuration directly to constructor
    - Skip schema generation in tests
    - Bypass singleton in test environments

### In Active Development
1. **Multiple Configuration Sources with Selective Persistence**
   - Some configuration values only from persistent JSON files
   - Some configuration values only from environment variables
   - Ability to define which properties come from which source
   - Mixed source configurations with clear precedence rules

## Success Criteria
1. **Zero Production Configuration Errors**
   - Invalid configurations are caught before deployment
   - All required secrets and variables are validated

2. **Developer Productivity**
   - Easy to define new configuration properties
   - Clear error messages when configuration is wrong
   - IDE support with autocomplete for config values

3. **Flexibility**
   - Works with any Node.js/TypeScript application
   - Supports multiple configuration formats
   - Extensible for custom configuration needs

4. **Adoption & Usage**
   - Used across CLI tools, web servers, and microservices
   - Active community usage via npm
   - Clear documentation and examples

## Scope

### In Scope
- TypeScript configuration management
- Runtime validation of configuration
- Multiple configuration source support
- JSON Schema generation and IDE integration
- Configuration file initialization and conversion
- Environment-specific configurations
- Shared configuration support
- Selective configuration persistence (in development)
- Configuration encryption
- Testability and mock support

### Out of Scope
- Frontend/browser configuration (Node.js only)
- Configuration UI or admin panels
- Remote configuration management
- Configuration versioning or history
- Dynamic configuration reloading at runtime
- Configuration as a service (cloud-based)

## Timeline
- **Current Phase**: Active Development
- **Beta Version**: v1.0.0-beta.26
- **Focus**: Multiple configuration sources with selective persistence
- **Maintenance**: Ongoing bug fixes and community support

## Stakeholders
- **Primary Maintainer**: Neil Kalman (@thatkookooguy)
- **Contributors**: Nitzan Madar, Dafna Assaf, and community contributors
- **Users**: TypeScript/Node.js developers building CLI tools, servers, and applications
- **Organization**: Kibibit Open Source

## Use Cases
1. **CLI Applications**: Configuration for command-line tools with flags and config files
2. **Express/NestJS Servers**: Server configuration with environment-specific settings
3. **Microservices**: Service configuration with shared configs and secrets
4. **CI/CD Pipelines**: Configuration validation in build and deployment pipelines
5. **Development Tools**: Developer tooling with validated configuration

---

*This document serves as the foundation for the project and informs all other memory files.*
