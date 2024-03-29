import { IsNumber, IsString } from 'class-validator';

import { BaseConfig, Configuration, ConfigVariable } from '@kibibit/configit';

@Configuration()
export class ProjectConfig extends BaseConfig {
  @ConfigVariable('Server port')
  @IsNumber()
    PORT: number;

  @ConfigVariable([
    'This is the slack API to talk and report to channel "hello"'
  ])
  @IsString()
    SLACK_API_KEY: string;
}
