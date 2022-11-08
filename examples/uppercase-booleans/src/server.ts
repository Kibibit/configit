import express from 'express';

import { configService } from './config.service';

const app = express();

app.get( '/', ( req, res ) => {
  res.send( 'Hello world!' );
} );

app.listen(configService.config.PORT, () => {
  console.log(
    `server started at http://localhost:${ configService.config.PORT }`
  );
});
