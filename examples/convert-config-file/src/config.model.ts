import { IsPort, IsString } from 'class-validator';

import { BaseConfig, Configuration, ConfigVariable } from '@kibibit/configit';

@Configuration()
export class ProjectConfig extends BaseConfig {
  @ConfigVariable('Server port')
  @IsPort()
  PORT: string;

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
