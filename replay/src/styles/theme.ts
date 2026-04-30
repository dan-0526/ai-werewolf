// 主题配置

export const theme = {
  night: {
    bg: '#0a0e1a',
    surface: '#141b2d',
    surfaceAlt: '#1a2340',
    text: '#e0e6f0',
    textMuted: '#8892a4',
    accent: '#4a6fa5',
    border: '#2a3550',
  },
  day: {
    bg: '#f5f0e8',
    surface: '#ffffff',
    surfaceAlt: '#f8f6f1',
    text: '#2c3e50',
    textMuted: '#7f8c8d',
    accent: '#2980b9',
    border: '#e0ddd5',
  },
  role: {
    werewolf: '#c0392b',
    seer: '#2980b9',
    witch: '#8e44ad',
    hunter: '#e67e22',
    villager: '#27ae60',
  },
  wolfChat: {
    bg: 'rgba(192, 57, 43, 0.12)',
    border: 'rgba(192, 57, 43, 0.3)',
  },
} as const;
