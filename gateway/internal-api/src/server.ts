import { createApp } from './app.js';

const port = Number(process.env.INTERNAL_API_PORT || 4100);
createApp().listen(port, '0.0.0.0', () => {
  console.log(`internal-api listening on ${port}`);
});
