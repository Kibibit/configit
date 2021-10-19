import {
  IsBoolean,
  IsIn,
  IsString
} from 'class-validator';
import { validationMetadatasToSchemas } from 'class-validator-jsonschema';
import { chain, get, kebabCase } from 'lodash';

import { Configuration, ConfigVariable } from './json-schema.validator';

const environment = get(process, 'env.NODE_ENV', 'development');

export const NODE_ENVIRONMENT_OPTIONS = [
  'google',
  'development',
  'production',
  'test',
  'devcontainer'
];

type TClass<T> = (new (partial: Partial<T>) => T);

@Configuration()
export class BaseConfig {
  name: string;

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
      .find((className) => className === this.constructor.name)
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
      environment, '.',
      isSharedConfig ? '_shared_.' : '',
      kebabCase(this.name), '.',
      ext
    ].join('');
  }

  getSchemaFileName() {
    return `${ kebabCase(this.name) }.env.schema.json`;
  }
}
