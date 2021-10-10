import { ValidationError } from 'class-validator';
import { times, values } from 'lodash';
import { red, cyan } from 'colors';

export class ConfigValidationError extends Error {
  constructor(validationErrors: ValidationError[], configInstance: any) {
    const message = validationErrors
      .map((validationError) => {
        const deco = cyan(times(55, () => '=').join(''));
        return [
          '',
          deco,
          ` ${ cyan('property:') } ${ validationError.property }`,
          ` ${ cyan('value:') } ${ red(validationError.value) }`,
          deco,
          values(validationError.constraints)
            .map((value) => `    - ${ red(value) }`).join('\n')
        ].join('\n');
      }).join('') + '\n\n';

    super(message);
    this.name = 'ConfigValidationError';
  }
}