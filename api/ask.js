import { createHandler } from '../src/app.js';
const handler = createHandler();
export default function ask(req, res) { req.url = '/ask'; return handler(req, res); }
