import { Sequelize } from 'sequelize';

import { Module, OnModuleInit } from '@nestjs/common';
import { InjectConnection, SequelizeModule } from '@nestjs/sequelize';

import { AppConfigService } from '../config/config.service';

/**
 * Database module with Sequelize configured for dynamic credential rotation
 *
 * Handles credential rotation by:
 * 1. Listening for authentication errors
 * 2. Reconnecting with fresh credentials from Configit
 * 3. Retrying failed queries after reconnection
 */
@Module({
  imports: [
    SequelizeModule.forRootAsync({
      inject: [ AppConfigService ],
      useFactory: async (configService: AppConfigService) => {
        const creds = configService.getDatabaseCredentials();

        return {
          dialect: 'postgres',
          host: creds.host,
          port: creds.port,
          database: creds.database,
          username: creds.username,
          password: creds.password,
          logging: (sql: string) => {
            // Log queries (remove in production)
            console.log(`[Sequelize] ${ sql }`);
          },
          pool: {
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000
          },
          retry: {
            max: 3,
            match: [
              /ETIMEDOUT/,
              /EHOSTUNREACH/,
              /ECONNRESET/,
              /ECONNREFUSED/,
              /ETIMEDOUT/,
              /ESOCKETTIMEDOUT/,
              /EHOSTUNREACH/,
              /EPIPE/,
              /EAI_AGAIN/,
              /SequelizeConnectionError/,
              /SequelizeConnectionRefusedError/,
              /SequelizeHostNotFoundError/,
              /SequelizeHostNotReachableError/,
              /SequelizeInvalidConnectionError/,
              /SequelizeConnectionTimedOutError/,
              // PostgreSQL authentication errors
              /password authentication failed/,
              /FATAL.*password/,
              /FATAL.*authentication/
            ]
          }
        };
      }
    })
  ]
})
export class DatabaseModule implements OnModuleInit {
  constructor(
    @InjectConnection()
    private readonly sequelize: Sequelize,
    private readonly configService: AppConfigService
  ) {}

  async onModuleInit(): Promise<void> {
    // Set up connection error handler for credential rotation
    this.setupCredentialRotationHandler();
  }

  /**
   * Handle credential rotation by reconnecting on authentication errors
   */
  private setupCredentialRotationHandler(): void {
    const originalQuery = this.sequelize.query.bind(this.sequelize);

    // Wrap query method to handle auth errors
    this.sequelize.query = async (sql: any, options?: any) => {
      try {
        return await originalQuery(sql, options);
      } catch (error: any) {
        // Check if it's an authentication error
        const isAuthError =
          error?.message?.includes('password authentication failed') ||
          (error?.message?.includes('FATAL') && error?.message?.includes('password')) ||
          error?.name === 'SequelizeConnectionError' ||
          error?.original?.code === '28P01'; // PostgreSQL invalid password error code

        if (isAuthError) {
          console.log('⚠ Authentication error detected, refreshing credentials...');

          try {
            // Get fresh credentials from Configit (may trigger refresh)
            const creds = this.configService.getDatabaseCredentials();

            // Close existing connection pool
            await this.sequelize.connectionManager.close();

            // Update connection options with new credentials
            // Access the internal options object (mutable)
            const options = (this.sequelize as any).options;
            options.host = creds.host;
            options.port = creds.port;
            options.database = creds.database;
            options.username = creds.username;
            options.password = creds.password;

            // Reconnect with new credentials
            await this.sequelize.connectionManager.initPools();
            await this.sequelize.authenticate();

            console.log('✓ Reconnected with fresh credentials');

            // Retry the original query
            return await originalQuery(sql, options);
          } catch (reconnectError: any) {
            console.error('Failed to reconnect:', reconnectError.message);
            throw reconnectError;
          }
        }

        // Not an auth error, rethrow
        throw error;
      }
    };
  }
}
