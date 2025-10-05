/**
 * Configuration source types for restricting where config values can come from
 */
export enum EConfigSource {
  /** Configuration value must come from environment variables or CLI arguments only */
  env = 'env',
  /** Configuration value must come from config file only */
  file = 'file',
  /** Configuration value can come from any source (default) */
  both = 'both'
}

/**
 * Options for the @Configuration decorator
 */
export interface IConfigurationOptions {
  /**
   * Custom file name for this configuration (without extension)
   * When set, overrides the default .env.{environment}.{name} pattern
   *
   * @example
   * ```typescript
   * @Configuration({ fileName: 'app-config' })
   * // Results in: app-config.json instead of .env.development.my-app.json
   * ```
   */
  fileName?: string;

  /**
   * Custom file naming pattern (reserved for future use)
   * Pattern variables: {name}, {env}, {ext}
   * @internal
   */
  filePattern?: string;
}
