import { useEffect, useState } from 'react';
import type { ReplayMeta, ReplayEvent } from './types';
import ReplayPage from './components/ReplayPage';

function App() {
  const [meta, setMeta] = useState<ReplayMeta | null>(null);
  const [events, setEvents] = useState<ReplayEvent[]>([]);
  const [error, setError] = useState<string>('');

  const params = new URLSearchParams(window.location.search);
  const session = params.get('session') ?? '';
  const layout = (params.get('layout') ?? 'landscape') as 'landscape' | 'portrait';
  const dataDir = `/data/${session}`;

  useEffect(() => {
    if (!session) {
      setError('缺少 session 参数。用法: ?session=game-2026-04-30T16-54-45&layout=landscape');
      return;
    }

    Promise.all([
      fetch(`${dataDir}/meta.json`).then((r) => {
        if (!r.ok) throw new Error(`加载 meta.json 失败: ${r.status}`);
        return r.json();
      }),
      fetch(`${dataDir}/events.json`).then((r) => {
        if (!r.ok) throw new Error(`加载 events.json 失败: ${r.status}`);
        return r.json();
      }),
    ])
      .then(([metaData, eventsData]) => {
        setMeta(metaData as ReplayMeta);
        setEvents(eventsData as ReplayEvent[]);
      })
      .catch((err) => setError(err.message));
  }, [session, dataDir]);

  if (error) {
    return <div className="fullscreen-center is-error">{error}</div>;
  }

  if (!meta || events.length === 0) {
    return <div className="fullscreen-center is-loading">加载中...</div>;
  }

  return <ReplayPage meta={meta} events={events} dataDir={dataDir} layout={layout} />;
}

export default App;
