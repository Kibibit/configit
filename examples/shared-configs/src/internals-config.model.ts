import { IsNumber, IsString } from 'class-validator';

import { BaseConfig, Configuration, ConfigVariable } from '@kibibit/configit';

@Configuration()
export class InternalsConfig extends BaseConfig {
  @ConfigVariable('Shared DB Port by all services in monorepo')
  @IsNumber()
    DB_PORT: number;

  @ConfigVariable('This is the slack organization to talk to')
  @IsString()
    SLACK_ORGANIZATION_NAME: string;

  @ConfigVariable('This is the slack API to talk and report to channel "hello"')
  @IsString()
    SLACK_API_KEY: string;
}
