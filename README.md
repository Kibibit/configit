<p align="center">
  <a href="https://github.com/Kibibit/configit" target="blank"><img src="logo.png" width="150" ></a>
  <h2 align="center">
    @kibibit/configit
  </h2>
</p>
<p align="center">
  <a href="https://www.npmjs.com/package/@kibibit/configit"><img src="https://img.shields.io/npm/v/@kibibit/configit/latest.svg?style=for-the-badge&logo=npm&color=CB3837"></a>
</p>
<p align="center">
<a href="https://www.npmjs.com/package/@kibibit/configit"><img src="https://img.shields.io/npm/v/@kibibit/configit/beta.svg?logo=npm&color=CB3837"></a>
<a href="https://codecov.io/gh/Kibibit/configit">
  <img src="https://codecov.io/gh/Kibibit/configit/branch/beta/graph/badge.svg?token=DrXLrpuExK">
</a>
<a href="https://github.com/Kibibit/configit/actions/workflows/build.yml">
  <img src="https://github.com/Kibibit/configit/actions/workflows/build.yml/badge.svg?style=flat-square&branch=beta" alt="Build">
</a>
<a href="https://github.com/Kibibit/configit/actions/workflows/tests.yml">
  <img src="https://github.com/Kibibit/configit/actions/workflows/tests.yml/badge.svg?branch=beta" alt="Tests">
</a>
<a href="https://github.com/semantic-release/semantic-release"><img src="https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg"></a>
 <!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->
<a href="#contributors-"><img src="https://img.shields.io/badge/all_contributors-3-orange.svg?style=flat-square" alt="All Contributors"></a>
<!-- ALL-CONTRIBUTORS-BADGE:END -->
</p>
<p align="center">
  A general typescript configuration service

</p>
<hr>

Unless forced to create a new service, this service will return the first created service

## Usage

Create a new class to define your configuration.
The class should extend the `Config` class from this repo
```typescript
import { IsNumber, IsString } from 'class-validator';

import { BaseConfig, Configuration, ConfigVariable } from '@kibibit/configit';

@Configuration()
export class ProjectConfig extends BaseConfig {
  @ConfigVariable('Server port')
  @IsNumber()
  PORT: number;

  @ConfigVariable([
    'This is the slack API to talk and report to channel "hello"'
  ])
  @IsString()
  SLACK_API_KEY: string;
}

}
```
Then, in your code, initialize the config service when you bootstrap your application
```typescript
import express from 'express';
import { ConfigService } from '@kibibit/configit';
import { ProjectConfig } from './project-config.model';

export const configService = new ConfigService<ProjectConfig>(ProjectConfig);
const app = express();

app.get( '/', ( req, res ) => {
  res.send( 'Hello world!' );
} );

app.listen(configService.config.PORT, () => {
  console.log(
    `server started at http://localhost:${ configService.config.PORT }`
  );
});

```

### Extending the Configuration Service (Recommended)
You can extend the configuration to add your own customization and functions!
```typescript
import { chain } from 'lodash';

import { ConfigService, IConfigServiceOptions } from '@kibibit/configit';
import { WinstonLogger } from '@kibibit/nestjs-winston';

import { ExtProjectConfig } from './ext-project-config.model';
import { initializeWinston } from './winston.config';

export class ExtConfigService extends ConfigService<ExtProjectConfig> {
  public logger: WinstonLogger;
  constructor(passedConfig?: Partial<ExtProjectConfig>, options: IConfigServiceOptions = {}) {
    super(ExtProjectConfig, passedConfig, options);

    initializeWinston(this.appRoot);
    this.logger = new WinstonLogger('');
  }

  getSlackApiObject() {
    const slackApiObject = chain(this.toPlainObject())
      .pickBy((value, key) => key.startsWith('SLACK_'))
      .mapKeys((value, key) => key.replace(/^SLACK_/i, ''))
      .mapKeys((value, key) => key.toLowerCase())
      .value();

    return slackApiObject;
  }
}

export const configService = new ExtConfigService() as ExtConfigService;

```

## Vault Integration

Configit supports HashiCorp Vault integration for dynamic secrets management with automatic TTL-based refresh. This enables secure, centralized secret management with automatic rotation for database credentials, API keys, and other sensitive configuration values.

### Overview

Vault integration provides:
- **Dynamic Secrets**: Automatically rotate credentials before expiration
- **Centralized Management**: Store secrets in HashiCorp Vault
- **Automatic Refresh**: Background refresh based on TTL (Time To Live)
- **Multiple Engines**: Support for KV v1/v2, Database, AWS, GCP, Azure, and more
- **Source Priority**: Vault secrets have highest priority (override env vars and config files)
- **Graceful Fallback**: Optional secrets can fall back to environment variables

### Prerequisites

1. **HashiCorp Vault** running and accessible
   - Development: `http://127.0.0.1:8200`
   - Production: HTTPS endpoint (required)

2. **Authentication Method** configured:
   - **Token**: Simple token-based auth (dev only)
   - **AppRole**: Recommended for production
   - **GCP IAM**: For GCP workloads
   - **AWS IAM**: For AWS workloads

3. **Vault Secrets** configured:
   - KV secrets: `secret/data/myapp/api_key`
   - Database credentials: `database/creds/my-role`
   - Other engines as needed

### Installation

Vault integration is included in `@kibibit/configit` - no additional packages required.

### Configuration with Vault

Configure Vault integration by passing `vault` options to `ConfigService`:

```typescript
import { ConfigService, IVaultConfigOptions } from '@kibibit/configit';

const vaultOptions: IVaultConfigOptions = {
  endpoint: process.env.VAULT_ADDR || 'http://127.0.0.1:8200',
  auth: {
    method: 'token',
    config: {
      token: process.env.VAULT_TOKEN
    }
  },
  tls: {
    enabled: true,
    verifyCertificate: true
  },
  refreshBuffer: 300, // Refresh 5 minutes before expiry (default)
  fallback: {
    required: true, // Fail fast if Vault unavailable
    useCacheOnFailure: true,
    maxCacheAge: 3600000 // 1 hour
  }
};

const configService = new ConfigService(ProjectConfig, undefined, {
  vault: vaultOptions
});

// Initialize Vault (async - call before accessing config)
await configService.initializeVault();
```

#### Authentication Methods

**Token Authentication** (Development):
```typescript
auth: {
  method: 'token',
  config: {
    token: process.env.VAULT_TOKEN
  }
}
```

**AppRole Authentication** (Production):
```typescript
auth: {
  method: 'approle',
  config: {
    roleId: process.env.VAULT_ROLE_ID,
    secretId: process.env.VAULT_SECRET_ID, // From secure source
    mountPath: 'approle' // Optional, defaults to 'approle'
  }
}
```

**GCP IAM Authentication**:
```typescript
auth: {
  method: 'gcp',
  config: {
    role: 'my-vault-role',
    serviceAccountKeyFile: '/path/to/key.json', // Optional, uses ADC if not provided
    serviceAccountEmail: 'my-service@project.iam.gserviceaccount.com', // Optional
    jwtExpiration: 900 // Optional, default 15 minutes
  }
}
```

**AWS IAM Authentication**:
```typescript
auth: {
  method: 'aws',
  config: {
    role: 'my-vault-role'
    // Uses instance profile or environment credentials automatically
  }
}
```

**Multiple Auth Methods** (Fallback Chain):
```typescript
auth: {
  methods: [
    {
      type: 'gcp',
      config: { role: 'my-role' }
    },
    {
      type: 'approle',
      config: {
        roleId: process.env.VAULT_ROLE_ID,
        secretId: process.env.VAULT_SECRET_ID
      }
    }
  ]
}
```

#### TLS Configuration

```typescript
tls: {
  enabled: true, // Required (cannot be disabled)
  verifyCertificate: true, // Verify server certificate
  certificateFingerprint: 'sha256:...', // Optional: pin certificate
  caCert: '-----BEGIN CERTIFICATE-----\n...', // Optional: custom CA
  minVersion: 'TLSv1.2' // Optional: minimum TLS version
}
```

#### Refresh Buffer

The refresh buffer determines when secrets are refreshed before expiration:

```typescript
refreshBuffer: 300 // Refresh 300 seconds (5 minutes) before TTL expires
```

Default: `min(10% of TTL, 300 seconds)` - whichever is smaller.

### Vault Decorators

Use composable decorators to mark configuration properties as Vault secrets. Decorators work alongside `@ConfigVariable` and `class-validator` decorators.

#### `@VaultPath(path)` - Required

Specifies the Vault path for a property. Any property with `@VaultPath` is treated as a Vault secret.

```typescript
@VaultPath('secret/data/myapp/api_key')
API_KEY: string;
```

#### `@VaultEngine(type)` - Optional

Specifies the Vault secrets engine type. Auto-detected from path if not provided.

```typescript
@VaultEngine('database') // 'kv-v1', 'kv-v2', 'database', 'aws', 'gcp', etc.
DATABASE_PASSWORD: string;
```

Supported engines:
- `kv-v1`, `kv-v2`: Key-Value stores (default: `kv-v2`)
- `database`: Database secrets engine (dynamic credentials)
- `aws`, `azure`, `gcp`: Cloud provider secrets engines
- `transit`, `pki`: Encryption and certificate engines
- `custom`: Custom engines (requires custom extraction logic)

#### `@VaultKey(key)` - Optional

Specifies the key name within the secret. Only used for KV v1/v2 engines. Defaults to property name in kebab-case.

```typescript
@VaultKey('api_key') // If key name differs from property name
API_KEY: string;
```

#### `@VaultRefreshBuffer(seconds)` - Optional

Override default refresh buffer for a specific secret.

```typescript
@VaultRefreshBuffer(600) // Refresh 10 minutes before expiry
DATABASE_PASSWORD: string;
```

#### `@VaultOptional()` - Optional

Mark secret as optional - allows fallback to environment variable if Vault unavailable.

```typescript
@VaultOptional()
FEATURE_FLAG?: boolean;
```

### Usage Examples

#### Basic Example with Token Auth

```typescript
import { BaseConfig, Configuration, ConfigVariable, VaultPath, VaultKey } from '@kibibit/configit';
import { IsString } from 'class-validator';

@Configuration()
export class AppConfig extends BaseConfig {
  @VaultPath('secret/data/myapp/api_key')
  @VaultKey('api_key')
  @ConfigVariable('API key for external service')
  @IsString()
  API_KEY: string;

  @ConfigVariable('Server port')
  @IsNumber()
  PORT: number;
}

// Initialize with Vault
const configService = new ConfigService(AppConfig, undefined, {
  vault: {
    endpoint: process.env.VAULT_ADDR || 'http://127.0.0.1:8200',
    auth: {
      method: 'token',
      config: {
        token: process.env.VAULT_TOKEN
      }
    }
  }
});

await configService.initializeVault();
console.log(configService.config.API_KEY); // Loaded from Vault
```

#### GCP IAM Authentication

```typescript
const configService = new ConfigService(AppConfig, undefined, {
  vault: {
    endpoint: 'https://vault.example.com',
    auth: {
      method: 'gcp',
      config: {
        role: 'my-vault-role'
        // Uses Application Default Credentials (ADC)
      }
    },
    tls: {
      enabled: true,
      verifyCertificate: true
    }
  }
});

await configService.initializeVault();
```

#### Dynamic Database Credentials

```typescript
import { BaseConfig, Configuration, ConfigVariable, VaultPath, VaultEngine, VaultKey } from '@kibibit/configit';
import { IsString } from 'class-validator';

@Configuration()
export class DatabaseConfig extends BaseConfig {
  @VaultPath('database/creds/my-role')
  @VaultEngine('database')
  @VaultKey('username')
  @ConfigVariable('Database username')
  @IsString()
  DATABASE_USERNAME: string;

  @VaultPath('database/creds/my-role')
  @VaultEngine('database')
  @VaultKey('password')
  @ConfigVariable('Database password')
  @IsString()
  DATABASE_PASSWORD: string;
}
```

**Behavior**:
- Credentials automatically refresh before TTL expires
- Both `username` and `password` refreshed together (same lease)
- Background refresh happens seamlessly

#### Optional Secret with Fallback

```typescript
@Configuration()
export class OptionalConfig extends BaseConfig {
  @VaultPath('secret/data/myapp/feature_flag')
  @VaultKey('enabled')
  @VaultOptional()
  @ConfigVariable('Optional feature flag')
  @IsOptional()
  @IsBoolean()
  FEATURE_FLAG_ENABLED?: boolean;
}
```

If Vault is unavailable, falls back to `FEATURE_FLAG_ENABLED` environment variable.

#### Mixed Vault and Non-Vault Properties

```typescript
@Configuration()
export class MixedConfig extends BaseConfig {
  // From Vault
  @VaultPath('database/creds/my-role')
  @VaultEngine('database')
  @VaultKey('password')
  @ConfigVariable('Database password')
  @IsString()
  DATABASE_PASSWORD: string;

  // From environment variable (no Vault decorators)
  @ConfigVariable('Database host')
  @IsString()
  DATABASE_HOST: string;

  // From Vault
  @VaultPath('secret/data/myapp/api_key')
  @ConfigVariable('API key')
  @IsString()
  API_KEY: string;
}
```

### Source Hierarchy

Configit uses the following source priority (highest to lowest):

1. **Vault** (if configured) - Highest priority
2. **CLI arguments** (`--key=value`)
3. **Environment variables** (`KEY=value`)
4. **Config files** (`.env.development.json`, etc.) - Lowest priority

Vault secrets are injected into `nconf.overrides()` which has the highest priority in the nconf hierarchy.

### Health Monitoring

Monitor Vault connection status and secret refresh schedule:

```typescript
const health = configService.getVaultHealth();

if (health) {
  console.log('Connected:', health.connected);
  console.log('Authenticated:', health.authenticated);
  console.log('Cached secrets:', health.cacheSize);
  console.log('Scheduled refreshes:', health.refreshQueueSize);
  console.log('Last refresh:', new Date(health.lastRefreshTime));
  console.log('Recent errors:', health.errors);
}
```

**Health Status Fields**:
- `connected`: Whether connected to Vault
- `authenticated`: Whether authenticated successfully
- `cacheSize`: Number of cached secrets
- `refreshQueueSize`: Number of scheduled refreshes
- `lastRefreshTime`: Timestamp of last refresh
- `errors`: Array of recent errors (last 10)

### Example: NestJS Integration

See `examples/vault-nestjs-sequelize/` for a complete example showing:
- NestJS application setup
- Sequelize with dynamic database credentials
- Automatic credential rotation
- Health check endpoints

```typescript
// In NestJS onModuleInit
export class ConfigModule implements OnModuleInit {
  async onModuleInit() {
    await configService.initializeVault();
  }
}
```

### Troubleshooting

**Vault Connection Failed**:
- Verify Vault is running: `vault status`
- Check endpoint URL and TLS configuration
- Verify authentication credentials

**Secrets Not Refreshing**:
- Check `getVaultHealth()` for refresh queue status
- Verify TTL is set on secrets (dynamic secrets only)
- Check refresh buffer configuration

**Secret Not Found**:
- Verify Vault path exists: `vault kv get secret/data/myapp/api_key`
- Check authentication has read permissions
- Use `@VaultOptional()` to allow fallback

For more examples and advanced usage, see the `examples/` folder.

## Features
- Supports JSON\YAML files\env variables\cli flags as configuration inputs. See `yaml-config` in the examples folder
- Supports shared configuration files (same file shared for multiple projects)
- initialize a configuration file with `--saveToFile` or `--init`
- save configuration files anywhere above your project's package.json
- forced singleton for a single installation (reuse same class)
- testable
- The ability to create json schemas automatically and add descriptions
  to configuration variables
- Get meaningfull errors when configuration is wrong!

## Examples
See the examples folder for a variety of usage examples

## Contributors ✨

Thanks goes to these wonderful people ([emoji key](https://allcontributors.org/docs/en/emoji-key)):
<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tbody>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="http://thatkookooguy.kibibit.io/"><img src="https://avatars3.githubusercontent.com/u/10427304?v=4?s=100" width="100px;" alt="Neil Kalman"/><br /><sub><b>Neil Kalman</b></sub></a><br /><a href="https://github.com/Kibibit/configit/commits?author=Thatkookooguy" title="Code">💻</a> <a href="https://github.com/Kibibit/configit/commits?author=Thatkookooguy" title="Documentation">📖</a> <a href="#design-Thatkookooguy" title="Design">🎨</a> <a href="#maintenance-Thatkookooguy" title="Maintenance">🚧</a> <a href="#infra-Thatkookooguy" title="Infrastructure (Hosting, Build-Tools, etc)">🚇</a> <a href="https://github.com/Kibibit/configit/commits?author=Thatkookooguy" title="Tests">⚠️</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/nitzan-madar"><img src="https://avatars.githubusercontent.com/u/73841521?v=4?s=100" width="100px;" alt="Nitzan Madar"/><br /><sub><b>Nitzan Madar</b></sub></a><br /><a href="https://github.com/Kibibit/configit/commits?author=nitzan-madar" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/dafnaassaf"><img src="https://avatars.githubusercontent.com/u/105150390?v=4?s=100" width="100px;" alt="Dafna Assaf"/><br /><sub><b>Dafna Assaf</b></sub></a><br /><a href="https://github.com/Kibibit/configit/commits?author=dafnaassaf" title="Code">💻</a></td>
    </tr>
  </tbody>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification. Contributions of any kind are welcome!

<div>Logo made by <a href="https://www.flaticon.com/authors/good-ware" title="Good Ware">Good Ware</a> from <a href="https://www.flaticon.com/" title="Flaticon">www.flaticon.com</a></div>
<br>

## Stay in touch

- Author - [Neil Kalman](https://github.com/thatkookooguy)
- Website - [https://github.com/kibibit](https://github.com/kibibit)
- StackOverflow - [thatkookooguy](https://stackoverflow.com/users/1788884/thatkookooguy)
- Twitter - [@thatkookooguy](https://twitter.com/thatkookooguy)
- Twitter - [@kibibit_opensrc](https://twitter.com/kibibit_opensrc)