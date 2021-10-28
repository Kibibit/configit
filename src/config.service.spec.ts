/* eslint-disable no-undefined */
import fsExtra from 'fs-extra';
import { mockProcessExit } from 'jest-mock-process';

import { ConfigService, IConfigServiceOptions } from './config.service';
import { PizzaConfig, ToppingEnum, ToppingsConfig } from './pizza.config.model.mock';

class PizzaConfigService extends ConfigService<PizzaConfig> {
  constructor(passedConfig?: Partial<PizzaConfig>, options?: IConfigServiceOptions) {
    super(PizzaConfig, passedConfig, options);
  }
}

describe('Config Service', () => {
  let configService: PizzaConfigService;
  let mockExit;
  beforeAll(() => {
    configService = new PizzaConfigService({
      NODE_ENV: 'test'
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockExit = mockProcessExit();

    (fsExtra.writeJSONSync as jest.Mock).mockReturnValue(false);
    (fsExtra.writeFileSync as jest.Mock).mockReturnValue(false);
    (fsExtra.pathExistsSync as jest.Mock).mockReturnValue(true);
  });

  afterEach(() => {
    mockExit.mockRestore();
  });
  test('Service creation', () => {
    expect(configService).toBeDefined();
  });

  test('Service is a forced singleton', () => {
    const configService2 = new PizzaConfigService();
    expect(configService2).toBe(configService);
  });

  test('Service can be forced to be created again', () => {
    const configService2 = new PizzaConfigService({
      NODE_ENV: 'test',
      toppings: [ ToppingEnum.Cheese ]
    });
    expect(configService2.mode).toBe('test');
    expect(configService2).not.toBe(configService);
    expect(configService2.config).toMatchSnapshot();
  });

  test('Service can initialize the config files with saveToFile or init param', () => {
    (fsExtra.pathExistsSync as jest.Mock).mockReturnValue(false);
    new PizzaConfigService({
      saveToFile: true,
      NODE_ENV: 'test'
    });

    expect(fsExtra.writeJSONSync).toHaveBeenCalledTimes(2);
    expect((fsExtra.writeJSONSync as jest.Mock).mock.calls[0]).toMatchSnapshot();
    expect((fsExtra.writeJSONSync as jest.Mock).mock.calls[1]).toMatchSnapshot();
    expect(mockExit).toHaveBeenCalledWith(0);
  });

  test('Service can SAVE the config files with saveToFile or init param', () => {
    new PizzaConfigService({
      saveToFile: true,
      NODE_ENV: 'test',
      toppings: [ ToppingEnum.Cheese ]
    });

    expect(fsExtra.writeJSONSync).toHaveBeenCalledTimes(1);
    expect((fsExtra.writeJSONSync as jest.Mock).mock.calls[0]).toMatchSnapshot();
    expect(mockExit).toHaveBeenCalledWith(0);
  });

  test('Service can Save and CONVERT the config files with saveToFile or init param', () => {
    new PizzaConfigService({
      saveToFile: true,
      convert: true,
      NODE_ENV: 'test',
      toppings: [ ToppingEnum.Cheese ]
    });

    expect(fsExtra.writeFileSync).toHaveBeenCalledTimes(1);

    const [ filePath, fileContent ] = (fsExtra.writeFileSync as jest.Mock).mock.calls[0];

    expect(filePath).toMatchSnapshot();
    expect(`\n${ fileContent }\n`).toMatchSnapshot();
    expect(mockExit).toHaveBeenCalledWith(0);
  });

  describe('wrap variables in attribute', () => {
    test('YAML', () => {
      new PizzaConfigService({
        saveToFile: true,
        convert: true,
        wrapper: 'env_variables',
        NODE_ENV: 'test',
        toppings: [ ToppingEnum.Cheese ]
      });

      expect(fsExtra.writeFileSync).toHaveBeenCalledTimes(1);

      const [ filePath, fileContent ] = (fsExtra.writeFileSync as jest.Mock).mock.calls[0];

      expect(filePath).toMatchSnapshot();
      expect(`\n${ fileContent }\n`).toMatchSnapshot();
      expect(mockExit).toHaveBeenCalledWith(0);
    });

    test('JSON', () => {
      new PizzaConfigService({
        saveToFile: true,
        wrapper: 'env_variables',
        NODE_ENV: 'test',
        toppings: [ ToppingEnum.Cheese ]
      });

      expect(fsExtra.writeJSONSync).toHaveBeenCalledTimes(1);

      const [ filePath, fileContent ] = (fsExtra.writeJSONSync as jest.Mock).mock.calls[0];

      expect(filePath).toMatchSnapshot();
      expect(fileContent).toMatchSnapshot();
      expect(mockExit).toHaveBeenCalledWith(0);
    });
  });

  test('Service returns correct empty yaml when config is empty', () => {
    new PizzaConfigService({
      saveToFile: true,
      convert: true
    });

    expect(fsExtra.writeFileSync).toHaveBeenCalledTimes(1);

    const [ filePath, fileContent ] = (fsExtra.writeFileSync as jest.Mock).mock.calls[0];

    expect(filePath).toMatchSnapshot();
    expect(fileContent.trim()).toEqual('');
    expect(mockExit).toHaveBeenCalledWith(0);
  });

  test('Service can return a plain object', () => {
    const pizzaConfigInstance = new PizzaConfigService({
      NODE_ENV: 'test',
      toppings: [ ToppingEnum.Cheese ]
    });

    const plainObjectConfig = pizzaConfigInstance.toPlainObject();
    expect(plainObjectConfig).toMatchSnapshot();
  });

  test('Service can save yaml with schema', async () => {
    const pizzaConfigInstance = new PizzaConfigService({
      NODE_ENV: 'test',
      toppings: [ ToppingEnum.Cheese ]
    });

    await pizzaConfigInstance.writeConfigToFile({
      useYaml: true,
      excludeSchema: false
    });

    expect(fsExtra.writeFileSync).toHaveBeenCalledTimes(1);

    const [ filePath, fileContent ] = (fsExtra.writeFileSync as jest.Mock).mock.calls[0];

    expect(filePath).toMatchSnapshot();
    expect(fileContent).toContain('# yaml-language-server: $schema=');
    expect(fileContent).toMatchSnapshot();
  });

  describe('Shared Configurations', () => {
    test('Can define shared config', () => {
      const pizzaConfigInstance = new PizzaConfigService({
        NODE_ENV: 'test',
        toppings: [ ToppingEnum.Cheese ],
        INCLUDE_MEAT: true
      } as any, {
        sharedConfig: [ ToppingsConfig ]
      });

      pizzaConfigInstance.writeConfigToFile({
        useYaml: false
        // excludeSchema: false
      });

      expect(fsExtra.writeJSONSync).toHaveBeenCalledTimes(4);

      const [ filePath0, fileContent0 ] = (fsExtra.writeJSONSync as jest.Mock).mock.calls[0];
      const [ filePath1, fileContent1 ] = (fsExtra.writeJSONSync as jest.Mock).mock.calls[1];
      const [ filePath2, fileContent2 ] = (fsExtra.writeJSONSync as jest.Mock).mock.calls[2];
      const [ filePath3, fileContent3 ] = (fsExtra.writeJSONSync as jest.Mock).mock.calls[3];

      expect(filePath0).toMatchSnapshot();
      expect(fileContent0).toMatchSnapshot();
      expect(filePath1).toMatchSnapshot();
      expect(fileContent1).toMatchSnapshot();
      expect(filePath2).toMatchSnapshot();
      expect(fileContent2).toMatchSnapshot();
      expect(filePath3).toMatchSnapshot();
      expect(fileContent3).toMatchSnapshot();
    });
  });
});
