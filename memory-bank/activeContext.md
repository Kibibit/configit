# Active Context: @kibibit/configit
*Version: 1.0*
*Created: 2025-10-05*
*Last Updated: 2025-10-05*
*Current RIPER Mode: EXECUTE*

## Current Focus
**Currently Implementing: Step 1 - TypeScript types and enums**

Executing implementation plan for three configuration enhancements:
1. Source restrictions (json/env/both) via decorator metadata + helper decorators
2. Custom configuration file naming via decorator options + method override
3. Full backward compatibility maintained throughout

Planning complete. Now executing atomic, testable commits following Angular conventions.

## Recent Changes
- 2025-10-05: CursorRIPER Framework initialized
- 2025-10-05: Memory bank created with project documentation
- Current: Active development on selective configuration persistence feature

## Active Decisions
- **Selective Persistence Architecture**: Determining the best approach to mark configuration properties as "file-only" or "env-only"
  - Options being considered:
    1. New decorator parameter (e.g., `@ConfigVariable('desc', { source: 'file' | 'env' | 'both' })`)
    2. Separate decorator (e.g., `@FileOnly()` or `@EnvOnly()`)
    3. Configuration class-level metadata
  - Need to maintain backward compatibility
  - Must work with existing validation system

- **Precedence Rules**: Defining clear precedence when multiple sources are available
  - Current hierarchy: CLI > Env > File > Shared File
  - Need to handle: What if property is marked file-only but env var exists?
  - Should we warn, error, or silently ignore?

- **Validation Timing**: When to validate source restrictions
  - During nconf initialization?
  - During ConfigService validation phase?
  - Both?

## Next Steps
1. ✅ Design source restriction and custom naming APIs (COMPLETED)
2. ✅ Create detailed implementation plan (COMPLETED)
3. ⬜ Implement Step 1: TypeScript types and enums (NEXT)
4. ⬜ Follow implementation plan through all 10 steps
5. ⬜ Update documentation and examples
6. ⬜ Consider performance implications after implementation

**See**: `memory-bank/implementationPlan.md` for detailed step-by-step plan

## Current Challenges
- **Backward Compatibility**: Need to ensure existing configurations continue to work without changes
- **nconf Integration**: nconf loads from all sources by default; need to filter or validate after loading
- **Type Safety**: Ensure TypeScript types reflect source restrictions where possible
- **Error Messages**: Need clear, actionable error messages when source restrictions are violated

## Implementation Progress
- [✓] Core configuration service with multi-source support
- [✓] JSON Schema generation from decorators
- [✓] Configuration validation with class-validator
- [✓] Multiple file format support (JSON, YAML, JSONC, HJSON)
- [✓] Shared configuration support
- [✓] Environment-specific configurations
- [✓] Configuration file initialization and conversion
- [✓] Forced singleton pattern
- [✓] Uppercase boolean conversion
- [✓] Camel case conversion for env vars
- [ ] Selective configuration persistence (IN PROGRESS)
- [ ] Source restriction validation
- [ ] Source restriction decorators/API

---

*This document captures the current state of work and immediate next steps.*
