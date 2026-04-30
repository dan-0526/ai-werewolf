import { type FC } from 'react';

// 每个 AI 模型的品牌配置
const MODEL_BRANDS: Record<string, { color: string; bg: string; icon: string; label: string }> = {
  'claude-opus':      { color: '#D4A574', bg: '#2D1F14', icon: 'C',  label: 'Opus' },
  'claude-sonnet':    { color: '#D4A574', bg: '#1A1410', icon: 'C',  label: 'Sonnet' },
  'deepseek-v4':      { color: '#4D9EFF', bg: '#0A1628', icon: 'D',  label: 'V4' },
  'deepseek-r1':      { color: '#4D9EFF', bg: '#0A1628', icon: 'D',  label: 'R1' },
  'kimi':             { color: '#6C5CE7', bg: '#1A1230', icon: 'K',  label: 'Kimi' },
  'minimax':          { color: '#A855F7', bg: '#1E0A30', icon: 'M',  label: 'MiniMax' },
  'doubao-character':  { color: '#00D4AA', bg: '#0A2820', icon: '豆', label: 'Character' },
  'doubao-pro':       { color: '#00D4AA', bg: '#0A2820', icon: '豆', label: 'Pro' },
  'glm':              { color: '#3B82F6', bg: '#0A1428', icon: 'G',  label: 'GLM' },
  'ernie':            { color: '#EF4444', bg: '#280A0A', icon: 'E',  label: 'ERNIE' },
  'qwen':             { color: '#F97316', bg: '#281A0A', icon: 'Q',  label: 'Qwen' },
  'gpt-5.4':          { color: '#10A37F', bg: '#0A2820', icon: 'G',  label: 'GPT' },
};

const DEFAULT_BRAND = { color: '#888', bg: '#1a1a1a', icon: '?', label: '?' };

interface Props {
  modelKey: string;
  size: number;
}

const ModelAvatar: FC<Props> = ({ modelKey, size }) => {
  const brand = MODEL_BRANDS[modelKey] ?? DEFAULT_BRAND;
  const fontSize = brand.icon.length > 1 ? size * 0.32 : size * 0.42;

  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <defs>
        <radialGradient id={`bg-${modelKey}`} cx="30%" cy="30%">
          <stop offset="0%" stopColor={brand.bg} stopOpacity="1" />
          <stop offset="100%" stopColor="#000" stopOpacity="1" />
        </radialGradient>
        <radialGradient id={`glow-${modelKey}`} cx="50%" cy="50%">
          <stop offset="0%" stopColor={brand.color} stopOpacity="0.3" />
          <stop offset="70%" stopColor={brand.color} stopOpacity="0.05" />
          <stop offset="100%" stopColor={brand.color} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* 背景圆 */}
      <circle cx="50" cy="50" r="46" fill={`url(#bg-${modelKey})`} />

      {/* 内发光 */}
      <circle cx="50" cy="50" r="46" fill={`url(#glow-${modelKey})`} />

      {/* 品牌色边框 */}
      <circle cx="50" cy="50" r="46" fill="none" stroke={brand.color} strokeWidth="2.5" opacity="0.6" />

      {/* 图标/字母 */}
      <text
        x="50"
        y="50"
        textAnchor="middle"
        dominantBaseline="central"
        fill={brand.color}
        fontSize={fontSize}
        fontWeight="800"
        fontFamily="-apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif"
      >
        {brand.icon}
      </text>

      {/* 底部标签 */}
      <text
        x="50"
        y="78"
        textAnchor="middle"
        fill={brand.color}
        fontSize="11"
        fontWeight="600"
        opacity="0.7"
        fontFamily="-apple-system, BlinkMacSystemFont, sans-serif"
      >
        {brand.label}
      </text>
    </svg>
  );
};

export default ModelAvatar;
export { MODEL_BRANDS };
