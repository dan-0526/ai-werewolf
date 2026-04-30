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
 * 横屏布局 16:9 (1920×1080)
 * 玩家围坐一圈，中间是投票/系统消息区
 * 底部字幕条显示发言
 */
const LandscapeLayout: FC<Props> = ({
  players, speakingId, deadIds, centerContent, subtitleBar, statusBar, overlay, themeClass,
}) => {
  const positions = [
    { top: '6%', left: '15%' },
    { top: '6%', left: '43%' },
    { top: '6%', left: '71%' },
    { top: '38%', left: '5%' },
    { top: '38%', left: '81%' },
    { top: '70%', left: '5%' },
    { top: '70%', left: '81%' },
    { top: '70%', left: '30%' },
    { top: '70%', left: '56%' },
  ];

  return (
    <div className={`layout-landscape ${themeClass}`}>
      {players.map((p, i) => {
        const pos = positions[i] ?? positions[0];
        return (
          <div
            key={p.id}
            style={{
              position: 'absolute',
              top: pos.top,
              left: pos.left,
              transform: 'translate(-50%, 0)',
              zIndex: 10,
            }}
          >
            <PlayerSeat
              player={p}
              isSpeaking={speakingId === p.id}
              isDead={deadIds.has(p.id)}
              showRole={true}
              size={80}
            />
          </div>
        );
      })}

      {/* 中间内容区（投票、系统消息） */}
      <div style={{
        position: 'absolute',
        top: '18%',
        left: '18%',
        right: '18%',
        bottom: '22%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        overflow: 'auto',
        zIndex: 5,
      }}>
        {centerContent}
      </div>

      {/* 字幕条 */}
      {subtitleBar}

      {/* 底部状态栏 */}
      {statusBar}

      {overlay}
    </div>
  );
};

export default LandscapeLayout;
