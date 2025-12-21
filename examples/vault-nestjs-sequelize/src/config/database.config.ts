import { IsNumber, IsOptional, IsString } from 'class-validator';

import {
  BaseConfig,
  Configuration,
  ConfigVariable,
  VaultEngine,
  VaultKey,
  VaultPath } from '@kibibit/configit';

/**
 * Database configuration with Vault dynamic credentials
 *
 * Credentials are fetched from Vault database engine:
 * - Path: database/creds/configit-readonly
 * - TTL: 60 seconds (auto-refreshed before expiry)
 * - Keys: username, password
 *
 * Note: @IsOptional() allows initial validation to pass before Vault secrets are loaded.
 * After initializeVault(), credentials will be populated from Vault.
 */
@Configuration()
export class DatabaseConfig extends BaseConfig {
  @ConfigVariable('Database host')
  @IsString()
    DATABASE_HOST = 'localhost';

  @ConfigVariable('Database port')
  @IsNumber()
    DATABASE_PORT = 5433;

  @ConfigVariable('Database name')
  @IsString()
    DATABASE_NAME = 'configit_test';

  // Dynamic credentials from Vault (auto-rotated)
  // @IsOptional() allows initial validation to pass before Vault init
  @VaultPath('creds/configit-readonly')
  @VaultEngine('database')
  @VaultKey('username')
  @ConfigVariable('Database username from Vault')
  @IsOptional()
  @IsString()
    DATABASE_USERNAME?: string;

  @VaultPath('creds/configit-readonly')
  @VaultEngine('database')
  @VaultKey('password')
  @ConfigVariable('Database password from Vault')
  @IsOptional()
  @IsString()
    DATABASE_PASSWORD?: string;
}
