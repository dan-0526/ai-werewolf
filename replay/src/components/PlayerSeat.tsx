import { type FC } from 'react';
import { type PlayerMeta, ROLE_CONFIG } from '../types';
import ModelAvatar from './ModelAvatar';

interface Props {
  player: PlayerMeta;
  isSpeaking: boolean;
  isDead: boolean;
  showRole: boolean;
  size?: number;
}

const PlayerSeat: FC<Props> = ({ player, isSpeaking, isDead, showRole, size = 80 }) => {
  const roleConfig = ROLE_CONFIG[player.role];
  const ringSize = size + 12;

  return (
    <div className={`player-seat ${isSpeaking ? 'is-speaking' : ''} ${isDead ? 'is-dead' : ''}`}>
      {/* 头像区域 */}
      <div className="player-avatar-wrap" style={{ width: ringSize, height: ringSize }}>
        {/* 装饰性外环 */}
        <svg
          className="avatar-ring"
          width={ringSize}
          height={ringSize}
          viewBox="0 0 100 100"
          style={{ position: 'absolute', inset: 0 }}
        >
          <defs>
            <linearGradient id={`ring-${player.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={isSpeaking ? '#f5c842' : '#8B7355'} />
              <stop offset="50%" stopColor={isSpeaking ? '#ffe082' : '#C4A46C'} />
              <stop offset="100%" stopColor={isSpeaking ? '#f5c842' : '#8B7355'} />
            </linearGradient>
          </defs>
          <circle
            cx="50" cy="50" r="47"
            fill="none"
            stroke={`url(#ring-${player.id})`}
            strokeWidth={isSpeaking ? '3.5' : '2.5'}
            opacity={isDead ? 0.3 : 0.9}
          />
          {/* 内圈装饰线 */}
          <circle
            cx="50" cy="50" r="44"
            fill="none"
            stroke={isSpeaking ? '#f5c842' : '#6B5B45'}
            strokeWidth="0.8"
            opacity={isDead ? 0.2 : 0.5}
            strokeDasharray="4 3"
          />
        </svg>

        {/* 模型头像 */}
        <div style={{
          position: 'absolute',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
        }}>
          <ModelAvatar modelKey={player.modelKey} size={size} />
        </div>

        {/* 发言光效 */}
        {isSpeaking && (
          <div className="speaking-glow" style={{
            position: 'absolute', inset: 0,
            borderRadius: '50%',
            boxShadow: '0 0 20px rgba(245, 200, 66, 0.4), 0 0 40px rgba(245, 200, 66, 0.15)',
            pointerEvents: 'none',
          }} />
        )}

        {/* 死亡遮罩 */}
        {isDead && (
          <div className="death-overlay">
            <span>出局</span>
          </div>
        )}

        {/* 身份角标 */}
        {showRole && (
          <span
            className="role-badge"
            style={{
              background: roleConfig.color,
              opacity: isDead ? 0.5 : 1,
            }}
          >
            {roleConfig.icon} {roleConfig.label}
          </span>
        )}
      </div>

      {/* 座位号 + 名字 */}
      <div className="player-info">
        <span className="seat-number">{player.id}号</span>
        <span className="player-name" style={{
          opacity: isDead ? 0.4 : 1,
          textDecoration: isDead ? 'line-through' : 'none',
        }}>
          {player.name}
        </span>
      </div>
    </div>
  );
};

export default PlayerSeat;
