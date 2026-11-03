import { useGame } from '../store.ts';

export function Feed() {
  const feed = useGame((s) => s.feed);
  return (
    <ul className="feed">
      {feed.map((it) => (
        <li key={it.t + it.name + it.text} className={it.kind}>
          <b>{it.name}</b> {it.text}
        </li>
      ))}
    </ul>
  );
}
