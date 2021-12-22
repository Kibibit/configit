import { ConfigService, EFileFormats, IConfigServiceOptions } from '@kibibit/configit';
import { WinstonLogger } from '@kibibit/nestjs-winston';

import { JsoncProjectConfig } from './jsonc-config.model';

export class YamlConfigService extends ConfigService<JsoncProjectConfig> {
  public logger: WinstonLogger;
  constructor(passedConfig?: Partial<JsoncProjectConfig>, options: IConfigServiceOptions = {}) {
    super(JsoncProjectConfig, passedConfig, options);
  }
}

export const configService = new YamlConfigService(null, {
  fileFormat: EFileFormats.jsonc
}) as YamlConfigService;
