import { Global, Module } from '@nestjs/common';

import { AppConfigService } from './config.service';

/**
 * Global config module that provides AppConfigService to all modules
 */
@Global()
@Module({
  providers: [AppConfigService],
  exports: [AppConfigService]
})
export class ConfigModule {}

