import { type FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PHASE_LABELS, isNightPhase } from '../types';

interface Props {
  phase?: string;
  day?: number;
  visible: boolean;
}

const PhaseTransition: FC<Props> = ({ phase, day, visible }) => {
  if (!phase || !visible) return null;

  const isNight = isNightPhase(phase);
  const icon = isNight ? '🌙' : phase === 'game_over' ? '🏆' : '☀️';
  const label = PHASE_LABELS[phase] ?? phase;
  const bgColor = isNight
    ? 'rgba(10, 14, 26, 0.92)'
    : 'rgba(245, 240, 232, 0.92)';
  const textColor = isNight ? '#e0e6f0' : '#2c3e50';

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="phase-overlay"
          style={{ background: bgColor, color: textColor }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
        >
          <motion.div
            className="phase-icon"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          >
            {icon}
          </motion.div>
          <motion.div
            className="phase-text"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            {day ? `第${day}天` : ''} {label}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PhaseTransition;
