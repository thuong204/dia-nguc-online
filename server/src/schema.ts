import { schema, t } from '@colyseus/schema';

export const Player = schema(
  {
    name: t.string(),
    sin: t.string(),
    hue: t.uint16(),
    x: t.float32(),
    y: t.float32(),
    z: t.float32(),
    r: t.float32(),
    strikes: t.uint8(), // số lần vi phạm ở tầng hiện tại
  },
  'Player',
);
export type Player = InstanceType<typeof Player>;

/** Vật thể chung cho mọi hoạt động: tin nhắn, ghế, ô sàn, tủ server... */
export const Obj = schema(
  {
    kind: t.string(),
    x: t.float32(),
    y: t.float32(),
    z: t.float32(),
    s: t.uint8(), // trạng thái
    hp: t.uint8(),
    owner: t.string(),
  },
  'Obj',
);
export type Obj = InstanceType<typeof Obj>;

export const FloorState = schema(
  {
    level: t.uint8(),
    progress: t.uint16(),
    need: t.uint16(),
    goal: t.string(),
    quiz: t.string(), // JSON QuizView (tầng 1)
    players: t.map(Player),
    objects: t.map(Obj),
  },
  'FloorState',
);
export type FloorState = InstanceType<typeof FloorState>;
