import { type FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Faction, PlayerMeta } from '../types';
import { ROLE_CONFIG } from '../types';

interface Props {
  winner?: Faction;
  summary?: string;
  players: PlayerMeta[];
  visible: boolean;
}

const GameOverScreen: FC<Props> = ({ winner, summary, players, visible }) => {
  if (!visible || !winner) return null;

  const isWolfWin = winner === 'werewolf';
  const bgColor = isWolfWin
    ? 'rgba(192, 57, 43, 0.95)'
    : 'rgba(39, 174, 96, 0.95)';

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="game-over-overlay"
          style={{ background: bgColor, color: 'white' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
        >
          <motion.div
            style={{ fontSize: 72, marginBottom: 16 }}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: 'spring', stiffness: 150 }}
          >
            {isWolfWin ? '🐺' : '🎉'}
          </motion.div>

          <motion.div
            className="winner-text"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            {isWolfWin ? '狼人阵营获胜' : '好人阵营获胜'}
          </motion.div>

          {summary && (
            <motion.div
              style={{ fontSize: 18, maxWidth: 600, textAlign: 'center', lineHeight: 1.6, marginBottom: 32 }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
            >
              {summary}
            </motion.div>
          )}

          {/* 身份揭晓 */}
          <motion.div
            style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
          >
            {players.map((p) => {
              const rc = ROLE_CONFIG[p.role];
              return (
                <div
                  key={p.id}
                  style={{
                    background: 'rgba(255,255,255,0.15)',
                    borderRadius: 12,
                    padding: '10px 16px',
                    textAlign: 'center',
                    minWidth: 100,
                  }}
                >
                  <div style={{ fontSize: 24 }}>{rc.icon}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>{p.name}</div>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>{rc.label}</div>
                </div>
              );
            })}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default GameOverScreen;
