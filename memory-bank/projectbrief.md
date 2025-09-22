# σ₁: Project Brief
*v1.0 | Created: 2025-09-22 | Updated: 2025-09-22*
*Π: 🔧MAINTENANCE | Ω: ⚙️E*

## 🏆 Overview
`@kibibit/configit` is a TypeScript configuration service for Node.js apps. It merges CLI args, env vars, and config files; validates against typed classes; and emits JSON Schema for IDE tooling. Supports JSON, YAML, JSONC, and HJSON with a forced-singleton service.

## 📋 Requirements
- Provide typed configuration via `BaseConfig` classes and decorators
- Validate configuration with helpful errors (`class-validator`)
- Generate JSON Schema to `.schemas/` and link in saved files
- Support JSON/YAML/JSONC/HJSON formats via `nconf` + custom formats
- Support shared configs and override visibility (`showOverrides`)
- Optional transforms: uppercase booleans → booleans; keys → camelCase
- Init/convert flows: `--init`, `--saveToFile`, `--convert=<format>`

## 📦 Scope
- In scope: library code, examples, unit tests, CI/release automation
- Out of scope: web framework integration, databases/ORMs, DI containers, secret managers

## ✅ Acceptance Criteria
- `npm run build` emits `lib/` and type declarations
- `npm test` green (unit + snapshots)
- Example projects run and load config via `ConfigService`
- Semantic release configured and publish-ready

## 🧩 Stakeholders
- Owner: Neil Kalman
- Users: Node.js/TypeScript application developers consuming a typed config library

