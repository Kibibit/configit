import { ConfigService } from '@kibibit/configit';

import { ProjectConfig } from './project-config.model';

export const configService = new ConfigService<ProjectConfig>(ProjectConfig);

console.log(configService.config.PORT);

