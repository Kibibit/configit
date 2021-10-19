import { join, relative } from 'path';

import { classToPlain } from 'class-transformer';
import { validateSync } from 'class-validator';
import { cyan, red } from 'colors';
import findRoot from 'find-root';
import {
  ensureDirSync,
  pathExistsSync,
  readdirSync,
  readJSONSync,
  writeFileSync,
  writeJSONSync } from 'fs-extra';
import { camelCase, chain, keys, mapValues, startCase, times } from 'lodash';
import nconf, { IFormats } from 'nconf';
import nconfYamlFormat from 'nconf-yaml';
import YAML from 'yaml';

import { ConfigValidationError } from './config.errors';
import { BaseConfig } from './config.model';
import { getEnvironment, setEnvironment } from './environment.service';

type IYamlIncludedFormats = IFormats & { yaml: nconfYamlFormat };

const nconfFomrats = (nconf.formats as IYamlIncludedFormats).yaml = nconfYamlFormat;

export interface IConfigServiceOptions {
  convertToCamelCase?: boolean;
  useYaml?: boolean;
  sharedConfig?: TClass<BaseConfig>[];
  schemaFolderName?: string;
  showOverrides?: boolean;
  configFolderRelativePath?: string;
  encryptConfig?: {
    algorithm: string;
    secret: string;
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let configService: ConfigService<any>;

type TClass<T> = (new (partial: Partial<T>) => T);

/**
 * This is a **Forced Singleton**.
 * This means that even if you try to create
 * another ConfigService, you'll always get the
 * first one.
 */
export class ConfigService<T extends BaseConfig> {
  private fileExtension: 'yaml' | 'json';
  readonly mode: string = getEnvironment();
  readonly options: IConfigServiceOptions;
  readonly config?: T;
  readonly genericClass?: TClass<T>;
  readonly fileName?: string;
  readonly configFileName: string = '';
  readonly configFileFullPath?: string;
  readonly configFileRoot?: string;
  readonly appRoot: string;

  constructor(
    givenClass: TClass<T>,
    passedConfig?: Partial<T>,
    options: IConfigServiceOptions = {}
  ) {
    if (!passedConfig && configService) { return configService; }

    setEnvironment(passedConfig.NODE_ENV || getEnvironment());
    this.mode = getEnvironment();

    this.options = {
      sharedConfig: [],
      useYaml: false,
      convertToCamelCase: false,
      schemaFolderName: '.schemas',
      showOverrides: false,
      ...options
    };
    this.appRoot = this.findRoot();
    this.genericClass = givenClass;
    this.fileExtension = this.options.useYaml ? 'yaml' : 'json';
    this.config = this.createConfigInstance(this.genericClass, {}) as T;
    this.configFileName = this.config.getFileName(this.fileExtension);
    this.configFileRoot = this.findConfigRoot();
    this.configFileFullPath = join(
      this.configFileRoot,
      this.configFileName
    );

    this.initializeNconf();

    const config = passedConfig || nconf.get();

    const pathDoesNotExist = pathExistsSync(this.configFileFullPath) === false;
    if (pathDoesNotExist && (config.saveToFile || config.init)) {
      console.log(cyan('Initializing Configuration File'));
      this.config = this.createConfigInstance(this.genericClass, {}) as T;
      this.writeConfigToFile();
      this.writeSchema();
      console.log(cyan('EXITING'));
      process.exit(0);
      return;
    }

    const envConfig = this.validateInput(config);
    if (!envConfig) { return; }
    envConfig.NODE_ENV = this.mode;
    this.config = this.createConfigInstance(this.genericClass, envConfig as T) as T;

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

  private createConfigInstance(genericClass: TClass<BaseConfig>, data) {
    const configInstance = new genericClass(data);
    configInstance.setName(genericClass);

    return configInstance;
  }

  private initializeNconf() {
    nconf
      .argv({
        parseValues: true
      })
      .env({
        separator: '__',
        parseValues: true,
        transform: this.options.convertToCamelCase ?
          transformToCamelCase :
          null
      });

    const nconfFileOptions: nconf.IFileOptions = {
      format: this.options.useYaml ? nconfFomrats : null
    };

    if (this.options.encryptConfig) {
      nconfFileOptions.secure = {
        secret: this.options.encryptConfig.secret,
        alg: this.options.encryptConfig.algorithm
      };
    }

    try {
      nconf
        .file('environment', {
          file: this.configFileFullPath,
          ...nconfFileOptions
        });
    } catch (error) {
      console.error(red(error.message));
      process.exit(1);
    }

    for (const sharedConfig of this.options.sharedConfig) {
      const sharedConfigInstance = this.createConfigInstance(sharedConfig, {});
      const sharedConfigFullPath = join(
        this.configFileRoot,
        sharedConfigInstance.getFileName(this.fileExtension, true),
      );
      try {
        nconf.file(sharedConfigInstance.name, {
          file: sharedConfigFullPath,
          ...nconfFileOptions
        });
      } catch (error) {
        console.error(red(error.message));
        process.exit(1);
      }
    }
  }

  private writeSchema() {
    ensureDirSync(join(this.configFileRoot, '/', this.options.schemaFolderName));
    const sharedConfigsSchemas = [];
    for (const sharedConfig of this.options.sharedConfig) {
      const sharedConfigSchema = this.writeSharedSchema(sharedConfig);
      sharedConfigsSchemas.push(sharedConfigSchema);
    }

    const schema = this.config.toJsonSchema();
    const schemaFullPath = join(
      this.configFileRoot,
      '/',
      this.options.schemaFolderName,
      '/',
      this.config.getSchemaFileName()
    );

    let sharedConfigsProperties = {};
    for (const sharedConfigSchema of sharedConfigsSchemas) {
      mapValues(
        sharedConfigSchema.properties,
        (value) => value.description = `(OVERRIDE SHARED CONFIG)\n${ value.description }`
      );
      sharedConfigsProperties = {
        ...sharedConfigsProperties,
        ...sharedConfigSchema.properties
      };
    }

    if (this.options.showOverrides) {
      schema.properties = {
        ...this.orderObjectKeys(schema.properties),
        ...this.orderObjectKeys(sharedConfigsProperties)
      };
    }

    writeJSONSync(schemaFullPath, schema, { spaces: 2 });
  }

  private orderObjectKeys(given: { [key: string]: any }) {
    return chain(given)
      .keys()
      .sort()
      .reduce((obj: { [key: string]: any }, key) => {
        obj[key] = given[key];
        return obj;
      }, {})
      .value();
  }

  private writeSharedSchema(configClass: TClass<BaseConfig>) {
    const config = this.createConfigInstance(configClass, {});
    const schema = config.toJsonSchema();
    const schemaFullPath = join(
      this.configFileRoot,
      '/',
      this.options.schemaFolderName,
      '/',
      config.getSchemaFileName()
    );
    writeJSONSync(schemaFullPath, schema, { spaces: 2 });

    return schema;
  }

  private writeConfigToFile() {
    const plainConfig = classToPlain(this.config);
    const relativePathToSchema = relative(
      this.configFileRoot,
      join(this.appRoot, `/${ this.options.schemaFolderName }/${ this.config.getSchemaFileName() }`)
    );
    plainConfig.$schema = relativePathToSchema;
    const orderedKeys = this.orderObjectKeys(plainConfig);

    if (this.options.useYaml) {
      const yamlValues = chain(orderedKeys)
        .omit([ '$schema' ])
        // eslint-disable-next-line no-undefined
        .omitBy((value) => value === undefined)
        .value();
      const yamlString = keys(yamlValues).length > 0 ? YAML.stringify(yamlValues) : '';
      writeFileSync(
        this.configFileFullPath,
        [
          '# yaml-language-server: $schema=',
          relativePathToSchema,
          `\n${ yamlString }`
        ].join('')
      );
      return;
    }

    writeJSONSync(this.configFileFullPath, orderedKeys, { spaces: 2 });

    for (const sharedConfig of this.options.sharedConfig) {
      this.writeSharedConfigToFile(sharedConfig);
    }
  }

  private writeSharedConfigToFile(configClass: TClass<BaseConfig>) {
    const config = this.createConfigInstance(configClass, this.config);
    const plainConfig = classToPlain(config);
    const relativePathToSchema = relative(
      this.configFileRoot,
      join(this.appRoot, `/${ this.options.schemaFolderName }/${ config.getSchemaFileName() }`)
    );
    plainConfig.$schema = relativePathToSchema;
    const sharedConfigFullPath = join(
      this.configFileRoot,
      config.getFileName(this.fileExtension, true)
    );

    const orderedKeys = this.orderObjectKeys(plainConfig);

    if (this.options.useYaml) {
      const yamlValues = chain(orderedKeys)
        .omit([ '$schema' ])
      // eslint-disable-next-line no-undefined
        .omitBy((value) => value === undefined)
        .value();
      const yamlString = keys(yamlValues).length > 0 ? YAML.stringify(yamlValues) : '';
      writeFileSync(
        sharedConfigFullPath,
        [
          '# yaml-language-server: $schema=',
          relativePathToSchema,
          `\n${ yamlString }`
        ].join('')
      );
      return;
    }

    writeJSONSync(sharedConfigFullPath, orderedKeys, { spaces: 2 });
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
    if (this.options.configFolderRelativePath) {
      const fullPath = join(this.appRoot, this.options.configFolderRelativePath);
      ensureDirSync(fullPath);

      return fullPath;
    }
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

    let fullConfig = {};
    let shouldExitProcess = false;
    for (const sharedConfig of this.options.sharedConfig) {
      const validationResult = this.validateSharedInput(envConfig, sharedConfig);
      shouldExitProcess = shouldExitProcess || validationResult.error;
      fullConfig = {
        ...fullConfig,
        ...validationResult.configInstance
      };
    }

    if (validationErrors.length > 0) {
      const validationError = new ConfigValidationError(validationErrors);
      const errorMessageTitle = `${ startCase(this.config.name) } Configuration Errors`;
      const titleBar = this.generateTerminalTitleBar(errorMessageTitle);
      console.error(titleBar, validationError.message);

      shouldExitProcess = shouldExitProcess || validationErrors.length > 0;
    }

    if (shouldExitProcess) {
      process.exit(1);
      return;
    }

    return {
      ...fullConfig,
      ...classToPlain(configInstance) as Partial<T>
    };
  }

  private validateSharedInput(
    envConfig: unknown,
    configClass: TClass<BaseConfig>
  ) {
    const configInstance = this.createConfigInstance(configClass, envConfig);
    const validationErrors = validateSync(configInstance);

    let error = null;
    if (validationErrors.length > 0) {
      const validationError = new ConfigValidationError(validationErrors);
      const errorMessageTitle = `${ startCase(configInstance.name) } Shared Configuration Errors`;
      const titleBar = this.generateTerminalTitleBar(errorMessageTitle);
      error = { titleBar, message: validationError.message };
      console.error(titleBar, validationError.message);
    }
    return {
      configInstance: classToPlain(configInstance),
      error
    };
  }

  private generateTerminalTitleBar(title: string) {
    const titleBar = red(times(title.length + 4, () => '=').join(''));
    return [
      titleBar,
      red('= ') + title + red(' ='),
      titleBar
    ].join('\n');
  }
}

function transformToCamelCase(obj: { key: string; value: string }) {
  const camelCasedKey = camelCase(obj.key);

  obj.key = camelCasedKey;

  return camelCasedKey && obj;
}
