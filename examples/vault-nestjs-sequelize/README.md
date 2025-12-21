# NestJS + Sequelize + Vault Dynamic Secret Rotation Example

This example demonstrates how to use Configit with NestJS and Sequelize to handle Vault dynamic database credential rotation.

## Overview

The example shows:
- **NestJS** application setup
- **Sequelize** configured with PostgreSQL
- **Configit** with Vault decorators for dynamic credentials
- **Automatic credential rotation** - Sequelize reconnects when credentials expire
- **Test endpoints** to verify rotation works

## Prerequisites

1. **Vault running** (localhost:8200)
   ```bash
   docker compose -f docker-compose.vault.yml up -d
   bash scripts/vault-setup.sh
   ```

2. **PostgreSQL running** (localhost:5433)
   - Should be configured in Vault with role `configit-readonly`
   - TTL: 60 seconds

3. **Node.js** (v18+)

## Setup

1. **Install dependencies:**
   ```bash
   cd examples/vault-nestjs-sequelize
   npm install
   ```

2. **Set environment variables (optional):**
   ```bash
   export VAULT_ADDR=http://127.0.0.1:8200
   export VAULT_TOKEN=configit-dev-token
   export PORT=3000
   ```

3. **Build:**
   ```bash
   npm run build
   ```

## Running

**Development mode:**
```bash
npm run start:dev
```

**Production mode:**
```bash
npm run build
npm start
```

The application will:
1. Initialize Vault connection
2. Load database credentials from `database/creds/configit-readonly`
3. Configure Sequelize with dynamic credentials
4. Start HTTP server on port 3000

## Test Endpoints

### Query Database
```bash
curl http://localhost:3000/test/db
```

Returns database query result, current credentials, and Vault health status.

### Check Credentials
```bash
curl http://localhost:3000/test/credentials
```

Shows current database credentials (password length only, not the actual password).

### Vault Health
```bash
curl http://localhost:3000/test/vault-health
```

Shows Vault connection status and secret refresh schedule.

## Testing Credential Rotation

### Manual Rotation Test

1. **Start the application:**
   ```bash
   npm run start:dev
   ```

2. **Query the database repeatedly:**
   ```bash
   # Run this every 10 seconds for 2 minutes
   watch -n 10 'curl -s http://localhost:3000/test/db | jq .credentials.username'
   ```

3. **Observe credential rotation:**
   - Credentials have 60s TTL
   - Configit refreshes 10s before expiry (refresh buffer)
   - Username should change every ~50 seconds
   - Database queries should continue working without interruption

### Automated Test Script

Use the provided `test-rotation.sh` script:

```bash
chmod +x test-rotation.sh
./test-rotation.sh
```

This script:
- Starts the application
- Queries the database every 5 seconds
- Monitors credential changes
- Verifies rotation works correctly

## How It Works

### 1. Configuration Model (`src/config/database.config.ts`)

Uses Configit decorators to mark credentials as Vault secrets:

```typescript
@VaultPath('database/creds/configit-readonly')
@VaultEngine('database')
@VaultKey('username')
DATABASE_USERNAME!: string;
```

### 2. ConfigService (`src/config/config.service.ts`)

- Initializes Configit with Vault options
- Calls `initializeVault()` in `onModuleInit()`
- Provides typed access to credentials

### 3. Database Module (`src/database/database.module.ts`)

- Configures Sequelize with credentials from ConfigService
- Wraps query method to catch authentication errors
- Reconnects with fresh credentials on auth failures
- Retries failed queries after reconnection

### 4. Credential Rotation Flow

1. **Initial Load:** Configit fetches credentials from Vault on startup
2. **Background Refresh:** Configit refreshes credentials 10s before expiry (50s mark)
3. **Auth Error Detection:** Sequelize wrapper catches PostgreSQL auth errors
4. **Reconnection:** Gets fresh credentials from ConfigService and reconnects
5. **Query Retry:** Retries the failed query with new credentials

## Key Features

- ✅ **Automatic Rotation:** Credentials refresh before expiry
- ✅ **Seamless Reconnection:** Sequelize handles auth errors gracefully
- ✅ **No Downtime:** Queries retry automatically after reconnection
- ✅ **Type Safety:** Full TypeScript support with typed config
- ✅ **Observability:** Health endpoints show rotation status

## Troubleshooting

### Vault Connection Failed

```
Error: Vault initialization failed: Connection refused
```

**Solution:**
```bash
docker compose -f docker-compose.vault.yml up -d
bash scripts/vault-setup.sh
```

### Database Connection Failed

```
Error: password authentication failed
```

**Solution:**
- Verify PostgreSQL is running on localhost:5433
- Check Vault database role is configured correctly
- Ensure Vault token has permissions to read `database/creds/configit-readonly`

### Credentials Not Rotating

- Check Vault health endpoint: `curl http://localhost:3000/test/vault-health`
- Verify refresh status shows scheduled refreshes
- Wait for TTL to expire (60s) - rotation happens automatically

## Architecture

```
┌─────────────┐
│   NestJS    │
│  AppModule  │
└──────┬──────┘
       │
       ├─── AppConfigService (Configit)
       │    └─── VaultIntegration
       │         └─── Auto-refresh credentials
       │
       └─── DatabaseModule (Sequelize)
            └─── PostgreSQL Connection
                 └─── Auto-reconnect on auth errors
```

## Files

- `src/config/database.config.ts` - Config model with Vault decorators
- `src/config/config.service.ts` - ConfigService wrapper
- `src/database/database.module.ts` - Sequelize module with rotation handling
- `src/test/test.controller.ts` - Test endpoints
- `src/app.module.ts` - NestJS module configuration
- `src/main.ts` - Application bootstrap
- `test-rotation.sh` - Test script for rotation

## Next Steps

- Add connection pooling optimization
- Implement health check endpoints
- Add metrics/monitoring for rotation events
- Extend to multiple database connections
- Add unit tests for rotation logic
