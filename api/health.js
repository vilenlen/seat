import { cors, send } from '../lib/http.js';

export default function handler(req, res) {
  if (cors(req, res)) return;
  return send(res, 200, { ok: true, service: 'yuanzhuo-api' });
}
