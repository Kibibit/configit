import { Injectable } from '@nestjs/common';

import { ConfigService, IVaultConfigOptions } from '@kibibit/configit';

import { DatabaseConfig } from './database.config';

// Store for the singleton ConfigService instance
let configServiceInstance: ConfigService<DatabaseConfig> | null = null;
let vaultInitialized = false;

/**
 * Initialize Configit and Vault before NestJS app starts
 * This must be called before NestFactory.create()
 */
export async function initializeConfigit(): Promise<ConfigService<DatabaseConfig>> {
  if (configServiceInstance && vaultInitialized) {
    return configServiceInstance;
  }

  // Vault configuration
  // Use LOCAL_VAULT_ADDR to avoid conflict with user's VAULT_ADDR pointing to HCP Vault
  const vaultOptions: IVaultConfigOptions = {
    endpoint: process.env.LOCAL_VAULT_ADDR || 'http://127.0.0.1:8200',
    auth: {
      methods: [
        {
          type: 'token',
          config: {
            type: 'token',
            token: process.env.LOCAL_VAULT_TOKEN || 'configit-dev-token'
          }
        }
      ]
    },
    tls: {
      enabled: false, // Dev only - use TLS in production
      verifyCertificate: false
    },
    refreshBuffer: 10 // Refresh 10 seconds before expiry (60s TTL - 10s buffer)
  };

  // Initialize Configit with Vault support
  configServiceInstance = new ConfigService<DatabaseConfig>(
    DatabaseConfig,
    undefined,
    {
      vault: vaultOptions
    }
  );

  // Initialize Vault and load secrets
  await configServiceInstance.initializeVault();
  vaultInitialized = true;

  console.log('✓ Vault initialized and secrets loaded');
  console.log(`  Database: ${configServiceInstance.config.DATABASE_HOST}:${configServiceInstance.config.DATABASE_PORT}/${configServiceInstance.config.DATABASE_NAME}`);
  console.log(`  Username: ${configServiceInstance.config.DATABASE_USERNAME}`);

  return configServiceInstance;
}

/**
 * ConfigService wrapper that integrates Configit with NestJS
 * Vault must be initialized via initializeConfigit() before NestJS app starts
 */
@Injectable()
export class AppConfigService {
  private configitService: ConfigService<DatabaseConfig>;
  public readonly config: DatabaseConfig;

  constructor() {
    if (!configServiceInstance || !vaultInitialized) {
      throw new Error('Configit not initialized. Call initializeConfigit() before NestFactory.create()');
    }
    this.configitService = configServiceInstance;
    this.config = this.configitService.config;
  }

  /**
   * Get current database credentials
   * Credentials are automatically refreshed by Configit before expiry
   */
  getDatabaseCredentials(): {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
  } {
    if (!this.config.DATABASE_USERNAME || !this.config.DATABASE_PASSWORD) {
      throw new Error('Database credentials not loaded from Vault. Call initializeVault() first.');
    }
    return {
      host: this.config.DATABASE_HOST,
      port: this.config.DATABASE_PORT,
      database: this.config.DATABASE_NAME,
      username: this.config.DATABASE_USERNAME,
      password: this.config.DATABASE_PASSWORD
    };
  }

  /**
   * Get Vault health status
   */
  getVaultHealth() {
    return this.configitService.getVaultHealth();
  }
}
