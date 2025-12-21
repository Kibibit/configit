import { Module } from '@nestjs/common';

import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { TestController } from './test/test.controller';

/**
 * Main application module
 * Configures NestJS with Sequelize and Vault integration
 */
@Module({
  imports: [
    ConfigModule, // Global module - must be first
    DatabaseModule
  ],
  controllers: [TestController]
})
export class AppModule {}
