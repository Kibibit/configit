/* eslint-disable no-undefined */
import fsExtra from 'fs-extra';
import { mockProcessExit } from 'jest-mock-process';

import { ConfigService } from './config.service';
import { PizzaConfig, ToppingEnum } from './pizza.config.model.mock';

class PizzaConfigService extends ConfigService<PizzaConfig> {
  constructor(passedConfig?: Partial<PizzaConfig>) {
    super(PizzaConfig, passedConfig);
  }
}

describe('Config Service', () => {
  let configService: PizzaConfigService;
  beforeAll(() => {
    configService = new PizzaConfigService({
      NODE_ENV: 'test'
    });
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
    (fsExtra.writeJSONSync as jest.Mock).mockReturnValue(false);
    (fsExtra.pathExistsSync as jest.Mock).mockReturnValue(false);
    const mockExit = mockProcessExit();
    (fsExtra.writeJSONSync as jest.Mock).mockClear();
    jest.clearAllMocks();
    new PizzaConfigService({
      saveToFile: true,
      NODE_ENV: 'test'
    });

    expect(fsExtra.writeJSONSync).toHaveBeenCalledTimes(2);
    expect((fsExtra.writeJSONSync as jest.Mock).mock.calls[0]).toMatchSnapshot();
    expect((fsExtra.writeJSONSync as jest.Mock).mock.calls[1]).toMatchSnapshot();
    expect(mockExit).toHaveBeenCalledWith(0);
    mockExit.mockRestore();
  });

  test('Service can SAVE the config files with saveToFile or init param', () => {
    (fsExtra.writeJSONSync as jest.Mock).mockReturnValue(false);
    (fsExtra.pathExistsSync as jest.Mock).mockReturnValue(true);
    (fsExtra.writeJSONSync as jest.Mock).mockClear();
    jest.clearAllMocks();
    new PizzaConfigService({
      saveToFile: true,
      NODE_ENV: 'test',
      toppings: [ ToppingEnum.Cheese ]
    });

    expect(fsExtra.writeJSONSync).toHaveBeenCalledTimes(2);
    expect((fsExtra.writeJSONSync as jest.Mock).mock.calls[0]).toMatchSnapshot();
    expect((fsExtra.writeJSONSync as jest.Mock).mock.calls[1]).toMatchSnapshot();
  });
});
