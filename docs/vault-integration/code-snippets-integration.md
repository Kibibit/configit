# Vault Integration - Exact Code Snippets

This document provides exact code snippets showing the integration points between ConfigService and VaultIntegration.

---

## 1. IConfigServiceOptions - Vault Configuration

**File**: `src/config.service.ts`  
**Status**: ✅ Already implemented

```typescript
export interface IConfigServiceOptions {
  convertToCamelCase?: boolean;
  convertUppercaseBooleans?: boolean;
  fileFormat?: EFileFormats;
  sharedConfig?: TClass<BaseConfig>[];
  skipSchema?: boolean;
  schemaFolderName?: string;
  showOverrides?: boolean;
  configFolderRelativePath?: string;
  encryptConfig?: {
    algorithm: string;
    secret: string;
  };
  vault?: IVaultConfigOptions;  // ← Vault configuration option
}
```

**Usage Example**:
```typescript
const configService = new ConfigService(MyConfig, undefined, {
  vault: {
    endpoint: 'https://vault.example.com',
    auth: {
      method: 'gcp',
      role: 'my-app-role'
    },
    refreshBuffer: 300,
    fallback: {
      required: false,
      useCacheOnFailure: true
    }
  }
});
```

---

## 2. Constructor Pattern - Two-Phase Initialization

**File**: `src/config.service.ts`  
**Status**: ✅ Correctly implemented

### Constructor (Synchronous)
```typescript
constructor(
  givenClass: TClass<T>,
  passedConfig?: Partial<T>,
  options: IConfigServiceOptions = {}
) {
  // ... existing initialization code ...
  
  // Vault is NOT initialized here (async operation)
  // User must call initializeVault() after construction
  
  this.initializeNconf();
  // ... rest of initialization ...
}
```

### Async Initialization Method
```typescript
/**
 * Initialize Vault integration (async)
 * Call this after constructor if using Vault
 */
async initializeVault(): Promise<void> {
  if (!this.options.vault) {
    return; // Vault not configured
  }

  if (!this.genericClass) {
    throw new Error('ConfigService not properly initialized');
  }

  // Create Vault integration
  this.vaultIntegration = new VaultIntegration(this.options.vault);

  // Initialize Vault connection
  await this.vaultIntegration.initialize();

  // Load secrets for this config class
  await this.vaultIntegration.loadSecrets(this.genericClass as unknown as new () => T);

  // Secrets are now cached and injected into nconf via overrides
  // Re-validate config with Vault secrets included
  const config = nconf.get();
  const envConfig = this.validateInput(config);
  if (envConfig) {
    envConfig.NODE_ENV = this.mode;
    // Use type assertion to allow reassigning readonly property
    (this as { config?: T }).config = this.createConfigInstance(this.genericClass, envConfig as T) as T;
  }
}
```

**Usage Pattern**:
```typescript
// Phase 1: Synchronous construction
const configService = new ConfigService(MyConfig, undefined, {
  vault: { /* ... */ }
});

// Phase 2: Async Vault initialization
await configService.initializeVault();

// Now config includes Vault secrets
console.log(configService.config.databasePassword); // From Vault
```

---

## 3. nconf.overrides() Usage - FIX REQUIRED

**File**: `src/vault/vault-cache.ts`  
**Status**: ❌ Bug present, fix required

### Current Implementation (BUGGY)
```typescript
// Line 83 - CURRENT CODE (BUGGY)
set(propertyName: string, vaultPath: string, secret: IVaultSecret, metadata: VaultPropertyMetadata): void {
  // ... extract value ...
  
  // BUG: This replaces ALL overrides with just this one property!
  nconf.overrides({ [propertyName]: value });
}
```

**Problem**: Each call to `nconf.overrides()` replaces the entire overrides object, causing secrets to overwrite each other.

### Fixed Implementation
```typescript
// FIXED CODE
set(propertyName: string, vaultPath: string, secret: IVaultSecret, metadata: VaultPropertyMetadata): void {
  // Extract value based on engine type
  const value = this.extractValue(secret, metadata);

  // Calculate expiration times
  const now = Date.now();
  const leaseDurationMs = secret.leaseDuration * 1000;
  const expiresAt = secret.leaseDuration > 0 ? now + leaseDurationMs : now + 3600000;

  // Calculate refresh time (refresh buffer)
  const defaultBufferMs = Math.min(leaseDurationMs * 0.1, 300000);
  const refreshBufferMs = metadata.refreshBuffer ? metadata.refreshBuffer * 1000 : defaultBufferMs;
  const refreshAt = secret.leaseDuration > 0 ? expiresAt - refreshBufferMs : expiresAt;

  const entry: VaultCacheEntry = {
    value,
    secret,
    cachedAt: now,
    expiresAt,
    refreshAt,
    propertyName,
    vaultPath
  };

  this.cache.set(propertyName, entry);

  // Update mappings
  this.propertyToPath.set(propertyName, vaultPath);

  const properties = this.pathToProperties.get(vaultPath) || new Set();
  properties.add(propertyName);
  this.pathToProperties.set(vaultPath, properties);

  // FIX: Merge with existing overrides instead of replacing
  // Access the overrides store directly to get current values
  const overridesStore = (nconf as any).stores?.overrides;
  const existingOverrides = overridesStore?.store || {};
  
  // Merge and set all overrides at once
  nconf.overrides({
    ...existingOverrides,
    [propertyName]: value
  });
}
```

**Alternative Fix** (Using nconf.use()):
```typescript
// Alternative approach using nconf.use()
// Inject into nconf overrides (highest priority)
// Get the overrides store and merge
const overridesStore = nconf.use('overrides');
const currentOverrides = (overridesStore as any).store || {};
overridesStore.load({
  ...currentOverrides,
  [propertyName]: value
});
```

**Recommended Fix** (Simplest and most reliable):
```typescript
// Recommended: Use nconf.set() on overrides store
// This is the safest approach that doesn't require accessing internal stores
const overridesStore = nconf.use('overrides');
overridesStore.set(propertyName, value);
```

However, `nconf.use('overrides').set()` might not work if overrides store doesn't support `.set()`. The safest approach is the first fix (merge existing overrides).

---

## 4. Decorator Metadata Flow

**File**: `src/vault/decorators.ts`  
**Status**: ✅ Correctly implemented

### Step 1: Decorators Store Metadata
```typescript
// Example config class with Vault decorators
@Configuration()
class DatabaseConfig extends BaseConfig {
  @VaultPath('secret/data/myapp/database')
  @VaultKey('password')
  @VaultRefreshBuffer(600) // 10 minutes
  databasePassword: string;

  @VaultPath('secret/data/myapp/database')
  @VaultKey('username')
  databaseUsername: string;

  @VaultPath('database/creds/my-role')
  @VaultOptional()
  dynamicDbCreds: string;
}
```

### Step 2: Metadata Collection
```typescript
// decorators.ts:213 - getAllVaultMetadata()
export function getAllVaultMetadata(target: any): Record<string, VaultPropertyMetadata> {
  const metadata: Record<string, VaultPropertyMetadata> = {};

  // Get registered Vault properties
  const propertyKeys = getVaultPropertyNames(target);
  const prototype = target.prototype || target;

  for (const key of propertyKeys) {
    const vaultMetadata = buildVaultMetadata(prototype, key);
    if (vaultMetadata) {
      metadata[key] = vaultMetadata;
    }
  }

  return metadata;
}

// Returns:
// {
//   databasePassword: {
//     path: 'secret/data/myapp/database',
//     engine: 'kv-v2',
//     key: 'password',
//     refreshBuffer: 600,
//     required: true,
//     propertyName: 'databasePassword',
//     propertyType: 'String'
//   },
//   databaseUsername: { ... },
//   dynamicDbCreds: { ... }
// }
```

### Step 3: Metadata Usage in VaultIntegration
```typescript
// vault-integration.ts:59-123 - loadSecrets()
async loadSecrets<T extends object>(configOrClass: T | (new () => T)): Promise<void> {
  if (!this.initialized) {
    throw new Error('VaultIntegration not initialized. Call initialize() first.');
  }

  // Determine if we got a class or instance
  const isClass = typeof configOrClass === 'function';
  const targetClass = isClass ? configOrClass : (configOrClass.constructor as new () => T);
  const targetInstance = isClass ? null : configOrClass;

  // Get all Vault metadata from decorators ← STEP 3A
  const vaultMetadata = getAllVaultMetadata(targetClass);

  if (Object.keys(vaultMetadata).length === 0) {
    return; // No Vault properties
  }

  // Group properties by full Vault path (including engine prefix) ← STEP 3B
  const pathGroups = this.groupByFullPath(vaultMetadata);
  // Result: Map {
  //   'secret/data/myapp/database' => [
  //     { propertyName: 'databasePassword', key: 'password', ... },
  //     { propertyName: 'databaseUsername', key: 'username', ... }
  //   ],
  //   'database/creds/my-role' => [
  //     { propertyName: 'dynamicDbCreds', ... }
  //   ]
  // }

  // Load secrets for each path ← STEP 3C
  for (const [fullPath, properties] of pathGroups.entries()) {
    try {
      const secret = await this.provider.read(fullPath);
      // secret.data = { password: 'secret123', username: 'admin' }

      // Cache secret for each property ← STEP 3D
      for (const property of properties) {
        const propertyWithDefaults = {
          ...property,
          refreshBuffer: property.refreshBuffer ?? this.config.refreshBuffer
        };

        // This calls VaultCache.set(), which injects into nconf ← STEP 3E
        this.cache.set(property.propertyName, fullPath, secret, propertyWithDefaults);

        // Extract and set the specific key value to the instance
        if (targetInstance) {
          const key = property.key || property.propertyName;
          const value = secret.data[key];
          (targetInstance as any)[property.propertyName] = value;
        }

        // Schedule refresh if secret has TTL
        if (secret.leaseDuration > 0) {
          this.refreshManager.scheduleRefresh(property.propertyName, propertyWithDefaults, targetInstance);
        }
      }
    } catch (error: any) {
      // Error handling...
    }
  }
}
```

### Step 4: nconf Hierarchy After Injection
```typescript
// After VaultCache.set() is called for each secret:
// nconf hierarchy (highest to lowest priority):
// 1. overrides: { databasePassword: 'secret123', databaseUsername: 'admin', ... }
// 2. argv: { ... command line args ... }
// 3. env: { ... environment variables ... }
// 4. file: { ... config file values ... }
// 5. defaults: { ... default values ... }

// When ConfigService calls nconf.get(), it gets merged values:
const config = nconf.get();
// config.databasePassword = 'secret123' (from Vault, highest priority)
// config.databaseHost = 'localhost' (from env/file, lower priority)
```

### Complete Flow Diagram
```
┌─────────────────────────────────────────────────────────────┐
│ Config Class with @VaultPath Decorators                      │
│                                                               │
│ @VaultPath('secret/data/myapp/db')                          │
│ databasePassword: string;                                    │
└───────────────────────┬───────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ getAllVaultMetadata(MyConfig)                               │
│                                                               │
│ Scans class prototype using Reflect.getMetadata()           │
│ Returns: { databasePassword: { path, key, engine, ... } }   │
└───────────────────────┬───────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ VaultIntegration.loadSecrets(MyConfig)                      │
│                                                               │
│ Groups by path: { 'secret/data/myapp/db': [props...] }     │
│ Reads from Vault: await provider.read('secret/data/myapp/db')│
└───────────────────────┬───────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ VaultCache.set('databasePassword', path, secret, metadata)  │
│                                                               │
│ Extracts value: secret.data.password                        │
│ Caches entry with TTL                                        │
│ Injects into nconf: nconf.overrides({ databasePassword })    │
└───────────────────────┬───────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ ConfigService.initializeVault()                             │
│                                                               │
│ const config = nconf.get(); // Includes Vault secrets       │
│ const envConfig = this.validateInput(config);               │
│ this.config = createConfigInstance(MyConfig, envConfig);     │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Complete Integration Example

### Config Model
```typescript
import { BaseConfig } from '@kibibit/configit';
import { VaultPath, VaultKey, VaultOptional } from '@kibibit/configit/vault';

@Configuration()
class AppConfig extends BaseConfig {
  // Standard config (from env/file)
  @IsString()
  @ConfigVariable('Database host')
  databaseHost: string = 'localhost';

  // Vault secret (from Vault)
  @IsString()
  @VaultPath('secret/data/myapp/database')
  @VaultKey('password')
  databasePassword: string;

  // Optional Vault secret (fallback to env if Vault unavailable)
  @IsString()
  @IsOptional()
  @VaultPath('secret/data/myapp/api-key')
  @VaultOptional()
  apiKey: string;
}
```

### Service Initialization
```typescript
import { ConfigService } from '@kibibit/configit';
import { AppConfig } from './app.config';

async function initializeApp() {
  // Phase 1: Create ConfigService (synchronous)
  const configService = new ConfigService(AppConfig, undefined, {
    vault: {
      endpoint: process.env.VAULT_ADDR || 'https://vault.example.com',
      auth: {
        method: 'gcp',
        role: 'my-app-role'
      },
      refreshBuffer: 300, // 5 minutes
      fallback: {
        required: false,
        useCacheOnFailure: true
      }
    }
  });

  // Phase 2: Initialize Vault (asynchronous)
  try {
    await configService.initializeVault();
    console.log('Vault initialized successfully');
  } catch (error) {
    console.error('Vault initialization failed:', error);
    // If fallback.required === false, configService.config still works
    // but without Vault secrets
  }

  // Phase 3: Use config (now includes Vault secrets)
  const config = configService.config;
  console.log('Database host:', config.databaseHost); // From env/file
  console.log('Database password:', config.databasePassword); // From Vault

  return configService;
}
```

---

## Summary

### Integration Points

1. **IConfigServiceOptions.vault** ✅ - Already implemented
2. **Constructor Pattern** ✅ - Two-phase init (sync constructor + async initializeVault)
3. **nconf.overrides()** ❌ - **BUG FIX REQUIRED** - Must merge instead of replace
4. **Decorator Metadata Flow** ✅ - Correctly implemented end-to-end

### Critical Fix Required

**File**: `src/vault/vault-cache.ts`  
**Line**: 83  
**Change**: Merge existing overrides instead of replacing them

```typescript
// Current (BUGGY):
nconf.overrides({ [propertyName]: value });

// Fixed:
const overridesStore = (nconf as any).stores?.overrides;
const existingOverrides = overridesStore?.store || {};
nconf.overrides({
  ...existingOverrides,
  [propertyName]: value
});
```
