import express from 'express';
import helmet from 'helmet';

const app = express();
const port = Number(process.env.FINDINGS_PORT || 4300);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());
app.get('/health', (_req, res) => res.json({ ok: true, service: 'findings' }));
app.get('/internal/findings', (_req, res) => res.json({ findings: [] }));

app.listen(port, '0.0.0.0', () => console.log(`findings listening on ${port}`));
