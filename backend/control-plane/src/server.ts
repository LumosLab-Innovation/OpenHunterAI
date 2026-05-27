import express from 'express';
import helmet from 'helmet';

const app = express();
const port = Number(process.env.CONTROL_PLANE_PORT || 4200);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());
app.get('/health', (_req, res) => res.json({ ok: true, service: 'control-plane' }));
app.get('/internal/projects', (_req, res) => res.json({ projects: [] }));
app.get('/internal/scans', (_req, res) => res.json({ scans: [] }));

app.listen(port, '0.0.0.0', () => console.log(`control-plane listening on ${port}`));
