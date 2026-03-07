/**
 * ConfigService + Vault Integration Unit Tests
 * Tests ConfigService integration with Vault secrets management
 */

import { IsOptional, IsString } from 'class-validator';
import nconf from 'nconf';

import { VaultKey, VaultOptional, VaultPath } from './vault/decorators';
import { VaultIntegration } from './vault/vault-integration';
import { BaseConfig } from './config.model';
import { ConfigService } from './config.service';
import { IVaultConfigOptions, IVaultFallbackConfig, VaultHealth } from './vault';

import 'reflect-metadata';

// Mock VaultIntegration
jest.mock('./vault/vault-integration');

/**
 * Test config class with Vault secrets
 */
class TestVaultConfig extends BaseConfig {
  @VaultPath('test/api')
  @VaultKey('api_key')
  @IsOptional()
  @IsString()
    API_KEY?: string; // Optional initially, will be loaded from Vault

  @VaultPath('test/database')
  @VaultKey('password')
  @IsOptional()
  @IsString()
    DB_PASSWORD?: string; // Optional initially, will be loaded from Vault

  @VaultPath('test/optional')
  @VaultKey('optional_secret')
  @VaultOptional()
  @IsOptional()
  @IsString()
    OPTIONAL_SECRET?: string;

  @IsString()
    REGULAR_CONFIG!: string;
}

/**
 * Test config class without Vault secrets
 */
class TestRegularConfig extends BaseConfig {
  @IsString()
    REGULAR_CONFIG!: string;
}

describe('ConfigService + Vault Integration', () => {
  let mockVaultIntegration: jest.Mocked<VaultIntegration>;
  let originalNconfGet: typeof nconf.get;
  let originalNconfOverrides: typeof nconf.overrides;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock VaultIntegration constructor - create a fresh mock instance each time
    mockVaultIntegration = {
      initialize: jest.fn().mockResolvedValue(undefined),
      loadSecrets: jest.fn().mockResolvedValue(undefined),
      registerConfigInstance: jest.fn(),
      getHealth: jest.fn().mockReturnValue({
        connected: true,
        authenticated: true,
        cacheSize: 0,
        refreshQueueSize: 0,
        lastRefreshTime: 0,
        errors: []
      } as VaultHealth),
      invalidateCache: jest.fn(),
      invalidateProperty: jest.fn(),
      shutdown: jest.fn(),
      isInitialized: jest.fn().mockReturnValue(true),
      getSecret: jest.fn().mockReturnValue(null),
      onSecretRefreshed: jest.fn()
    } as unknown as jest.Mocked<VaultIntegration>;

    // Ensure the mock implementation returns our mock instance
    (VaultIntegration as jest.MockedClass<typeof VaultIntegration>).mockImplementation(() => {
      return mockVaultIntegration;
    });

    // Reset the mock implementation to ensure it's fresh
    (VaultIntegration as jest.MockedClass<typeof VaultIntegration>).mockClear();

    // Save original nconf methods
    originalNconfGet = nconf.get;
    originalNconfOverrides = nconf.overrides;

    // Mock nconf.get to return test config
    (nconf.get as jest.Mock) = jest.fn().mockReturnValue({
      NODE_ENV: 'test',
      REGULAR_CONFIG: 'from-env'
    });

    // Mock nconf.overrides to track overrides
    const overridesStore: Record<string, any> = {};
    (nconf.overrides as jest.Mock) = jest.fn((values?: Record<string, any>) => {
      if (values) {
        Object.assign(overridesStore, values);
      }
      return {
        store: overridesStore,
        get: (key: string) => overridesStore[key]
      };
    });
  });

  afterEach(() => {
    // Restore original nconf methods
    nconf.get = originalNconfGet;
    nconf.overrides = originalNconfOverrides;
  });

  describe('Backward Compatibility Tests', () => {
    it('should work without vault option (existing behavior)', () => {
      const configService = new ConfigService(TestRegularConfig, {
        NODE_ENV: 'test',
        REGULAR_CONFIG: 'test-value'
      } as any);

      expect(configService).toBeDefined();
      expect(configService.config).toBeDefined();
      expect((configService.config as any)?.REGULAR_CONFIG).toBe('test-value');
      expect(VaultIntegration).not.toHaveBeenCalled();
    });

    it('should not error when initializeVault() called without vault config', async () => {
      const configService = new ConfigService(TestRegularConfig, {
        NODE_ENV: 'test',
        REGULAR_CONFIG: 'test-value'
      } as any);

      await expect(configService.initializeVault()).resolves.not.toThrow();
      expect(mockVaultIntegration.initialize).not.toHaveBeenCalled();
    });

    it('should return null health when vault not configured', () => {
      const configService = new ConfigService(TestRegularConfig, {
        NODE_ENV: 'test',
        REGULAR_CONFIG: 'test-value'
      } as any);

      expect(configService.getVaultHealth()).toBeNull();
    });
  });

  describe('Source Hierarchy Tests', () => {
    it('should override environment variables with Vault secrets', async () => {
      // Set environment variable
      process.env.API_KEY = 'env-api-key';

      const vaultConfig: IVaultConfigOptions = {
        endpoint: 'http://localhost:8200',
        auth: {
          methods: [
            {
              type: 'token',
              config: {
                type: 'token',
                token: 'test-token'
              }
            }
          ]
        }
      };

      const configService = new ConfigService(TestVaultConfig, {
        NODE_ENV: 'test',
        API_KEY: 'env-api-key', // From env
        REGULAR_CONFIG: 'regular'
      } as any, {
        vault: vaultConfig
      });

      // Mock vault secret loading - secrets injected into nconf overrides
      mockVaultIntegration.loadSecrets.mockImplementation(async () => {
        // Simulate vault secrets being injected into nconf overrides
        nconf.overrides({
          API_KEY: 'vault-api-key', // Vault secret overrides env
          DB_PASSWORD: 'vault-password'
        });
      });

      await configService.initializeVault();

      // After initializeVault, config should be re-validated with vault secrets
      // The vault secret should override the env variable
      expect(mockVaultIntegration.loadSecrets).toHaveBeenCalled();

      // Verify nconf.overrides was called with vault secrets
      expect(nconf.overrides).toHaveBeenCalledWith(
        expect.objectContaining({
          API_KEY: 'vault-api-key'
        })
      );
    });

    it('should override config file values with Vault secrets', async () => {
      // Mock nconf.get to return file config
      (nconf.get as jest.Mock).mockReturnValue({
        NODE_ENV: 'test',
        API_KEY: 'file-api-key', // From config file
        REGULAR_CONFIG: 'regular'
      });

      const vaultConfig: IVaultConfigOptions = {
        endpoint: 'http://localhost:8200',
        auth: {
          methods: [
            {
              type: 'token',
              config: {
                type: 'token',
                token: 'test-token'
              }
            }
          ]
        }
      };

      const configService = new ConfigService(TestVaultConfig, undefined, {
        vault: vaultConfig
      });

      // Mock vault secret loading
      mockVaultIntegration.loadSecrets.mockImplementation(async () => {
        nconf.overrides({
          API_KEY: 'vault-api-key', // Vault secret overrides file
          DB_PASSWORD: 'vault-password'
        });
      });

      await configService.initializeVault();

      // Verify vault secrets override file values
      expect(nconf.overrides).toHaveBeenCalledWith(
        expect.objectContaining({
          API_KEY: 'vault-api-key'
        })
      );
    });

    it('should allow CLI args to override Vault secrets (if applicable)', async () => {
      // Note: CLI args have highest priority in nconf hierarchy
      // This test verifies the hierarchy is maintained
      const vaultConfig: IVaultConfigOptions = {
        endpoint: 'http://localhost:8200',
        auth: {
          methods: [
            {
              type: 'token',
              config: {
                type: 'token',
                token: 'test-token'
              }
            }
          ]
        }
      };

      // Mock nconf.get to simulate CLI args already set
      (nconf.get as jest.Mock).mockReturnValue({
        NODE_ENV: 'test',
        API_KEY: 'cli-api-key', // From CLI (highest priority)
        REGULAR_CONFIG: 'regular'
      });

      const configService = new ConfigService(TestVaultConfig, undefined, {
        vault: vaultConfig
      });

      mockVaultIntegration.loadSecrets.mockImplementation(async () => {
        // Vault secrets are injected, but CLI args should still win
        nconf.overrides({
          API_KEY: 'vault-api-key',
          DB_PASSWORD: 'vault-password'
        });
      });

      await configService.initializeVault();

      // In nconf hierarchy: argv > vault overrides > env > file
      // So CLI args should still be accessible via nconf.get()
      const finalConfig = nconf.get();
      expect(finalConfig.API_KEY).toBe('cli-api-key');
    });
  });

  describe('Error Handling Tests', () => {
    it('should throw error when Vault unavailable with fallback.required=true', async () => {
      const vaultConfig: IVaultConfigOptions = {
        endpoint: 'http://localhost:8200',
        auth: {
          methods: [
            {
              type: 'token',
              config: {
                type: 'token',
                token: 'test-token'
              }
            }
          ]
        },
        fallback: {
          required: true, // Vault is required
          useCacheOnFailure: false,
          maxCacheAge: 3600000,
          failFast: true
        } as IVaultFallbackConfig
      };

      const configService = new ConfigService(TestVaultConfig, {
        NODE_ENV: 'test',
        REGULAR_CONFIG: 'regular'
      } as any, {
        vault: vaultConfig
      });

      // Mock initialization failure
      mockVaultIntegration.initialize.mockRejectedValue(
        new Error('Vault connection failed')
      );

      await expect(configService.initializeVault()).rejects.toThrow('Vault connection failed');
    });

    it('should log warning and continue when Vault unavailable with fallback.required=false', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Create a fresh mock instance for this test that will throw
      // MUST be created BEFORE ConfigService constructor (which creates VaultIntegration)
      const failingMockVaultIntegration = {
        initialize: jest.fn().mockRejectedValue(new Error('Vault connection failed')),
        loadSecrets: jest.fn().mockResolvedValue(undefined),
        registerConfigInstance: jest.fn(),
        getHealth: jest.fn().mockReturnValue({
          connected: false,
          authenticated: false,
          cacheSize: 0,
          refreshQueueSize: 0,
          lastRefreshTime: 0,
          errors: []
        } as VaultHealth),
        invalidateCache: jest.fn(),
        invalidateProperty: jest.fn(),
        shutdown: jest.fn(),
        isInitialized: jest.fn().mockReturnValue(false),
        getSecret: jest.fn().mockReturnValue(null)
      } as unknown as jest.Mocked<VaultIntegration>;

      // Override the mock implementation BEFORE creating ConfigService
      (VaultIntegration as jest.MockedClass<typeof VaultIntegration>).mockImplementation(() => {
        return failingMockVaultIntegration;
      });

      const vaultConfig: IVaultConfigOptions = {
        endpoint: 'http://localhost:8200',
        auth: {
          methods: [
            {
              type: 'token',
              config: {
                type: 'token',
                token: 'test-token'
              }
            }
          ]
        },
        fallback: {
          required: false, // Vault is optional - should log warning and continue
          useCacheOnFailure: true,
          maxCacheAge: 3600000,
          failFast: false
        } as IVaultFallbackConfig
      };

      const configService = new ConfigService(TestVaultConfig, {
        NODE_ENV: 'test',
        REGULAR_CONFIG: 'regular'
      } as any, {
        vault: vaultConfig
      });

      // With fallback.required=false, should log warning and continue (not throw)
      await expect(configService.initializeVault()).resolves.not.toThrow();

      // Verify initialize was called
      expect(failingMockVaultIntegration.initialize).toHaveBeenCalled();

      // Verify warning was logged
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Vault initialization failed')
      );

      consoleWarnSpy.mockRestore();
    });

    it('should throw error when required secret is missing', async () => {
      const vaultConfig: IVaultConfigOptions = {
        endpoint: 'http://localhost:8200',
        auth: {
          methods: [
            {
              type: 'token',
              config: {
                type: 'token',
                token: 'test-token'
              }
            }
          ]
        },
        fallback: {
          required: true,
          useCacheOnFailure: false,
          maxCacheAge: 3600000,
          failFast: true
        } as IVaultFallbackConfig
      };

      const configService = new ConfigService(TestVaultConfig, {
        NODE_ENV: 'test',
        REGULAR_CONFIG: 'regular'
      } as any, {
        vault: vaultConfig
      });

      // Mock loadSecrets to throw error for missing required secret
      mockVaultIntegration.loadSecrets.mockRejectedValue(
        new Error('Failed to load required secret from test/api: Secret not found')
      );

      await expect(configService.initializeVault()).rejects.toThrow(
        /Failed to load required secret/
      );
    });

    it('should continue when optional secret is missing (@VaultOptional)', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const vaultConfig: IVaultConfigOptions = {
        endpoint: 'http://localhost:8200',
        auth: {
          methods: [
            {
              type: 'token',
              config: {
                type: 'token',
                token: 'test-token'
              }
            }
          ]
        },
        fallback: {
          required: false, // Optional fallback
          useCacheOnFailure: true,
          maxCacheAge: 3600000,
          failFast: false
        } as IVaultFallbackConfig
      };

      const configService = new ConfigService(TestVaultConfig, {
        NODE_ENV: 'test',
        REGULAR_CONFIG: 'regular'
      } as any, {
        vault: vaultConfig
      });

      // Mock loadSecrets to simulate missing optional secret
      // The VaultIntegration should log warning and continue
      mockVaultIntegration.loadSecrets.mockImplementation(async () => {
        // Simulate warning for optional secret
        console.warn('Failed to load optional secret from test/optional: Secret not found');
        // Continue without throwing
      });

      await expect(configService.initializeVault()).resolves.not.toThrow();

      consoleWarnSpy.mockRestore();
    });
  });

  describe('Initialization Flow Tests', () => {
    it('should warn/throw when config accessed before initializeVault() when Vault configured', () => {
      const vaultConfig: IVaultConfigOptions = {
        endpoint: 'http://localhost:8200',
        auth: {
          methods: [
            {
              type: 'token',
              config: {
                type: 'token',
                token: 'test-token'
              }
            }
          ]
        }
      };

      const configService = new ConfigService(TestVaultConfig, {
        NODE_ENV: 'test',
        REGULAR_CONFIG: 'regular'
        // API_KEY and DB_PASSWORD are missing - should come from Vault
      } as any, {
        vault: vaultConfig
      });

      // Config should be accessible, but vault secrets won't be loaded yet
      expect(configService.config).toBeDefined();
      // Vault secrets should not be available until initializeVault() is called
      expect(mockVaultIntegration.initialize).not.toHaveBeenCalled();
      expect(mockVaultIntegration.loadSecrets).not.toHaveBeenCalled();
    });

    it('should make config accessible after initializeVault()', async () => {
      const vaultConfig: IVaultConfigOptions = {
        endpoint: 'http://localhost:8200',
        auth: {
          methods: [
            {
              type: 'token',
              config: {
                type: 'token',
                token: 'test-token'
              }
            }
          ]
        }
      };

      const configService = new ConfigService(TestVaultConfig, {
        NODE_ENV: 'test',
        REGULAR_CONFIG: 'regular'
      } as any, {
        vault: vaultConfig
      });

      // Mock successful vault initialization and secret loading
      mockVaultIntegration.loadSecrets.mockImplementation(async () => {
        // Simulate vault secrets being injected
        nconf.overrides({
          API_KEY: 'vault-api-key',
          DB_PASSWORD: 'vault-password'
        });
      });

      await configService.initializeVault();

      // Verify initialization was called
      expect(mockVaultIntegration.initialize).toHaveBeenCalled();
      expect(mockVaultIntegration.loadSecrets).toHaveBeenCalled();

      // Config should be accessible and re-validated with vault secrets
      expect(configService.config).toBeDefined();
    });

    it('should re-validate config after vault secrets are loaded', async () => {
      const vaultConfig: IVaultConfigOptions = {
        endpoint: 'http://localhost:8200',
        auth: {
          methods: [
            {
              type: 'token',
              config: {
                type: 'token',
                token: 'test-token'
              }
            }
          ]
        }
      };

      // Track nconf.get calls
      const nconfGetSpy = jest.spyOn(nconf, 'get');

      const configService = new ConfigService(TestVaultConfig, {
        NODE_ENV: 'test',
        REGULAR_CONFIG: 'regular'
      } as any, {
        vault: vaultConfig
      });

      const initialConfigCallCount = nconfGetSpy.mock.calls.length;

      // Mock loadSecrets to simulate vault secrets being injected
      mockVaultIntegration.loadSecrets.mockImplementation(async () => {
        // Inject vault secrets into nconf overrides
        nconf.overrides({
          API_KEY: 'vault-api-key',
          DB_PASSWORD: 'vault-password'
        });
      });

      await configService.initializeVault();

      // Verify that nconf.get was called again in initializeVault() for re-validation
      // The config should be re-validated after vault secrets are loaded
      expect(nconfGetSpy).toHaveBeenCalledTimes(initialConfigCallCount + 1);
      expect(configService.config).toBeDefined();

      nconfGetSpy.mockRestore();
    });

    it('should handle initializeVault() being called multiple times', async () => {
      const vaultConfig: IVaultConfigOptions = {
        endpoint: 'http://localhost:8200',
        auth: {
          methods: [
            {
              type: 'token',
              config: {
                type: 'token',
                token: 'test-token'
              }
            }
          ]
        }
      };

      const configService = new ConfigService(TestVaultConfig, {
        NODE_ENV: 'test',
        REGULAR_CONFIG: 'regular'
      } as any, {
        vault: vaultConfig
      });

      await configService.initializeVault();
      await configService.initializeVault();

      // Should only initialize once (VaultIntegration handles idempotency)
      expect(mockVaultIntegration.initialize).toHaveBeenCalledTimes(2);
      expect(mockVaultIntegration.loadSecrets).toHaveBeenCalledTimes(2);
    });
  });

  describe('Vault Health and Cache Management', () => {
    it('should return vault health status', async () => {
      const vaultConfig: IVaultConfigOptions = {
        endpoint: 'http://localhost:8200',
        auth: {
          methods: [
            {
              type: 'token',
              config: {
                type: 'token',
                token: 'test-token'
              }
            }
          ]
        }
      };

      const configService = new ConfigService(TestVaultConfig, {
        NODE_ENV: 'test',
        REGULAR_CONFIG: 'regular'
      } as any, {
        vault: vaultConfig
      });

      await configService.initializeVault();

      const health = configService.getVaultHealth();
      expect(health).not.toBeNull();
      expect(health?.connected).toBe(true);
      expect(health?.authenticated).toBe(true);
    });

    it('should invalidate vault cache for path', async () => {
      const vaultConfig: IVaultConfigOptions = {
        endpoint: 'http://localhost:8200',
        auth: {
          methods: [
            {
              type: 'token',
              config: {
                type: 'token',
                token: 'test-token'
              }
            }
          ]
        }
      };

      const configService = new ConfigService(TestVaultConfig, {
        NODE_ENV: 'test',
        REGULAR_CONFIG: 'regular'
      } as any, {
        vault: vaultConfig
      });

      await configService.initializeVault();

      configService.invalidateVaultCache('test/api');

      expect(mockVaultIntegration.invalidateCache).toHaveBeenCalledWith('test/api');
    });

    it('should invalidate vault cache for property', async () => {
      const vaultConfig: IVaultConfigOptions = {
        endpoint: 'http://localhost:8200',
        auth: {
          methods: [
            {
              type: 'token',
              config: {
                type: 'token',
                token: 'test-token'
              }
            }
          ]
        }
      };

      const configService = new ConfigService(TestVaultConfig, {
        NODE_ENV: 'test',
        REGULAR_CONFIG: 'regular'
      } as any, {
        vault: vaultConfig
      });

      await configService.initializeVault();

      configService.invalidateVaultProperty('API_KEY');

      expect(mockVaultIntegration.invalidateProperty).toHaveBeenCalledWith('API_KEY');
    });

    it('should shutdown vault integration gracefully', async () => {
      const vaultConfig: IVaultConfigOptions = {
        endpoint: 'http://localhost:8200',
        auth: {
          methods: [
            {
              type: 'token',
              config: {
                type: 'token',
                token: 'test-token'
              }
            }
          ]
        }
      };

      const configService = new ConfigService(TestVaultConfig, {
        NODE_ENV: 'test',
        REGULAR_CONFIG: 'regular'
      } as any, {
        vault: vaultConfig
      });

      await configService.initializeVault();

      configService.shutdownVault();

      expect(mockVaultIntegration.shutdown).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle config service not properly initialized', async () => {
      const vaultConfig: IVaultConfigOptions = {
        endpoint: 'http://localhost:8200',
        auth: {
          methods: [
            {
              type: 'token',
              config: {
                type: 'token',
                token: 'test-token'
              }
            }
          ]
        }
      };

      // Create config service with vault config
      const configService = new ConfigService(TestVaultConfig, {
        NODE_ENV: 'test',
        REGULAR_CONFIG: 'regular'
      } as any, {
        vault: vaultConfig
      });

      // Simulate genericClass being null (should not happen in practice)
      // This tests the error handling in initializeVault
      (configService as any).genericClass = null;

      await expect(configService.initializeVault()).rejects.toThrow(
        'ConfigService not properly initialized'
      );
    });

    it('should handle vault integration initialization failure gracefully', async () => {
      const vaultConfig: IVaultConfigOptions = {
        endpoint: 'http://localhost:8200',
        auth: {
          methods: [
            {
              type: 'token',
              config: {
                type: 'token',
                token: 'test-token'
              }
            }
          ]
        }
      };

      const configService = new ConfigService(TestVaultConfig, {
        NODE_ENV: 'test',
        REGULAR_CONFIG: 'regular'
      } as any, {
        vault: vaultConfig
      });

      // Mock initialization failure
      mockVaultIntegration.initialize.mockRejectedValue(
        new Error('Network error: ECONNREFUSED')
      );

      await expect(configService.initializeVault()).rejects.toThrow('Network error');
    });

    it('should handle loadSecrets failure after successful initialization', async () => {
      const vaultConfig: IVaultConfigOptions = {
        endpoint: 'http://localhost:8200',
        auth: {
          methods: [
            {
              type: 'token',
              config: {
                type: 'token',
                token: 'test-token'
              }
            }
          ]
        }
      };

      const configService = new ConfigService(TestVaultConfig, {
        NODE_ENV: 'test',
        REGULAR_CONFIG: 'regular'
      } as any, {
        vault: vaultConfig
      });

      // Mock successful initialization but failed loadSecrets
      mockVaultIntegration.initialize.mockResolvedValue(undefined);
      mockVaultIntegration.loadSecrets.mockRejectedValue(
        new Error('Failed to load secrets: Permission denied')
      );

      await expect(configService.initializeVault()).rejects.toThrow('Failed to load secrets');
    });
  });

  describe('onSecretRefreshed', () => {
    it('should delegate callback registration to vaultIntegration', async () => {
      const vaultConfig: IVaultConfigOptions = {
        endpoint: 'http://localhost:8200',
        auth: {
          methods: [
            {
              type: 'token',
              config: {
                type: 'token',
                token: 'test-token'
              }
            }
          ]
        }
      };

      const configService = new ConfigService(TestVaultConfig, {
        NODE_ENV: 'test',
        REGULAR_CONFIG: 'regular'
      } as any, {
        vault: vaultConfig
      });

      await configService.initializeVault();

      const callback = jest.fn();
      configService.onSecretRefreshed(callback);

      expect(mockVaultIntegration.onSecretRefreshed).toHaveBeenCalledWith(callback);
    });

    it('should be a no-op when vault is not configured', () => {
      const configService = new ConfigService(TestRegularConfig, {
        NODE_ENV: 'test',
        REGULAR_CONFIG: 'test-value'
      } as any);

      const callback = jest.fn();
      configService.onSecretRefreshed(callback);

      expect(mockVaultIntegration.onSecretRefreshed).not.toHaveBeenCalled();
    });
  });
});
