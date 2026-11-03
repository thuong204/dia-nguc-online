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
    slot: t.int8(), // cọc ở Pháp Trường (-1 = chưa nhận tội)
    served: t.uint8(), // số hiệp hình phạt đã chịu ở tầng hiện tại
    pain: t.uint8(), // đang chịu hình (0 = không; xem PAIN trong shared/game.ts)
    esc: t.uint8(), // đang bị áp giải tới cọc: 0 = không, 1 = tự nhận tội, 2 = chống cự nên bị cưỡng chế
  },
  'Player',
);
export type Player = InstanceType<typeof Player>;

export const FloorState = schema(
  {
    level: t.uint8(),
    need: t.uint8(), // số hiệp phải chịu ở mỗi tầng
    players: t.map(Player),
  },
  'FloorState',
);
export type FloorState = InstanceType<typeof FloorState>;
