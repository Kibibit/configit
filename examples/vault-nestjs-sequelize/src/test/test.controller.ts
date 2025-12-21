import { Controller, Get } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize';

import { AppConfigService } from '../config/config.service';

/**
 * Test controller with database query endpoint
 * Demonstrates that queries work even when credentials rotate
 */
@Controller('test')
export class TestController {
  constructor(
    @InjectConnection()
    private readonly sequelize: Sequelize,
    private readonly configService: AppConfigService
  ) {}

  /**
   * Simple endpoint that queries the database
   * Tests that credential rotation doesn't break queries
   */
  @Get('db')
  async testDatabase(): Promise<{
    success: boolean;
    timestamp: string;
    query: string;
    result: any;
    credentials: {
      username: string;
      host: string;
      port: number;
      database: string;
    };
    vaultHealth: any;
    error?: string;
  }> {
    try {
      // Simple query to test connection
      const query = 'SELECT NOW() as current_time, version() as version';
      const [results] = await this.sequelize.query(query);

      const creds = this.configService.getDatabaseCredentials();
      const vaultHealth = this.configService.getVaultHealth();

      return {
        success: true,
        timestamp: new Date().toISOString(),
        query,
        result: results[0],
        credentials: {
          username: creds.username,
          host: creds.host,
          port: creds.port,
          database: creds.database
        },
        vaultHealth: vaultHealth ? {
          connected: vaultHealth.connected,
          cacheSize: vaultHealth.cacheSize,
          refreshQueueSize: vaultHealth.refreshQueueSize
        } : null
      };
    } catch (error: any) {
      return {
        success: false,
        timestamp: new Date().toISOString(),
        query: 'SELECT NOW()',
        result: null,
        credentials: {
          username: this.configService.config.DATABASE_USERNAME,
          host: this.configService.config.DATABASE_HOST,
          port: this.configService.config.DATABASE_PORT,
          database: this.configService.config.DATABASE_NAME
        },
        vaultHealth: null,
        error: error.message
      };
    }
  }

  /**
   * Endpoint to check current credentials
   */
  @Get('credentials')
  getCredentials(): {
    username: string;
    host: string;
    port: number;
    database: string;
    passwordLength: number;
  } {
    const creds = this.configService.getDatabaseCredentials();
    return {
      username: creds.username,
      host: creds.host,
      port: creds.port,
      database: creds.database,
      passwordLength: creds.password.length
    };
  }

  /**
   * Endpoint to check Vault health
   */
  @Get('vault-health')
  getVaultHealth() {
    return this.configService.getVaultHealth();
  }
}
