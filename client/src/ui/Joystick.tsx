import { useRef, useState } from 'react';
import { fx } from '../fx.ts';

const R = 48; // bán kính di chuyển của núm

/** Cần điều khiển ảo cho điện thoại: kéo núm để đi, kéo hết cỡ để chạy. */
export function Joystick() {
  const base = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const active = useRef<number | null>(null);

  const update = (e: React.PointerEvent) => {
    const r = base.current!.getBoundingClientRect();
    let x = e.clientX - (r.left + r.width / 2), y = e.clientY - (r.top + r.height / 2);
    const d = Math.hypot(x, y);
    if (d > R) {
      x = (x / d) * R;
      y = (y / d) * R;
    }
    setKnob({ x, y });
    fx.joy.x = x / R;
    fx.joy.y = y / R;
  };
  const end = () => {
    active.current = null;
    setKnob({ x: 0, y: 0 });
    fx.joy.x = fx.joy.y = 0;
  };

  return (
    <div
      ref={base}
      className="joystick"
      onPointerDown={(e) => {
        e.preventDefault();
        active.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        update(e);
      }}
      onPointerMove={(e) => active.current === e.pointerId && update(e)}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <div className="knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
    </div>
  );
}
