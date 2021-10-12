import { Exclude } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsString
} from 'class-validator';
import { validationMetadatasToSchemas } from 'class-validator-jsonschema';
import { chain } from 'lodash';

import { ConfigVariable } from './json-schema.validator';

export const NODE_ENVIRONMENT_OPTIONS = [
  'google',
  'development',
  'production',
  'test',
  'devcontainer'
];

@Exclude()
export class Config {
  @IsString()
  @IsIn(NODE_ENVIRONMENT_OPTIONS)
  @ConfigVariable(
    'Tells which env file to use and what environment we are running on',
    { exclude: true }
  )
  NODE_ENV = 'development';

  @IsBoolean()
  @ConfigVariable([
    'Create a file made out of the internal config. This is mostly for ',
    'merging command line, environment, and file variables to a single instance'
  ], { exclude: true })
  saveToFile = false;

  constructor(partial: Partial<Config> = {}) {
    Object.assign(this, partial);
  }

  public toJsonSchema() {
    const configJsonSchemaObj = validationMetadatasToSchemas({
      additionalConverters: {
        JsonSchema: (meta) => ({
          description: meta.constraints.join('')
        })
      }
    });

    const classForSchema = chain(configJsonSchemaObj)
      .keys()
      .filter((className) => className !== 'Config')
      .first()
      .value();
    const configJsonSchema = configJsonSchemaObj[classForSchema];

    delete configJsonSchema.properties?.nodeEnv;
    configJsonSchema.required?.splice(
      configJsonSchema.required.indexOf('nodeEnv'),
      1
    );

    return configJsonSchema;
  }
}
