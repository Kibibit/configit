import { EFileFormats } from '@kibibit/configit';

import { configService } from './config.service';

configService.logger.log('Converting config to yaml');
configService.writeConfigToFile({
  fileFormat: EFileFormats.yaml,
  excludeSchema: true,
  objectWrapper: 'env_variables'
});
configService.logger.log('Converting config to jsonc');
configService.writeConfigToFile({
  fileFormat: EFileFormats.jsonc,
  excludeSchema: true,
  objectWrapper: 'env_variables'
});
