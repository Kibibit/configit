import { ConfigService } from '@kibibit/configit';

import { InternalsConfig } from './internals-config.model';
import { MainConfig } from './main-config.model';

export class UsingSharedConfigService extends ConfigService<MainConfig> {
  constructor(passedConfig?: Partial<MainConfig>) {
    super(MainConfig, passedConfig, {
      sharedConfig: [ InternalsConfig ]
    });
  }
}

export const configService = new UsingSharedConfigService() as UsingSharedConfigService;
