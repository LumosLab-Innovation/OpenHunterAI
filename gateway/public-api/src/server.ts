import { createLogger } from '@x-hunter/shared';
import { createApp } from './app.js';

const logger = createLogger({ component: 'public-api' });
const port = Number(process.env.API_PORT || process.env.PUBLIC_API_PORT || 4000);

createApp().listen(port, '0.0.0.0', () => {
  logger.info('public_api_listen', { port });
});
