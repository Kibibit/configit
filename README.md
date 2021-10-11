<p align="center">
  <a href="https://github.com/Kibibit/configit" target="blank"><img src="https://github.com/kibibit.png" width="150" ></a>
  <h2 align="center">
    @kibibit/configit
  </h2>
</p>
<p align="center">
  <a href="https://www.npmjs.com/package/@kibibit/configit"><img src="https://img.shields.io/npm/v/@kibibit/configit/latest.svg?style=for-the-badge&logo=npm&color=CB3837"></a>
</p>
<p align="center">
<a href="https://github.com/semantic-release/semantic-release"><img src="https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg"></a>
 <!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->
<a href="#contributors-"><img src="https://img.shields.io/badge/all_contributors-1-orange.svg?style=flat-square" alt="All Contributors"></a>
<!-- ALL-CONTRIBUTORS-BADGE:END -->
</p>
<p align="center">
  A general typescript configuration service
</p>
<hr>

Unless forced to create a new service, this service will return the first created service

### Usage

Create a new class to define your configuration.
The class should extend the `Config` class from this repo
```typescript
import { Exclude, Expose } from 'class-transformer';
import { IsNumber, Validate, IsString, IsArray } from 'class-validator';
import { Config, JsonSchema } from '@kibibit/configit';

@Exclude()
export class ProjectConfig extends Config {
  @Expose()
  @IsNumber()
  @Validate(JsonSchema, [
    'Server port'
  ])
  PORT: number;
}
```
Then, in your code, initialize the config service when you bootstrap your application
```typescript
import { ConfigService } from '@kibibit/configit';
import { ProjectConfig } from './project-config.model';
import express from "express";

export const configService = new ConfigService<ProjectConfig>(ProjectConfig);

console.log(configService.config.PORT);

const app = express();

app.get( "/", ( req, res ) => {
  res.send( "Hello world!" );
} );

app.listen(configService.config.PORT, () => {
  console.log( `server started at http://localhost:${ configService.config.PORT }` );
} );
```

## Contributors ✨

Thanks goes to these wonderful people ([emoji key](https://allcontributors.org/docs/en/emoji-key)):
<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tr>
    <td align="center"><a href="http://thatkookooguy.kibibit.io/"><img src="https://avatars3.githubusercontent.com/u/10427304?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Neil Kalman</b></sub></a><br /><a href="https://github.com/Kibibit/configit/commits?author=Thatkookooguy" title="Code">💻</a> <a href="https://github.com/Kibibit/configit/commits?author=Thatkookooguy" title="Documentation">📖</a> <a href="#design-Thatkookooguy" title="Design">🎨</a> <a href="#maintenance-Thatkookooguy" title="Maintenance">🚧</a> <a href="#infra-Thatkookooguy" title="Infrastructure (Hosting, Build-Tools, etc)">🚇</a> <a href="https://github.com/Kibibit/configit/commits?author=Thatkookooguy" title="Tests">⚠️</a></td>
  </tr>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification. Contributions of any kind are welcome!

## Stay in touch

- Author - [Neil Kalman](https://github.com/thatkookooguy)
- Website - [https://github.com/kibibit](https://github.com/kibibit)
- StackOverflow - [thatkookooguy](https://stackoverflow.com/users/1788884/thatkookooguy)
- Twitter - [@thatkookooguy](https://twitter.com/thatkookooguy)
- Twitter - [@kibibit_opensrc](https://twitter.com/kibibit_opensrc)