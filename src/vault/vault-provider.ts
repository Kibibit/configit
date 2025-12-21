/**
 * VaultProvider
 * Vault client wrapper for HashiCorp Vault integration
 */

import { GoogleAuth } from 'google-auth-library';
import vault, { VaultOptions } from 'node-vault';

import {
  IAppRoleAuthConfig,
  IAWSAuthConfig,
  IGCPAuthConfig,
  IRetryPolicy,
  ITokenAuthConfig,
  IVaultAuthMethod,
  IVaultConfigOptions,
  IVaultSecret,
  IVaultSecretResponse,
  VaultEngineType
} from './types';

/**
 * VaultProvider - Manages Vault connections and operations
 */
export class VaultProvider {
  private client: any;
  private config: IVaultConfigOptions;
  private currentToken: string | null = null;
  private tokenExpiry = 0;
  private retryPolicy: IRetryPolicy;
  private isConnected = false;

  constructor(config: IVaultConfigOptions) {
    this.config = config;
    this.retryPolicy = config.retry || {
      maxAttempts: 3,
      backoff: {
        strategy: 'exponential',
        initial: 1000,
        max: 10000,
        multiplier: 2
      },
      retryableErrors: [ 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', '5xx' ]
    };
  }

  /**
   * Initialize Vault connection and authenticate
   */
  async initialize(): Promise<void> {
    // Validate TLS configuration
    this.validateTLS();

    // Create Vault client
    const vaultOptions: VaultOptions = {
      endpoint: this.config.endpoint,
      apiVersion: 'v1'
    };

    // Configure TLS
    if (this.config.tls) {
      vaultOptions.requestOptions = {
        ...vaultOptions.requestOptions,
        rejectUnauthorized: this.config.tls.verifyCertificate !== false
      };

      if (this.config.tls.caCert) {
        vaultOptions.requestOptions = {
          ...vaultOptions.requestOptions,
          ca: this.config.tls.caCert
        };
      }
    }

    this.client = vault(vaultOptions);

    // Authenticate using priority order
    await this.authenticate();
    this.isConnected = true;
  }

  /**
   * Connect to Vault (alias for initialize)
   */
  async connect(): Promise<void> {
    await this.initialize();
  }

  /**
   * Disconnect from Vault
   */
  async disconnect(): Promise<void> {
    this.currentToken = null;
    this.tokenExpiry = 0;
    this.isConnected = false;
  }

  /**
   * Check if connected and authenticated
   */
  connected(): boolean {
    return this.isConnected && this.currentToken !== null;
  }

  /**
   * Check if token has expired
   */
  isTokenExpired(): boolean {
    if (this.tokenExpiry === 0) {
      // No expiry tracking (e.g., token auth)
      return false;
    }
    // Add small buffer (5s) to avoid edge cases
    return Date.now() >= (this.tokenExpiry - 5000);
  }

  /**
   * Re-authenticate if token is expired
   */
  async ensureAuthenticated(): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Not connected to Vault');
    }
    if (this.isTokenExpired()) {
      await this.authenticate();
    }
  }

  /**
   * Read secret from Vault with engine type support
   */
  async readSecret(path: string, engine: VaultEngineType = 'kv2'): Promise<IVaultSecret> {
    await this.ensureAuthenticated();

    // Construct full path based on engine type
    let fullPath: string;
    switch (engine) {
      case 'kv1':
      case 'kv-v1':
        fullPath = `secret/${ path }`;
        break;
      case 'kv2':
      case 'kv-v2':
        fullPath = `secret/data/${ path }`;
        break;
      case 'database':
        fullPath = path.startsWith('database/') ? path : `database/${ path }`;
        break;
      default:
        fullPath = path;
    }

    return this.read(fullPath);
  }

  /**
   * Validate TLS configuration
   */
  private validateTLS(): void {
    const tlsConfig = this.config.tls || { enabled: true, verifyCertificate: true };
    const endpoint = this.config.endpoint.toLowerCase();

    // Enforce HTTPS in production (allow HTTP only for localhost)
    if (tlsConfig.enabled !== false) {
      if (!endpoint.startsWith('https://') && !endpoint.startsWith('http://127.0.0.1') && !endpoint.startsWith('http://localhost')) {
        throw new Error('TLS is required for Vault communication. Use HTTPS endpoint or set tls.enabled=false for local development only.');
      }
    }

    // Warn if HTTP is used (even for localhost)
    if (endpoint.startsWith('http://')) {
      console.warn('WARNING: Using HTTP for Vault connection. This should only be used for local development.');
    }
  }

  /**
   * Authenticate using priority order: GCP IAM → AWS IAM → AppRole → Token
   */
  private async authenticate(): Promise<void> {
    // Normalize auth config to method array
    const methods = this.normalizeAuthConfig();

    if (methods.length === 0) {
      throw new Error('No authentication methods configured');
    }

    const errors: Error[] = [];

    for (const method of methods) {
      try {
        await this.authenticateWithMethod(method);
        // Success, exit
        return;
      } catch (error) {
        errors.push(error as Error);
        // Continue to next method
      }
    }

    // All methods failed
    const errorMessages = errors.map((e) => e.message).join('; ');
    throw new Error(`All authentication methods failed: ${ errorMessages }`);
  }

  /**
   * Normalize auth config to method array
   * Supports both simple single-method and array-based configs
   */
  private normalizeAuthConfig(): IVaultAuthMethod[] {
    const auth = this.config.auth;

    if (!auth) {
      return [];
    }

    // Check if it's the array-based format
    if ('methods' in auth && Array.isArray(auth.methods)) {
      return auth.methods;
    }

    // It's the simple format with 'method' property
    if ('method' in auth) {
      const simpleAuth = auth as { method: string };
      return [ {
        type: simpleAuth.method as 'gcp' | 'aws' | 'approle' | 'token',
        config: auth
      } ];
    }

    return [];
  }

  /**
   * Authenticate with a specific method
   */
  private async authenticateWithMethod(method: IVaultAuthMethod): Promise<void> {
    switch (method.type) {
      case 'gcp':
        await this.authenticateGCP(method.config as IGCPAuthConfig);
        break;
      case 'aws':
        await this.authenticateAWS(method.config as IAWSAuthConfig);
        break;
      case 'approle':
        await this.authenticateAppRole(method.config as IAppRoleAuthConfig);
        break;
      case 'token':
        await this.authenticateToken(method.config as ITokenAuthConfig);
        break;
      default:
        throw new Error(`Unsupported authentication method: ${ method.type }`);
    }
  }

  /**
   * Authenticate using GCP IAM
   * Uses Google IAM API to sign a JWT, then exchanges it for a Vault token
   */
  private async authenticateGCP(config: IGCPAuthConfig): Promise<void> {
    const { role, serviceAccountKeyFile, serviceAccountEmail } = config;

    if (!role) {
      throw new Error('GCP IAM authentication requires a role name');
    }

    try {
      // Get credentials from key file or Application Default Credentials
      const auth = new GoogleAuth({
        keyFile: serviceAccountKeyFile,
        scopes: [ 'https://www.googleapis.com/auth/cloud-platform' ]
      });

      // Get the service account email
      const credentials = await auth.getCredentials();
      const saEmail = serviceAccountEmail || credentials.client_email;

      if (!saEmail) {
        throw new Error('Could not determine service account email');
      }

      // Create JWT claims for Vault
      const now = Math.floor(Date.now() / 1000);
      // Default JWT expiration: 15 minutes
      const expiry = config.jwtExpiration || 900;

      const jwtClaims = {
        aud: `vault/${ role }`,
        sub: saEmail,
        iat: now,
        exp: now + expiry
      };

      // Use Google IAM API to sign the JWT
      // This ensures Vault can verify using Google's public keys
      const signedJwt = await this.signJwtWithGoogleIAM(auth, saEmail, jwtClaims);

      // Call Vault's GCP auth endpoint
      const response = await this.client.write('auth/gcp/login', {
        role,
        jwt: signedJwt
      });

      if (!response?.auth?.client_token) {
        throw new Error('GCP IAM authentication failed: No token received');
      }

      this.currentToken = response.auth.client_token;
      this.client.token = this.currentToken;

      // Track token expiry for auto-renewal
      const tokenTTL = response.auth.lease_duration || 0;
      if (tokenTTL > 0) {
        this.tokenExpiry = Date.now() + (tokenTTL * 1000);
      }
    } catch (error: any) {
      const message = error.message || 'Unknown GCP auth error';
      throw new Error(`GCP IAM authentication failed: ${ message }`);
    }
  }

  /**
   * Sign a JWT using Google's IAM signJwt API
   * This allows Vault to verify the signature using Google's public keys
   */
  private async signJwtWithGoogleIAM(
    auth: GoogleAuth,
    serviceAccountEmail: string,
    claims: object
  ): Promise<string> {
    const client = await auth.getClient();

    // Build the JWT payload (without signature) as a JSON string
    const payload = JSON.stringify(claims);

    // Call IAM signJwt API
    const iamUrl = `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${ serviceAccountEmail }:signJwt`;

    const response = await client.request({
      url: iamUrl,
      method: 'POST',
      data: { payload }
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const signedJwt = (response.data as any).signedJwt;

    if (!signedJwt) {
      throw new Error('Failed to sign JWT with Google IAM');
    }

    return signedJwt;
  }

  /**
   * Authenticate using AWS IAM
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private authenticateAWS(_config: IAWSAuthConfig): Promise<void> {
    // Note: AWS IAM auth requires AWS SDK and proper IAM role setup
    // For now, we'll throw an error indicating it needs to be implemented
    // In a full implementation, this would:
    // 1. Get AWS credentials from instance profile or environment
    // 2. Create AWS signature
    // 3. Call Vault AWS auth endpoint
    throw new Error('AWS IAM authentication not yet implemented. Use AppRole or Token for now.');
  }

  /**
   * Authenticate using AppRole
   */
  private async authenticateAppRole(config: IAppRoleAuthConfig): Promise<void> {
    if (!config.roleId || !config.secretId) {
      throw new Error('AppRole authentication requires roleId and secretId');
    }

    const mountPath = config.mountPath || 'approle';
    const response = await this.client.approleLogin({
      role_id: config.roleId,
      secret_id: config.secretId,
      mount_point: mountPath
    });

    if (!response?.auth?.client_token) {
      throw new Error('AppRole authentication failed: No token received');
    }

    this.currentToken = response.auth.client_token;
    this.client.token = this.currentToken;

    // Track token expiry for auto-renewal
    const tokenTTL = response.auth.lease_duration || 0;
    if (tokenTTL > 0) {
      this.tokenExpiry = Date.now() + (tokenTTL * 1000);
    }
  }

  /**
   * Authenticate using Token
   */
  private async authenticateToken(config: ITokenAuthConfig): Promise<void> {
    if (!config.token) {
      throw new Error('Token authentication requires a token');
    }

    this.currentToken = config.token;
    this.client.token = this.currentToken;

    // Verify token is valid by checking token lookup
    try {
      await this.client.tokenLookupSelf();
    } catch (error) {
      throw new Error(`Token authentication failed: Invalid token`);
    }
  }

  /**
   * Read secret from Vault
   */
  async read(path: string): Promise<IVaultSecret> {
    return this.executeWithRetry(async () => {
      const response = await this.client.read(path);

      if (!response) {
        throw new Error(`Secret not found at path: ${ this.sanitizePath(path) }`);
      }

      return this.normalizeSecretResponse(response);
    });
  }

  /**
   * Renew lease for dynamic secret
   */
  async renewLease(leaseId: string, increment?: number): Promise<void> {
    return this.executeWithRetry(async () => {
      await this.client.write('sys/leases/renew', {
        lease_id: leaseId,
        increment: increment
      });
    });
  }

  /**
   * Normalize Vault secret response to internal format
   */
  private normalizeSecretResponse(response: IVaultSecretResponse): IVaultSecret {
    // Handle KV v2 nested structure
    const data = response.data?.data || response.data || {};

    return {
      data,
      leaseId: response.lease_id,
      leaseDuration: response.lease_duration || 0,
      renewable: response.renewable || false,
      metadata: response.data?.metadata
    };
  }

  /**
   * Execute operation with retry logic
   */
  private async executeWithRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.retryPolicy.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;

        // Check if error is retryable - don't retry non-retryable errors
        if (!this.isRetryableError(error)) {
          throw error;
        }

        // Don't retry on last attempt
        if (attempt === this.retryPolicy.maxAttempts) {
          break;
        }

        // Calculate backoff delay
        const delay = this.calculateBackoff(attempt);
        await this.sleep(delay);
      }
    }

    throw lastError || new Error('Operation failed after retries');
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    const errorMessage = error.message || '';
    const errorCode = error.code || '';
    const statusCode = error.statusCode || error.response?.statusCode;

    // Check against retryable error patterns
    for (const pattern of this.retryPolicy.retryableErrors) {
      if (pattern.includes('xx') && statusCode) {
        // Handle HTTP status code patterns like '5xx'
        const codePrefix = parseInt(pattern[0]);
        const statusPrefix = Math.floor(statusCode / 100);
        if (statusPrefix === codePrefix) {
          return true;
        }
      } else if (errorMessage.includes(pattern) || errorCode.includes(pattern)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Calculate backoff delay
   */
  private calculateBackoff(attempt: number): number {
    const { strategy, initial, max, multiplier } = this.retryPolicy.backoff;

    let delay: number;

    switch (strategy) {
      case 'exponential':
        delay = initial * Math.pow(multiplier, attempt - 1);
        break;
      case 'linear':
        delay = initial * attempt;
        break;
      case 'fixed':
      default:
        delay = initial;
        break;
    }

    return Math.min(delay, max);
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Sanitize path for logging (mask sensitive segments)
   */
  private sanitizePath(path: string): string {
    // Mask last segment if potentially sensitive
    const segments = path.split('/');
    if (segments.length > 0) {
      const lastSegment = segments[segments.length - 1];
      // Simple check for potentially sensitive names
      const sensitivePatterns = [ /password/i, /secret/i, /key/i, /token/i, /credential/i ];
      if (sensitivePatterns.some((pattern) => pattern.test(lastSegment))) {
        segments[segments.length - 1] = '***';
      }
    }
    return segments.join('/');
  }

  /**
   * Get current token (for debugging, never log this)
   */
  getToken(): string | null {
    return this.currentToken;
  }

  /**
   * Check if authenticated
   */
  isAuthenticated(): boolean {
    return this.currentToken !== null;
  }
}
