import { configService } from './config.service';

configService.logger.log('Hello from the extended config!');

configService.logger.verbose('Get SLACK API configuration', configService.getSlackApiObject());
