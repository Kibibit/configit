import { chain } from 'lodash';

import { ConfigService, IConfigServiceOptions } from '@kibibit/configit';
import { WinstonLogger } from '@kibibit/nestjs-winston';

import { ExtProjectConfig } from './ext-project-config.model';
import { initializeWinston } from './winston.config';

export class ExtConfigService extends ConfigService<ExtProjectConfig> {
  public logger: WinstonLogger;
  constructor(passedConfig?: Partial<ExtProjectConfig>, options: IConfigServiceOptions = {}) {
    super(ExtProjectConfig, passedConfig, options);

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

export const configService = new ExtConfigService() as ExtConfigService;
