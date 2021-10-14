import { join } from 'path';

import { classToPlain } from 'class-transformer';
import { validateSync } from 'class-validator';
import findRoot from 'find-root';
import {
  pathExistsSync,
  readdirSync,
  readJSONSync,
  writeFileSync,
  writeJSONSync
} from 'fs-extra';
import { camelCase, chain, get, keys } from 'lodash';
import nconf, { IFormats } from 'nconf';
import nconfYamlFormat from 'nconf-yaml';
import YAML from 'yaml';

import { ConfigValidationError } from './config.errors';
import { BaseConfig } from './config.model';

type IYamlIncludedFormats = IFormats & { yaml: nconfYamlFormat };

const nconfFomrats = (nconf.formats as IYamlIncludedFormats).yaml = nconfYamlFormat;

export interface IConfigServiceOptions {
  convertToCamelCase?: boolean;
  useYaml?: boolean;
}

const environment = get(process, 'env.NODE_ENV', 'development');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let configService: ConfigService<any>;

type TClass<T> = new (partial: Partial<T>) => T;

/**
 * This is a **Forced Singleton**.
 * This means that even if you try to create
 * another ConfigService, you'll always get the
 * first one.
 */
export class ConfigService<T extends BaseConfig> {
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

  constructor(
    givenClass: TClass<T>,
    passedConfig?: Partial<T>,
    options: IConfigServiceOptions = {}
  ) {
    this.options = options;
    this.appRoot = this.findRoot();
    if (!passedConfig && configService) { return configService; }

    this.genericClass = givenClass;
    this.fileName = chain(this.genericClass.name)
      .replace(/Config$/i, '')
      .kebabCase()
      .value();
    this.jsonSchemaFullname = `.${ this.fileName }.env.schema.json`;

    this.configFileName = [
      `${ this.fileName }.${ environment }.env.`,
      `${ this.options.useYaml ? 'yaml' : 'json' }`
    ].join('');

    this.configFileRoot = this.findConfigRoot() || this.appRoot;

    this.defaultConfigFilePath = join(
      this.configFileRoot,
      `defaults.env.${ this.options.useYaml ? 'yaml' : 'json' }`,
    );
    this.configFilePath = join(
      this.configFileRoot,
      this.configFileName
    );

    nconf
      .argv({
        parseValues: true
      })
      .env({
        parseValues: true,
        transform: this.options.convertToCamelCase ?
          transformToCamelCase :
          null
      })
      .file('defaults', { file: this.defaultConfigFilePath })
      .file('environment', {
        file: this.configFilePath,
        format: this.options.useYaml ? nconfFomrats : null
      });

    const config = passedConfig || nconf.get();

    const pathDoesNotExist = pathExistsSync(this.configFilePath) === false;
    if (pathDoesNotExist && (config.saveToFile || config.init)) {
      console.log('Initializing Configuration File');
      this.config = new this.genericClass({});
      this.writeConfigToFile();
      this.writeSchema();
      return;
    }

    const envConfig = this.validateInput(config);
    this.config = new this.genericClass(envConfig as T);

    if (config.saveToFile || config.init) {
      this.writeConfigToFile();
    }

    this.writeSchema();

    configService = this;
  }

  toPlainObject() {
    // hope this works now!
    return classToPlain(new this.genericClass(this.config));
  }

  private writeSchema() {
    const schema = this.config.toJsonSchema();
    const schemaFullPath = join(
      this.configFileRoot,
      '/',
      this.jsonSchemaFullname
    );
    writeJSONSync(schemaFullPath, schema);
  }

  private writeConfigToFile() {
    const plainConfig = classToPlain(this.config);
    plainConfig.$schema = `./${ this.jsonSchemaFullname }`;
    const orderedKeys = chain(plainConfig)
      .keys()
      .sort()
      .reduce((obj: { [key: string]: string }, key) => {
        obj[key] = plainConfig[key];
        return obj;
      }, {})
      .value();

    if (this.options.useYaml) {
      const yamlValues = chain(orderedKeys)
        .omit([ '$schema' ])
        // eslint-disable-next-line no-undefined
        .omitBy((value) => value === undefined)
        .value();
      const yamlString = keys(yamlValues).length > 0 ? YAML.stringify(yamlValues) : '';
      writeFileSync(this.configFilePath, `# yaml-language-server: $schema=./.yaml.env.schema.json\n${ yamlString }`);
      return;
    }

    writeJSONSync(this.configFilePath, orderedKeys, { spaces: 2 });
  }

  private findRoot() {
    return findRoot(process.cwd(), (dir) => {
      const packagePath = join(dir, 'package.json');
      const isPackageJsonExists = pathExistsSync(packagePath);

      if (isPackageJsonExists) {
        const packageContent = readJSONSync(packagePath, { encoding: 'utf8' });
        if (![ '' ].includes(packageContent.name)) {
          return true;
        }
      }

      return false;
    });
  }

  private findConfigRoot() {
    try {
      return findRoot(process.cwd(), (dir) => {
        const fileNames = readdirSync(dir);
        const isConfigFileExists = fileNames.includes(this.configFileName);
        return isConfigFileExists;
      });
    } catch (error) {
      return this.findRoot();
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
      throw new ConfigValidationError(validationErrors);
    }
    return classToPlain(configInstance) as Partial<T>;
  }
}

function transformToCamelCase(obj: { key: string; value: string }) {
  const camelCasedKey = camelCase(obj.key);

  obj.key = camelCasedKey;

  return camelCasedKey && obj;
}
