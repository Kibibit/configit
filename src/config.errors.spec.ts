import { validateSync } from 'class-validator';
import strip from 'strip-color';

import { ConfigValidationError } from './config.errors';
import { PizzaConfig, ToppingEnum } from './pizza.config.model.mock';

describe('Config Model', () => {
  let validationError: ConfigValidationError;
  beforeEach(() => {
    validationError = new ConfigValidationError([]);
  });
  test('validationError creation', () => {
    expect(validationError).toBeDefined();
  });

  test('ConfigValidationError beautify class-validator errors', () => {
    const config = new PizzaConfig({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      toppings: [ ToppingEnum.Cheese, ToppingEnum.Pepperoni, 5 as any ]
    });
    const validationErrors = validateSync(config);
    validationError = new ConfigValidationError(validationErrors);

    expect(strip(validationError.message).replace(/(?:\r\n|\r|\n)/g, '\n')).toMatchSnapshot();
  });
});
