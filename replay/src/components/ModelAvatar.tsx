import { type FC } from 'react';

// modelKey → 头像文件名 + 品牌色
const MODEL_BRANDS: Record<string, { avatar: string; color: string; label: string }> = {
  'claude-opus':       { avatar: 'claude.png',   color: '#D4A574', label: 'Opus' },
  'claude-sonnet':     { avatar: 'claude.png',   color: '#D4A574', label: 'Sonnet' },
  'deepseek-v4':       { avatar: 'deepseek.png', color: '#4D9EFF', label: 'V4' },
  'deepseek-r1':       { avatar: 'deepseek.png', color: '#4D9EFF', label: 'R1' },
  'kimi':              { avatar: 'kimi.png',     color: '#6C5CE7', label: 'Kimi' },
  'minimax':           { avatar: 'minimax.png',  color: '#A855F7', label: 'MiniMax' },
  'doubao-character':  { avatar: 'doubao.png',   color: '#00D4AA', label: 'Character' },
  'doubao-pro':        { avatar: 'doubao.png',   color: '#00D4AA', label: 'Pro' },
  'glm':               { avatar: 'glm.png',      color: '#3B82F6', label: 'GLM' },
  'ernie':             { avatar: 'ernie.png',     color: '#EF4444', label: 'ERNIE' },
  'qwen':              { avatar: 'qwen.png',      color: '#F97316', label: 'Qwen' },
  'gpt-5.4':           { avatar: 'openai.png',    color: '#10A37F', label: 'GPT' },
};

const DEFAULT_BRAND = { avatar: '', color: '#888', label: '?' };

interface Props {
  modelKey: string;
  size: number;
}

const ModelAvatar: FC<Props> = ({ modelKey, size }) => {
  const brand = MODEL_BRANDS[modelKey] ?? DEFAULT_BRAND;

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        border: `2px solid ${brand.color}`,
        overflow: 'hidden',
        flexShrink: 0,
        background: '#0a0e1a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: `0 0 ${size * 0.2}px ${brand.color}33`,
      }}
    >
      {brand.avatar ? (
        <img
          src={`/avatars/${brand.avatar}`}
          alt={brand.label}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <span style={{ color: brand.color, fontSize: size * 0.4, fontWeight: 800 }}>?</span>
      )}
    </div>
  );
};

export default ModelAvatar;
export { MODEL_BRANDS };
