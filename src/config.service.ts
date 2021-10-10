import { join } from 'path';

import { classToPlain, Exclude } from 'class-transformer';
import { validateSync } from 'class-validator';
import findRoot from 'find-root';
import {
  pathExistsSync,
  readJSONSync,
  writeJson,
  writeJSONSync,
  readdirSync
} from 'fs-extra';
import { camelCase, chain, get } from 'lodash';
import nconf from 'nconf';
import { Config } from './config.model';
import { ConfigValidationError } from './config.errors';

export interface IConfigServiceOptions {
  convertToCamelCase?: boolean;
}

const environment = get(process, 'env.NODE_ENV', 'development');

let configService: ConfigService<any>;

type TClass<T> = new (partial: Partial<T>) => T;

/**
 * This is a **Forced Singleton**.
 * This means that even if you try to create
 * another ConfigService, you'll always get the
 * first one.
 */
export class ConfigService<T extends Config> {
  private readonly mode: string = environment;
  readonly options: IConfigServiceOptions;
  readonly config?: T;
  readonly genericClass?: TClass<T>;
  readonly fileName?: string;
  readonly jsonSchemaFullname?: string;
  readonly defaultConfigFilePath?: string;
  readonly configFileName: string = '';
  readonly configFilePath?: string;
  readonly configFileRoot?: string;
  readonly appRoot: string;

  constructor(givenClass: TClass<T>, passedConfig?: Partial<T>, options: IConfigServiceOptions = {}) {
    this.options = options;
    console.log('looking for root');
    this.appRoot = this.findRoot();
    console.log('found root');
    if (!passedConfig && configService) { return configService; }

    this.genericClass = givenClass;
    this.fileName = chain(this.genericClass.name)
      .replace(/Config$/i, '')
      .kebabCase()
      .value();
    this.jsonSchemaFullname = `.${ this.fileName }.env.schema.json`;

    this.configFileName = `${ this.fileName }.${ environment }.env.json`;

    this.configFileRoot = this.findConfigRoot();

    this.defaultConfigFilePath = join(this.configFileRoot, `defaults.env.json`);
    this.configFilePath = join(this.configFileRoot, `${ this.fileName }.${ environment }.env.json`);

    nconf
     .argv({
        parseValues: true
      })
      .env({
        parseValues: true,
        transform: this.options.convertToCamelCase ? transformToCamelCase : undefined
      })
      .file('defaults', { file: this.defaultConfigFilePath })
      .file('environment', { file: this.configFilePath });

    const config = passedConfig || nconf.get();
    const envConfig = this.validateInput(config);

    this.config = new this.genericClass(envConfig as T);

    if (config.saveToFile) {
      const plainConfig = classToPlain(this.config);
      plainConfig['$schema'] = `./${ this.jsonSchemaFullname }`;
      const orderedKeys = Object.keys(plainConfig).sort().reduce(
        (obj: { [key: string]: string }, key) => { 
          if (key === '$schema' || !key.startsWith('$')) {
            obj[key] = plainConfig[key];
          }
          return obj;
        }, 
        {}
      );

      writeJson(this.configFilePath, orderedKeys, { spaces: 2 });
    }

    const schema = this.config.toJsonSchema();
    writeJSONSync(join(this.configFileRoot, '/', this.jsonSchemaFullname), schema);

    configService = this;
  }

  toPlainObject() {
    return classToPlain(this);
  }

  private findRoot() {
    return findRoot(__dirname, (dir) => {
      const packagePath = join(dir, 'package.json');
      const isPackageJsonExists = pathExistsSync(packagePath);
    
      if (isPackageJsonExists) {
        const packageContent = readJSONSync(packagePath, { encoding: 'utf8' });
        if (![''].includes(packageContent.name)) {
          return true;
        }
      }
    
      return false;
    });
  }

  private findConfigRoot() {
    try {
      return findRoot(__dirname, (dir) => {
        const fileNames = readdirSync(dir);
        const isConfigFileExists = fileNames.includes(this.configFileName);
        return isConfigFileExists;
      });
    } catch (error) {
      console.error('pizza!');
    }
  }

  /**
   * Ensures all needed variables are set, and returns the validated JavaScript object
   * including the applied default values.
   */
  private validateInput(
    envConfig: Partial<T>
  ): Partial<T> {
    if (!this.genericClass) throw new Error('something went wrong');
    const configInstance = new this.genericClass(envConfig);
    const validationErrors = validateSync(configInstance);

    if (validationErrors.length > 0) {
      console.log(validationErrors);
      throw new ConfigValidationError(validationErrors, configInstance);
    }
    return classToPlain(configInstance) as Partial<T>;
  }
}

function transformToCamelCase(obj: { key: string; value: string }) {
  const camelCasedKey = camelCase(obj.key);

  obj.key = camelCasedKey;

  return camelCasedKey && obj;
}