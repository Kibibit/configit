import { ConfigService, IConfigServiceOptions } from '@kibibit/configit';
import { WinstonLogger } from '@kibibit/nestjs-winston';

import { YamlConfig } from './yaml-config.model';

export class YamlConfigService extends ConfigService<YamlConfig> {
  public logger: WinstonLogger;
  constructor(passedConfig?: Partial<YamlConfig>, options: IConfigServiceOptions = {}) {
    super(YamlConfig, passedConfig, options);
  }
}

export const configService = new YamlConfigService(null, {
  useYaml: true
}) as YamlConfigService;
