import { chain } from 'lodash';

import { ConfigService, IConfigServiceOptions } from '@kibibit/configit';
import { WinstonLogger } from '@kibibit/nestjs-winston';

import { ProjectConfig } from './config.model';
import { initializeWinston } from './winston.config';

export class ProjectConfigService extends ConfigService<ProjectConfig> {
  public logger: WinstonLogger;
  constructor(passedConfig?: Partial<ProjectConfig>, options: IConfigServiceOptions = {}) {
    super(ProjectConfig, passedConfig, options);

    initializeWinston(this.appRoot);
    this.logger = new WinstonLogger('');
  }

  getSlackApiObject() {
    const slackApiObject = chain(this.toPlainObject())
      .pickBy((value, key) => key.startsWith('SLACK_'))
      .mapKeys((value, key) => key.replace(/^SLACK_/i, ''))
      .mapKeys((value, key) => key.toLowerCase())
      .value();

    return slackApiObject;
  }
}

export const configService = new ProjectConfigService() as ProjectConfigService;
