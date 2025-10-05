import { Exclude, Expose } from 'class-transformer';
import {
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface
} from 'class-validator';

import { EConfigSource } from './config.types';

export interface IConfigVariableOptions {
  /**
   * Whether to exclude this property from the generated config file
   * @default false
   */
  exclude?: boolean;

  /**
   * Restrict the source of this configuration value
   * - 'env': Must come from environment variables or CLI arguments
   * - 'file': Must come from config file only
   * - 'both': Can come from any source (default)
   * @default 'both'
   */
  source?: EConfigSource | 'env' | 'file' | 'both';
}

@ValidatorConstraint({ name: 'JsonSchema', async: false })
class JsonSchema implements ValidatorConstraintInterface {
  validate() {
    return true;
  }

  defaultMessage() {
    return '';
  }
}

export function Configuration(): ClassDecorator {
  const exposeFn = Exclude();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function(target: any) {
    exposeFn(target);
  };
}

export function ConfigVariable(
  description: string | string[] = '',
  options: IConfigVariableOptions = {}
): PropertyDecorator {
  description = Array.isArray(description) ? description : [ description ];
  const exposeFn = options.exclude ? Exclude() : Expose();
  const typeFn = Validate(JsonSchema, description);

  return function(target: unknown, key: string) {
    typeFn(target, key);
    exposeFn(target, key);
  };
}
