import {
  IsBoolean,
  IsIn,
  IsString
} from 'class-validator';
import { validationMetadatasToSchemas } from 'class-validator-jsonschema';
import { chain } from 'lodash';

import { Configuration, ConfigVariable } from './json-schema.validator';

export const NODE_ENVIRONMENT_OPTIONS = [
  'google',
  'development',
  'production',
  'test',
  'devcontainer'
];

@Configuration()
export class BaseConfig {
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

  constructor(partial: Partial<BaseConfig> = {}) {
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
      .filter((className) => className !== 'BaseConfig')
      .first()
      .value();
    const configJsonSchema = chain(configJsonSchemaObj[classForSchema])
      .omit([
        'properties.NODE_ENV',
        'properties.nodeEnv',
        'properties.saveToFile'
      ])
      .value();

    if (configJsonSchema.required) {
      configJsonSchema.required = chain(configJsonSchema.required)
        .filter((value) => ![
          'NODE_ENV',
          'nodeEnv',
          'saveToFile'
        ].includes(value))
        .value();
    }

    return configJsonSchema;
  }
}
