import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { values } from 'lodash';

import { BaseConfig, Configuration, ConfigVariable } from './';

export enum ToppingEnum {
  Cheese = 'cheese',
  Pepperoni = 'pepperoni',
  Sausage = 'sausage'
}

@Configuration()
export class PizzaConfig extends BaseConfig {
  @IsOptional()
  @IsEnum(values(ToppingEnum), {
    each: true,
    message: `Topping must be one of: ${ values(ToppingEnum).join(', ') }`
  })
  @ConfigVariable('optional toppings for the pizza')
  public toppings: ToppingEnum[];

  constructor(partial?: Partial<PizzaConfig>) {
    super(partial);
  }
}

@Configuration()
export class ToppingsConfig extends BaseConfig {
  @IsOptional()
  @IsBoolean()
  @ConfigVariable('Should meat be included in the toppings options')
    INCLUDE_MEAT;
}
