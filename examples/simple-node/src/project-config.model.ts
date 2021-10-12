import { Exclude } from 'class-transformer';
import { IsNumber, IsString } from 'class-validator';

import { Config, ConfigVariable } from '@kibibit/configit';

@Exclude()
export class ProjectConfig extends Config {
  @ConfigVariable('Server port')
  @IsNumber()
  PORT: number;

  @ConfigVariable([
    'This is the slack API to talk and report to channel "hello"'
  ])
  @IsString()
  SLACK_API_KEY: string;
}
