import { type FC, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ReplayEvent, PlayerMeta } from '../types';

interface VoteEntry {
  voterId: number;
  targetId: number;
}

interface Props {
  votes: VoteEntry[];
  players: PlayerMeta[];
}

const VotePanel: FC<Props> = ({ votes, players }) => {
  const playerNameMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const p of players) map.set(p.id, p.name);
    return map;
  }, [players]);

  // 统计票数
  const tally = useMemo(() => {
    const counts = new Map<number, number>();
    for (const v of votes) {
      counts.set(v.targetId, (counts.get(v.targetId) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort(([, a], [, b]) => b - a);
  }, [votes]);

  if (votes.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* 投票记录 */}
      <AnimatePresence>
        {votes.map((v, i) => (
          <motion.div
            key={`${v.voterId}-${i}`}
            className="vote-line"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <span style={{ fontWeight: 600 }}>{playerNameMap.get(v.voterId) ?? `${v.voterId}号`}</span>
            <span className="vote-arrow">→</span>
            <span>{playerNameMap.get(v.targetId) ?? `${v.targetId}号`}</span>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* 票数统计 */}
      {tally.length > 0 && (
        <div style={{
          marginTop: 12,
          paddingTop: 12,
          borderTop: '1px solid var(--border)',
          display: 'flex',
          gap: 16,
          flexWrap: 'wrap',
        }}>
          {tally.map(([targetId, count]) => (
            <motion.div
              key={targetId}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
            >
              <span>{playerNameMap.get(targetId) ?? `${targetId}号`}</span>
              <span className="vote-count">{count}</span>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default VotePanel;
