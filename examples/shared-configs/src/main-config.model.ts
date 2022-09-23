import { IsNumber, IsString } from 'class-validator';

import { BaseConfig, Configuration, ConfigVariable } from '@kibibit/configit';

@Configuration()
export class MainConfig extends BaseConfig {
  @ConfigVariable('Server port')
  @IsNumber()
    PORT: number;

  @ConfigVariable('Secret only used by this server')
  @IsString()
    SECRET: number;
}
