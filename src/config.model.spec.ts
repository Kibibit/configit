
import { BaseConfig } from './config.model';
import { setEnvironment } from './environment.service';
import { PizzaConfig } from './pizza.config.model.mock';

setEnvironment('test');

describe('Config Model', () => {
  let config: BaseConfig;
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    config = new BaseConfig({
      NODE_ENV: 'test'
    });
    config.setName(BaseConfig);
  });
  test('Base config creation', () => {
    expect(config).toBeDefined();
  });

  test('config.getFileName', () => {
    expect(config.getFileName('json'))
      .toEqual('.env.test.base.json');
    expect(config.getFileName('yaml'))
      .toEqual('.env.test.base.yaml');
    expect(config.getFileName('json', true))
      .toEqual('.env.test._shared_.base.json');

    config.setName(PizzaConfig);

    expect(config.getFileName('json'))
      .toEqual('.env.test.pizza.json');
    expect(config.getFileName('yaml'))
      .toEqual('.env.test.pizza.yaml');
    expect(config.getFileName('json', true))
      .toEqual('.env.test._shared_.pizza.json');
  });

  test('config.getSchemaFileName', () => {
    expect(config.getSchemaFileName())
      .toEqual('base.env.schema.json');
  });

  test('config.toJsonSchema', () => {
    const pizzaConfig = new PizzaConfig({
      NODE_ENV: 'test'
    });
    pizzaConfig.setName(PizzaConfig);
    expect(pizzaConfig.toJsonSchema())
      .toMatchSnapshot();
  });
});
