import { type FC, type ReactNode } from 'react';
import type { PlayerMeta } from '../types';
import PlayerSeat from '../components/PlayerSeat';

interface Props {
  players: PlayerMeta[];
  speakingId?: number;
  deadIds: Set<number>;
  centerContent: ReactNode;
}

const LandscapeLayout: FC<Props> = ({ players, speakingId, deadIds, centerContent }) => {
  const left = players.slice(0, 5);
  const right = players.slice(5, 9);

  return (
    <div className="main-body">
      <div className="side-column">
        {left.map((p) => (
          <PlayerSeat key={p.id} player={p} isSpeaking={speakingId === p.id} isDead={deadIds.has(p.id)} showRole size={80} />
        ))}
      </div>
      <div className="center-area">{centerContent}</div>
      <div className="side-column">
        {right.map((p) => (
          <PlayerSeat key={p.id} player={p} isSpeaking={speakingId === p.id} isDead={deadIds.has(p.id)} showRole size={80} />
        ))}
      </div>
    </div>
  );
};

export default LandscapeLayout;
