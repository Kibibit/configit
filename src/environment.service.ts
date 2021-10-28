import { get } from 'lodash';

const realEnvironment = get(process, 'env.NODE_ENV', 'development');

let environment: string;

export function setEnvironment(givenEnvironment: string) {
  environment = givenEnvironment;
}

export function getEnvironment() {
  return environment || realEnvironment;
}
