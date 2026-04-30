import { type FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  speakerName?: string;
  text: string;
  isWolfChat?: boolean;
  privateNote?: string;
}

const SpeechBubble: FC<Props> = ({ speakerName, text, isWolfChat, privateNote }) => {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={speakerName}
        className={`speech-bubble ${isWolfChat ? 'wolf-chat' : ''}`}
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.3 }}
      >
        {speakerName && (
          <div className="speaker-name">
            {speakerName}
            {isWolfChat && <span className="wolf-tag">🐺 密谋</span>}
          </div>
        )}
        <div style={{ lineHeight: 1.7 }}>{text}</div>
        {privateNote && (
          <div style={{
            marginTop: 8,
            paddingTop: 8,
            borderTop: '1px dashed var(--border)',
            fontSize: '0.85em',
            color: 'var(--text-muted)',
            fontStyle: 'italic',
          }}>
            💭 {privateNote}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default SpeechBubble;
