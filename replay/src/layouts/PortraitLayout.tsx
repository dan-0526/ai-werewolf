import { type FC, type ReactNode } from 'react';
import type { PlayerMeta } from '../types';
import PlayerSeat from '../components/PlayerSeat';

interface Props {
  players: PlayerMeta[];
  speakingId?: number;
  deadIds: Set<number>;
  centerContent: ReactNode;
  subtitleBar: ReactNode;
  statusBar: ReactNode;
  overlay?: ReactNode;
  themeClass: string;
}

/**
 * 竖屏布局 9:16 (1080×1920)
 * 上方 5 人，下方 4 人，中间投票/系统消息，底部字幕
 */
const PortraitLayout: FC<Props> = ({
  players, speakingId, deadIds, centerContent, subtitleBar, statusBar, overlay, themeClass,
}) => {
  const topRow = players.slice(0, 5);
  const bottomRow = players.slice(5, 9);

  return (
    <div className={`layout-portrait ${themeClass}`} style={{ '--font-size-speech': '22px', '--bubble-max-width': '90%' } as React.CSSProperties}>
      {/* 顶部玩家 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-around',
        padding: '24px 16px 12px',
        zIndex: 10,
        position: 'relative',
      }}>
        {topRow.map((p) => (
          <PlayerSeat
            key={p.id}
            player={p}
            isSpeaking={speakingId === p.id}
            isDead={deadIds.has(p.id)}
            showRole={true}
            size={60}
          />
        ))}
      </div>

      {/* 中间内容区（投票、系统消息） */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px 24px',
        overflow: 'auto',
        minHeight: 0,
        position: 'relative',
        zIndex: 5,
      }}>
        {centerContent}
      </div>

      {/* 底部玩家 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-around',
        padding: '12px 24px 8px',
        zIndex: 10,
        position: 'relative',
      }}>
        {bottomRow.map((p) => (
          <PlayerSeat
            key={p.id}
            player={p}
            isSpeaking={speakingId === p.id}
            isDead={deadIds.has(p.id)}
            showRole={true}
            size={60}
          />
        ))}
      </div>

      {/* 字幕条 */}
      {subtitleBar}

      {/* 底部状态栏 */}
      {statusBar}

      {overlay}
    </div>
  );
};

export default PortraitLayout;
