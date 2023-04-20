<p align="center">
  <a href="https://github.com/Kibibit/configit" target="blank"><img src="logo.png" width="150" ></a>
  <h2 align="center">
    @kibibit/configit
  </h2>
</p>
<p align="center">
  <a href="https://www.npmjs.com/package/@kibibit/configit"><img src="https://img.shields.io/npm/v/@kibibit/configit/latest.svg?style=for-the-badge&logo=npm&color=CB3837"></a>
</p>
<p align="center">
<a href="https://www.npmjs.com/package/@kibibit/configit"><img src="https://img.shields.io/npm/v/@kibibit/configit/beta.svg?logo=npm&color=CB3837"></a>
<a href="https://codecov.io/gh/Kibibit/configit">
  <img src="https://codecov.io/gh/Kibibit/configit/branch/beta/graph/badge.svg?token=DrXLrpuExK">
</a>
<a href="https://github.com/Kibibit/configit/actions/workflows/build.yml">
  <img src="https://github.com/Kibibit/configit/actions/workflows/build.yml/badge.svg?style=flat-square&branch=beta" alt="Build">
</a>
<a href="https://github.com/Kibibit/configit/actions/workflows/tests.yml">
  <img src="https://github.com/Kibibit/configit/actions/workflows/tests.yml/badge.svg?branch=beta" alt="Tests">
</a>
<a href="https://github.com/semantic-release/semantic-release"><img src="https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg"></a>
 <!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->
<a href="#contributors-"><img src="https://img.shields.io/badge/all_contributors-2-orange.svg?style=flat-square" alt="All Contributors"></a>
<!-- ALL-CONTRIBUTORS-BADGE:END -->
</p>
<p align="center">
  A general typescript configuration service

</p>
<hr>

Unless forced to create a new service, this service will return the first created service

## Usage

Create a new class to define your configuration.
The class should extend the `Config` class from this repo
```typescript
import { IsNumber, IsString } from 'class-validator';

import { BaseConfig, Configuration, ConfigVariable } from '@kibibit/configit';

@Configuration()
export class ProjectConfig extends BaseConfig {
  @ConfigVariable('Server port')
  @IsNumber()
  PORT: number;

  @ConfigVariable([
    'This is the slack API to talk and report to channel "hello"'
  ])
  @IsString()
  SLACK_API_KEY: string;
}

}
```
Then, in your code, initialize the config service when you bootstrap your application
```typescript
import express from 'express';
import { ConfigService } from '@kibibit/configit';
import { ProjectConfig } from './project-config.model';

export const configService = new ConfigService<ProjectConfig>(ProjectConfig);
const app = express();

app.get( '/', ( req, res ) => {
  res.send( 'Hello world!' );
} );

app.listen(configService.config.PORT, () => {
  console.log(
    `server started at http://localhost:${ configService.config.PORT }`
  );
});

```

### Extending the Configuration Service (Recommended)
You can extend the configuration to add your own customization and functions!
```typescript
import { chain } from 'lodash';

import { ConfigService, IConfigServiceOptions } from '@kibibit/configit';
import { WinstonLogger } from '@kibibit/nestjs-winston';

import { ExtProjectConfig } from './ext-project-config.model';
import { initializeWinston } from './winston.config';

export class ExtConfigService extends ConfigService<ExtProjectConfig> {
  public logger: WinstonLogger;
  constructor(passedConfig?: Partial<ExtProjectConfig>, options: IConfigServiceOptions = {}) {
    super(ExtProjectConfig, passedConfig, options);

    initializeWinston(this.appRoot);
    this.logger = new WinstonLogger('');
  }

  getSlackApiObject() {
    const slackApiObject = chain(this.toPlainObject())
      .pickBy((value, key) => key.startsWith('SLACK_'))
      .mapKeys((value, key) => key.replace(/^SLACK_/i, ''))
      .mapKeys((value, key) => key.toLowerCase())
      .value();

    return slackApiObject;
  }
}

export const configService = new ExtConfigService() as ExtConfigService;

```


## Features
- Supports JSON\YAML files\env variables\cli flags as configuration inputs. See `yaml-config` in the examples folder
- Supports shared configuration files (same file shared for multiple projects)
- initialize a configuration file with `--saveToFile` or `--init`
- save configuration files anywhere above your project's package.json
- forced singleton for a single installation (reuse same class)
- testable
- The ability to create json schemas automatically and add descriptions
  to configuration variables
- Get meaningfull errors when configuration is wrong!

## Examples
See the examples folder for a variety of usage examples

## Contributors ✨

Thanks goes to these wonderful people ([emoji key](https://allcontributors.org/docs/en/emoji-key)):
<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tbody>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="http://thatkookooguy.kibibit.io/"><img src="https://avatars3.githubusercontent.com/u/10427304?v=4?s=100" width="100px;" alt="Neil Kalman"/><br /><sub><b>Neil Kalman</b></sub></a><br /><a href="https://github.com/Kibibit/configit/commits?author=Thatkookooguy" title="Code">💻</a> <a href="https://github.com/Kibibit/configit/commits?author=Thatkookooguy" title="Documentation">📖</a> <a href="#design-Thatkookooguy" title="Design">🎨</a> <a href="#maintenance-Thatkookooguy" title="Maintenance">🚧</a> <a href="#infra-Thatkookooguy" title="Infrastructure (Hosting, Build-Tools, etc)">🚇</a> <a href="https://github.com/Kibibit/configit/commits?author=Thatkookooguy" title="Tests">⚠️</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/nitzan-madar"><img src="https://avatars.githubusercontent.com/u/73841521?v=4?s=100" width="100px;" alt="Nitzan Madar"/><br /><sub><b>Nitzan Madar</b></sub></a><br /><a href="https://github.com/Kibibit/configit/commits?author=nitzan-madar" title="Code">💻</a></td>
    </tr>
  </tbody>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification. Contributions of any kind are welcome!

<div>Logo made by <a href="https://www.flaticon.com/authors/good-ware" title="Good Ware">Good Ware</a> from <a href="https://www.flaticon.com/" title="Flaticon">www.flaticon.com</a></div>
<br>

## Stay in touch

- Author - [Neil Kalman](https://github.com/thatkookooguy)
- Website - [https://github.com/kibibit](https://github.com/kibibit)
- StackOverflow - [thatkookooguy](https://stackoverflow.com/users/1788884/thatkookooguy)
- Twitter - [@thatkookooguy](https://twitter.com/thatkookooguy)
- Twitter - [@kibibit_opensrc](https://twitter.com/kibibit_opensrc)