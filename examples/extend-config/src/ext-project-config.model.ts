import { IsNumber, IsString } from 'class-validator';

import { BaseConfig, Configuration, ConfigVariable } from '@kibibit/configit';

@Configuration()
export class ExtProjectConfig extends BaseConfig {
  @ConfigVariable('Server port')
  @IsNumber()
  PORT: number;

  @ConfigVariable([
    'This is the slack organization to talk to'
  ])
  @IsString()
  SLACK_ORGANIZATION_NAME: string;

  @ConfigVariable([
    'This is the slack API to talk and report to channel "hello"'
  ])
  @IsString()
  SLACK_API_KEY: string;
}
