import { Exclude, Expose } from 'class-transformer';
import { IsNumber, Validate } from 'class-validator';

import { Config, JsonSchema } from '@kibibit/configit';

@Exclude()
export class ProjectConfig extends Config {
  @Expose()
  @IsNumber()
  @Validate(JsonSchema, [
    'Server port'
  ])
  PORT: number;
}
