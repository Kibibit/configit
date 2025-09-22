# σ₃: Technical Context
*v1.0 | Created: 2025-09-22 | Updated: 2025-09-22*
*Π: 🔧MAINTENANCE | Ω: ⚙️E*

## 🛠️ Technology Stack
- Runtime: Node.js (TypeScript 5)
- Package type: NPM library (`@kibibit/configit`)
- Configuration engine: `nconf` with custom formats
  - Formats: JSON (`json`), YAML (`nconf-yaml`), JSONC (`@kibibit/nconf-jsonc`), HJSON (`hjson`)
- Validation & transformation: `class-validator`, `class-transformer`
- JSON Schema generation: `class-validator-jsonschema`
- Utilities: `lodash`, `fs-extra`, `find-root`, `yaml`, `colors`
- Examples: Express-based demo apps under `examples/*` (not a framework dependency of the library)

## 🔧 Environment
- Local: `tsc` build, `jest` tests; config resolution via CLI args, env vars, and config files
- Default environment: `NODE_ENV` from process env (fallback: `development`) via `environment.service.ts`
- Consumers: Works in any Node environment; not a deployed service

## 📦 Dependencies (runtime)
- `@kibibit/kb-error`: Base error for rich messages
- `@kibibit/nconf-hjson`, `@kibibit/nconf-jsonc`: Extra nconf formats
- `class-validator`, `class-transformer`, `class-validator-jsonschema`: Typed validation and schema
- `nconf`, `nconf-yaml`, `yaml`, `hjson`: Config parsing and formats
- `fs-extra`, `find-root`, `lodash`, `colors`: FS, project root detection, utils, terminal colors

## ⚙️ Tooling (dev)
- Build: `tsc`
- Test: `jest`, `ts-jest`
- Lint: `eslint`, `@typescript-eslint`
- Release/CI: `semantic-release` (GitHub + npm), GitHub Actions
- Git hooks & commits: `husky`, `commitlint`, `commitizen`
- Contributors automation: `all-contributors`


