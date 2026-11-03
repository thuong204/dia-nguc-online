import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { FLOORS, judge, type JudgeResponse } from '../../shared/game.ts';
import { FloorRoom } from './FloorRoom.ts';
import { randomUUID } from 'node:crypto';
import { addFeed, feed, issueTicket, leaderboard, stats } from './hub.ts';

const PORT = Number(process.env.PORT) || 2567;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(__dirname, '../../client/dist');
const clean = (s: unknown, n: number) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

const httpServer = createServer();
const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
  greet: false,
  express: (app) => {
    app.use(express.json({ limit: '4kb' }));

    // Diêm Vương phán tội → cấp vé xuống đúng tầng
    app.post('/api/judge', (req, res) => {
      const name = clean(req.body?.name, 18) || 'Hồn Vô Danh';
      const sin = clean(req.body?.sin, 300) || 'không chịu khai tội';
      // Chế độ dev: cho chọn thẳng tầng để test
      const forced = Number(req.body?.level);
      const devLevel = process.env.NODE_ENV !== 'production' && Number.isInteger(forced) && forced >= 1 && forced <= FLOORS.length;
      const level = devLevel ? forced : judge(sin);
      const hue = Math.floor(Math.random() * 360);
      const id = randomUUID();
      const ticket = issueTicket({ id, name, sin, hue, level });
      addFeed({ kind: 'judge', name, text: `bị đày xuống tầng ${level} vì: "${sin.length > 80 ? sin.slice(0, 78) + '…' : sin}"` });
      const body: JudgeResponse = { id, level, ticket, hue };
      res.json(body);
    });

    app.get('/healthz', (_req, res) => res.send('ok'));

    app.get('/api/overview', (_req, res) => {
      res.json({ floors: FLOORS.map(({ keywords, ...f }) => f), feed, stats: stats(), board: leaderboard() });
    });

    if (process.env.NODE_ENV === 'production') {
      app.use(express.static(clientDist));
    }
  },
});

gameServer.define('floor', FloorRoom).filterBy(['level']);

await gameServer.listen(PORT);
console.log(`👹 Địa Ngục Online server: http://localhost:${PORT}`);
