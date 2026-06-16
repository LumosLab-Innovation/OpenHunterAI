import { createLogger } from '@x-hunter/shared';
import { createApp } from './app.js';
import { attachLoginSessionStreamProxy } from './modules/test-accounts/login-session-stream.proxy.js';

const logger = createLogger({ component: 'public-api' });
// Cloud Run (and most PaaS) inject the listen port via $PORT.
const port = Number(process.env.PORT || process.env.API_PORT || process.env.PUBLIC_API_PORT || 4000);

const server = createApp().listen(port, '0.0.0.0', () => {
  logger.info('public_api_listen', { port });
});
attachLoginSessionStreamProxy(server);
