import { ConfigService, EFileFormats, IConfigServiceOptions } from '@kibibit/configit';
import { WinstonLogger } from '@kibibit/nestjs-winston';

import { YamlProjectConfig } from './yaml-config.model';

export class YamlConfigService extends ConfigService<YamlProjectConfig> {
  public logger: WinstonLogger;
  constructor(passedConfig?: Partial<YamlProjectConfig>, options: IConfigServiceOptions = {}) {
    super(YamlProjectConfig, passedConfig, options);
  }
}

export const configService = new YamlConfigService(null, {
  fileFormat: EFileFormats.yaml
}) as YamlConfigService;
