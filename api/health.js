import { createHandler } from '../src/app.js';
const handler = createHandler();
export default function health(req, res) { req.url = '/health'; return handler(req, res); }
