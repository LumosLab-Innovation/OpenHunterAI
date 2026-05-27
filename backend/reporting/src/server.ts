import express from 'express';
import helmet from 'helmet';

const app = express();
const port = Number(process.env.REPORTING_PORT || 4400);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());
app.get('/health', (_req, res) => res.json({ ok: true, service: 'reporting' }));
app.get('/internal/reports', (_req, res) => res.json({ reports: [] }));

app.listen(port, '0.0.0.0', () => console.log(`reporting listening on ${port}`));
