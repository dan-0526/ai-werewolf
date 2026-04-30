import { type FC } from 'react';
import { type PlayerMeta, ROLE_CONFIG } from '../types';

interface Props {
  player: PlayerMeta;
  isSpeaking: boolean;
  isDead: boolean;
  showRole: boolean;
  size?: number;
}

const PlayerSeat: FC<Props> = ({ player, isSpeaking, isDead, showRole, size = 80 }) => {
  // 用模型首字母作为默认头像
  const initials = player.modelKey
    .split('-')
    .map((s) => s[0]?.toUpperCase() ?? '')
    .join('');

  const roleConfig = ROLE_CONFIG[player.role];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, position: 'relative' }}>
      {/* 头像 */}
      <div style={{ position: 'relative', width: size, height: size }}>
        <div
          className={`player-avatar ${isSpeaking ? 'speaking' : ''} ${isDead ? 'dead' : ''}`}
          style={{
            width: size,
            height: size,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: size * 0.3,
            fontWeight: 700,
            background: isDead ? '#555' : roleConfig.color + '22',
            color: isDead ? '#888' : roleConfig.color,
          }}
        >
          {initials}
        </div>

        {/* 身份角标 */}
        {showRole && (
          <span
            className="role-badge"
            style={{ background: roleConfig.color }}
          >
            {roleConfig.icon} {roleConfig.label}
          </span>
        )}

        {/* 死亡标记 */}
        {isDead && (
          <div className="death-mark">
            <span style={{ opacity: 0.7 }}>✕</span>
          </div>
        )}
      </div>

      {/* 名字 */}
      <div style={{
        fontSize: 13,
        fontWeight: 600,
        color: isDead ? 'var(--text-muted)' : 'var(--text)',
        textAlign: 'center',
        maxWidth: size + 20,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        textDecoration: isDead ? 'line-through' : 'none',
      }}>
        {player.name}
      </div>
    </div>
  );
};

export default PlayerSeat;
