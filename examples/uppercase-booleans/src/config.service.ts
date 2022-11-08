import { ConfigService as BaseConfigService, IConfigServiceOptions } from '@kibibit/configit';

import { ProjectConfig } from './project-config.model';

class ConfigService extends BaseConfigService<ProjectConfig> {
  constructor(passedConfig?: Partial<ProjectConfig>, options: IConfigServiceOptions = {}) {
    super(ProjectConfig, passedConfig, {
      skipSchema: true,
      ...options
    });
  }
}

export const configService = new ConfigService() as ConfigService;
