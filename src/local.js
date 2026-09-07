import { createServer } from 'node:http';
import { createHandler } from './app.js';
const port = Number(process.env.PORT || 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT inválida');
const server = createServer(createHandler());
server.listen(port, '0.0.0.0', () => console.log(`Word by Word API listening on port ${port}`));
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close(() => process.exit(0)));
