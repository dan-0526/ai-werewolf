import { type FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  content: string;
  visible: boolean;
}

const SystemMessage: FC<Props> = ({ content, visible }) => {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="system-message"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.4 }}
        >
          📢 {content}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SystemMessage;
