# σ₂: System Patterns
*v1.0 | Created: 2025-09-22 | Updated: 2025-09-22*
*Π: 🔧MAINTENANCE | Ω: ⚙️E*

## 🏛️ Architecture Overview
- Single-package TypeScript library that provides a configuration service
- Core modules in `src/`:
  - `config.service.ts`: `ConfigService<T>` (forced singleton), file/argv/env merge, schema write, save/convert
  - `config.model.ts`: `BaseConfig` + `@Configuration()`/`@ConfigVariable()`; schema and file-name helpers
  - `json-schema.validator.ts`: decorator implementations and validation bridge
  - `environment.service.ts`: `setEnvironment`/`getEnvironment`
  - `config.errors.ts`: `ConfigValidationError` with formatted output

## 🧱 Components
- Classes: `ConfigService`, `BaseConfig`, error types; example services under `examples/*`
- Enums/Types: `EFileFormats`, `IConfigServiceOptions`, `IWriteConfigToFileOptions`
- Outputs: `.env.<NODE_ENV>.<name>.<ext>` config file(s); `.schemas/<name>.env.schema.json`

## 🔄 Data Flow
1. Determine environment: `setEnvironment` → `getEnvironment` (default from `process.env.NODE_ENV` or `development`)
2. Initialize `nconf` with:
   - CLI args (`argv`) → optional key transforms (uppercase booleans → booleans; camelCase)
   - Env vars (`env`) → same optional transforms
   - File source → chosen format (json/yaml/jsonc/hjson)
3. If `--init`/`--saveToFile` set and file missing: write default config and schema, then exit
4. Validate using `class-validator` on a `BaseConfig` subclass
5. On success: instantiate typed config; optionally write schema and/or convert to other formats; optionally write shared configs
6. Expose `configService.config` and helpers (`toPlainObject()`, file/schema writers)

## 🔐 Security Considerations
- Optional file encryption via `nconf` secure options (`algorithm`, `secret`)
- Avoid logging secrets; error output is formatted but does not print full objects by default
- File writes constrained to detected app root and config root (via `find-root`)

## 🧪 Testing Strategy
- Unit tests: `jest` + `ts-jest` in `src/*.spec.ts`; snapshots under `src/__snapshots__/`
- E2E smoke tests via `examples/` folder (run from repo root):
  - Commands:
    - `npm run test:simple`
    - `npm run test:extend`
    - `npm run test:yaml`
    - `npm run test:shared-configs`
    - `npm run test:uppercase-booleans`
  - Coverage by example:
    - `simple-node`: baseline JSON flow, service bootstrap (Express demo)
    - `extend-config`: subclassing `ConfigService`, Winston init, `getSlackApiObject`
    - `yaml-config`: YAML read/write, `$schema` header presence
    - `jsonc-config`: JSONC format support
    - `shared-configs`: emits shared configs + schemas
    - `uppercase-booleans`: transforms `True`/`False` → booleans; optional camelCase
    - `convert-config-file`: end-to-end `--convert` flow (e.g., JSON → YAML/HJSON)
  - Pass/Fail criteria:
    - Exit code 0 on success; non-zero on validation/config errors
    - Expected artifacts exist:
      - Config: `.env.<NODE_ENV>.<name>.(json|yaml|jsonc|hjson)`
      - Schema: `.schemas/<name>.env.schema.json`
    - Logs include flow markers: “Initializing Configuration File”, “Converting Configuration File”, “EXITING” (when applicable)
    - For server demos, app starts without error
- CI suggestion (optional): add a `test:examples` aggregator to run all example scripts and assert artifacts; wire into GitHub Actions next to unit tests


