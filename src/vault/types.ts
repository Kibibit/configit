/**
 * Vault Integration Types
 * TypeScript interfaces and types for HashiCorp Vault integration
 */

import 'reflect-metadata';

/**
 * Vault secrets engine types
 * - kv1/kv-v1: Key-Value v1 (simple)
 * - kv2/kv-v2: Key-Value v2 (versioned, default)
 * - database: Database secrets engine (dynamic credentials)
 * - aws: AWS secrets engine
 * - azure: Azure secrets engine
 * - gcp: GCP secrets engine
 * - transit: Transit secrets engine (encryption)
 * - pki: PKI secrets engine
 * - custom: Custom engine (requires custom extraction logic)
 */
export type VaultEngineType =
  | 'kv1'
  | 'kv-v1'
  | 'kv2'
  | 'kv-v2'
  | 'database'
  | 'aws'
  | 'azure'
  | 'gcp'
  | 'transit'
  | 'pki'
  | 'custom';

/**
 * Vault configuration options for ConfigService
 */
export interface IVaultConfigOptions {
  /**
   * Vault server endpoint (must be HTTPS in production)
   */
  endpoint: string;

  /**
   * Authentication configuration
   */
  auth: IVaultAuthConfig;

  /**
   * TLS configuration
   */
  tls?: IVaultTLSConfig;

  /**
   * Refresh buffer (seconds) - default: min(10% of TTL, 300s)
   */
  refreshBuffer?: number;

  /**
   * Fallback configuration
   */
  fallback?: IVaultFallbackConfig;

  /**
   * Retry configuration
   */
  retry?: IRetryPolicy;

  /**
   * Circuit breaker configuration
   */
  circuitBreaker?: ICircuitBreakerConfig;

  /**
   * Callback invoked when a secret is refreshed.
   * Fired once per Vault path after all properties from that path are updated.
   * Config values are already set when this fires, so consumers can
   * safely read the new values from the config instance.
   */
  onSecretRefreshed?: SecretRefreshCallback;
}

/**
 * Authentication configuration with priority
 * Supports both simple single-method and array-based multi-method configs
 */
export type IVaultAuthConfig = IVaultAuthConfigSimple | IVaultAuthConfigMethods;

/**
 * Simple single-method auth config (for convenience)
 */
export type IVaultAuthConfigSimple =
  | ({ method: 'gcp' } & IGCPAuthConfig)
  | ({ method: 'aws' } & IAWSAuthConfig)
  | ({ method: 'approle' } & IAppRoleAuthConfig)
  | ({ method: 'token' } & ITokenAuthConfig);

/**
 * Multi-method auth config (for fallback chains)
 */
export interface IVaultAuthConfigMethods {
  /**
   * Authentication methods in priority order
   * Tried sequentially until one succeeds
   */
  methods: IVaultAuthMethod[];
}

/**
 * Individual authentication method
 */
export interface IVaultAuthMethod {
  type: 'gcp' | 'aws' | 'approle' | 'token';
  config: IGCPAuthConfig | IAWSAuthConfig | IAppRoleAuthConfig | ITokenAuthConfig;
}

/**
 * GCP IAM authentication
 */
export interface IGCPAuthConfig {
  type?: 'gcp';
  /** Vault role name configured for GCP auth */
  role: string;
  /** Path to service account key file (JSON). If not provided, uses ADC */
  serviceAccountKeyFile?: string;
  /** Service account email. If not provided, derived from key file or metadata */
  serviceAccountEmail?: string;
  /** JWT expiration in seconds (default: 900 = 15 minutes) */
  jwtExpiration?: number;
}

/**
 * AWS IAM authentication
 */
export interface IAWSAuthConfig {
  type?: 'aws';
  role: string;
  // Uses instance profile or environment credentials
}

/**
 * AppRole authentication
 */
export interface IAppRoleAuthConfig {
  type?: 'approle';
  /** Can be in config */
  roleId: string;
  /** MUST come from secure source */
  secretId: string;
  /** Default: 'approle' */
  mountPath?: string;
}

/**
 * Token authentication (dev only)
 */
export interface ITokenAuthConfig {
  type?: 'token';
  /** MUST come from secure source */
  token: string;
}

/**
 * TLS configuration
 */
export interface IVaultTLSConfig {
  /**
   * Require TLS (default: true, cannot be disabled)
   */
  enabled: boolean;

  /**
   * Verify server certificate (default: true)
   */
  verifyCertificate: boolean;

  /**
   * Certificate fingerprint for pinning (optional)
   */
  certificateFingerprint?: string;

  /**
   * Custom CA certificate (optional)
   */
  caCert?: string | Buffer;

  /**
   * Minimum TLS version (default: 'TLSv1.2')
   */
  minVersion?: 'TLSv1.2' | 'TLSv1.3';
}

/**
 * Fallback configuration
 */
export interface IVaultFallbackConfig {
  /**
   * Whether Vault is required (default: true)
   * If false, falls back to env/file on initialization failure
   */
  required: boolean;

  /**
   * Use cached secrets on failure (default: true)
   */
  useCacheOnFailure: boolean;

  /**
   * Maximum cache age for fallback (ms) - default: TTL or 1 hour
   */
  maxCacheAge: number;

  /**
   * Fail fast on refresh failure (default: true for required secrets)
   */
  failFast: boolean;
}

/**
 * Retry policy
 */
export interface IRetryPolicy {
  /** Default: 3 */
  maxAttempts: number;
  backoff: {
    strategy: 'exponential' | 'linear' | 'fixed';
    /** Default: 1000ms */
    initial: number;
    /** Default: 10000ms */
    max: number;
    /** Default: 2 */
    multiplier: number;
  };
  /** Default: ['ECONNREFUSED', 'ETIMEDOUT', '5xx'] */
  retryableErrors: string[];
}

/**
 * Event emitted when a Vault secret is refreshed.
 * Fired once per Vault path (not per property), so consumers
 * can react to credential rotation (e.g., reconnect a database pool).
 *
 * Secret values are intentionally excluded for security.
 */
export interface SecretRefreshEvent {
  /** The Vault path that was refreshed (e.g. 'database/creds/my-role') */
  vaultPath: string;

  /** Config property names updated from this path (e.g. ['DB_USERNAME', 'DB_PASSWORD']) */
  properties: string[];

  /** Vault engine type */
  engine: VaultEngineType;

  /** ISO timestamp of the refresh */
  timestamp: string;

  /** Number of times this path has been refreshed (1-based) */
  refreshCount: number;
}

/**
 * Callback invoked when Vault secrets are refreshed.
 * Config values are already updated when this fires.
 */
export type SecretRefreshCallback = (event: SecretRefreshEvent) => void | Promise<void>;

/**
 * Circuit breaker configuration
 */
export interface ICircuitBreakerConfig {
  /** Default: true */
  enabled: boolean;
  /** Default: 5 */
  failureThreshold: number;
  /** Default: 60000ms */
  resetTimeout: number;
  /** Default: 1 */
  halfOpenMaxRequests: number;
}

/**
 * Vault secret response structure
 */
export interface IVaultSecretResponse {
  /**
   * Secret data (structure varies by engine)
   */
  data: Record<string, any>;

  /**
   * Lease ID (for dynamic secrets)
   */
  lease_id?: string;

  /**
   * Lease duration in seconds (for dynamic secrets)
   */
  lease_duration?: number;

  /**
   * Whether the lease can be renewed
   */
  renewable?: boolean;

  /**
   * Request ID for tracing
   */
  request_id?: string;
}

/**
 * Normalized Vault secret (internal representation)
 */
export interface IVaultSecret {
  /**
   * Secret data (engine-specific structure)
   */
  data: Record<string, any>;

  /**
   * Lease ID (for dynamic secrets)
   */
  leaseId?: string;

  /**
   * Lease duration in seconds
   */
  leaseDuration: number;

  /**
   * Whether lease is renewable
   */
  renewable: boolean;

  /**
   * Metadata (for KV v2)
   */
  metadata?: {
    createdTime: string;
    deletionTime: string;
    destroyed: boolean;
    version: number;
  };
}

/**
 * Vault property metadata (from decorators)
 */
export interface VaultPropertyMetadata {
  /**
   * Vault path (from @VaultPath decorator)
   */
  path: string;

  /**
   * Engine type (from @VaultEngine decorator, or auto-detected)
   */
  engine: VaultEngineType;

  /**
   * Key name (from @VaultKey decorator, or defaults to property name)
   */
  key?: string;

  /**
   * Refresh buffer override (from @VaultRefreshBuffer decorator)
   */
  refreshBuffer?: number;

  /**
   * Whether required (from @VaultOptional decorator - false if present, true otherwise)
   */
  required: boolean;

  /**
   * Property name
   */
  propertyName: string;

  /**
   * Property type (for validation)
   */
  propertyType: string;
}

/**
 * Vault cache entry
 */
export interface VaultCacheEntry {
  /**
   * The secret value (extracted from Vault response)
   */
  value: any;

  /**
   * Original Vault secret
   */
  secret: IVaultSecret;

  /**
   * When this secret was cached
   */
  cachedAt: number;

  /**
   * When this secret expires (timestamp)
   */
  expiresAt: number;

  /**
   * When to refresh this secret (timestamp)
   */
  refreshAt: number;

  /**
   * Property name this secret is mapped to
   */
  propertyName: string;

  /**
   * Vault path
   */
  vaultPath: string;
}

/**
 * Vault health status
 */
export interface VaultHealth {
  connected: boolean;
  authenticated: boolean;
  cacheSize: number;
  refreshQueueSize: number;
  lastRefreshTime: number;
  errors: VaultError[];
}

/**
 * Vault error (sanitized)
 */
export interface VaultError {
  timestamp: number;
  path: string;
  error: string; // Sanitized
  retryable: boolean;
}

/**
 * Refresh status for a secret
 */
export interface IRefreshStatus {
  /**
   * Property name
   */
  propertyName: string;

  /**
   * Vault path
   */
  vaultPath: string;

  /**
   * Whether refresh is scheduled
   */
  scheduled: boolean;

  /**
   * When refresh is scheduled (timestamp)
   */
  refreshAt: number;

  /**
   * Time until refresh (ms)
   */
  timeUntilRefresh: number;

  /**
   * Last refresh time (timestamp)
   */
  lastRefresh: number;

  /**
   * Number of refresh attempts
   */
  refreshCount: number;
}

/**
 * Detailed Vault health information
 */
export interface IVaultHealthDetails {
  /**
   * Whether connected to Vault
   */
  connected: boolean;

  /**
   * Whether authenticated
   */
  authenticated: boolean;

  /**
   * Cache size (number of cached secrets)
   */
  cacheSize: number;

  /**
   * Refresh queue size (number of scheduled refreshes)
   */
  refreshQueueSize: number;

  /**
   * Last refresh time (timestamp)
   */
  lastRefreshTime: number;

  /**
   * Recent errors
   */
  errors: VaultError[];

  /**
   * Refresh status for all secrets
   */
  refreshStatus: IRefreshStatus[];
}
