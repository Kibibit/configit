import { Exclude, Expose } from 'class-transformer';
import {
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface
} from 'class-validator';

export interface IConfigVariableOptions {
  exclude?: boolean;
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
