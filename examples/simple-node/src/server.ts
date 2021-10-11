import express from 'express';

import { ConfigService } from '@kibibit/configit';

import { ProjectConfig } from './project-config.model';

export const configService = new ConfigService<ProjectConfig>(ProjectConfig);

console.log(configService.config.PORT);

const app = express();

app.get( '/', ( req, res ) => {
  res.send( 'Hello world!' );
} );

app.listen(configService.config.PORT, () => {
  console.log(
    `server started at http://localhost:${ configService.config.PORT }`
  );
} );

