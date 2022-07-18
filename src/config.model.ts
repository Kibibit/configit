import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString
} from 'class-validator';
import { validationMetadatasToSchemas } from 'class-validator-jsonschema';
import { chain, kebabCase } from 'lodash';

import { EFileFormats } from './config.service';
import { getEnvironment } from './environment.service';
import { Configuration, ConfigVariable } from './json-schema.validator';

export const NODE_ENVIRONMENT_OPTIONS = [
  'google',
  'development',
  'production',
  'test',
  'devcontainer',
  'staging',
  'e2e'
];

type TClass<T> = (new (partial: Partial<T>) => T);

@Configuration()
export class BaseConfig {
  name: string;

  @IsString()
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

  @IsEnum(EFileFormats)
  @IsOptional()
  @ConfigVariable(
    'Save the file to JSON if defaults to YAML and vise versa',
    { exclude: true }
  )
  convert: EFileFormats;

  @IsString()
  @IsOptional()
  @ConfigVariable(
    'Object Wrapper for saved file',
    { exclude: true }
  )
  wrapper;

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
      .find((className) => className === this.constructor.name)
      .value();
    const configJsonSchema = chain(configJsonSchemaObj[classForSchema])
      .omit([
        'properties.NODE_ENV',
        'properties.nodeEnv',
        'properties.saveToFile',
        'properties.convert',
        'properties.wrapper'
      ])
      .value();

    if (configJsonSchema.required) {
      configJsonSchema.required = chain(configJsonSchema.required)
        .filter((value) => ![
          'NODE_ENV',
          'nodeEnv',
          'saveToFile',
          'convert',
          'wrapper'
        ].includes(value))
        .value();
    }

    return configJsonSchema;
  }

  private cleanFileName(fileName: string) {
    return chain(fileName)
      .replace(/Config$/i, '')
      .replace(/Configuration$/i, '')
      .value();
  }

  setName(genericClass: TClass<BaseConfig>) {
    this.name = this.cleanFileName(genericClass.name);
  }

  getFileName(ext: string, isSharedConfig = false) {
    return [
      '.env.',
      getEnvironment(), '.',
      isSharedConfig ? '_shared_.' : '',
      kebabCase(this.name), '.',
      ext
    ].join('');
  }

  getSchemaFileName() {
    return `${ kebabCase(this.name) }.env.schema.json`;
  }
}
