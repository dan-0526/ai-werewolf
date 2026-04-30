// 模型标识 → Edge TTS 声线映射
// 可用中文声线（edge-tts 7.x）:
//   zh-CN-XiaoxiaoNeural  (Female, 温柔)
//   zh-CN-XiaoyiNeural    (Female, 活泼)
//   zh-CN-YunjianNeural   (Male, 年轻)
//   zh-CN-YunxiNeural     (Male, 沉稳)
//   zh-CN-YunxiaNeural    (Male, 少年)
//   zh-CN-YunyangNeural   (Male, 播报风)
//   zh-CN-liaoning-XiaobeiNeural  (Female, 东北方言)
//   zh-CN-shaanxi-XiaoniNeural    (Female, 陕西方言)

export const VOICE_MAP: Record<string, string> = {
  'claude-opus':       'zh-CN-YunxiNeural',        // 男，沉稳
  'claude-sonnet':     'zh-CN-YunjianNeural',       // 男，年轻锐利
  'deepseek-v4':       'zh-CN-YunxiaNeural',        // 男，少年
  'deepseek-r1':       'zh-CN-YunyangNeural',       // 男，播报风
  'kimi':              'zh-CN-XiaoyiNeural',         // 女，活泼
  'minimax':           'zh-CN-XiaoxiaoNeural',       // 女，温柔
  'doubao-character':  'zh-CN-liaoning-XiaobeiNeural', // 女，东北味（泼辣性格匹配）
  'doubao-pro':        'zh-CN-YunxiNeural',          // 男，沉稳（复用，语速可区分）
  'glm':               'zh-CN-shaanxi-XiaoniNeural', // 女，陕西味
  'ernie':             'zh-CN-XiaoxiaoNeural',       // 女，温柔（复用）
  'qwen':              'zh-CN-XiaoyiNeural',         // 女，活泼（复用）
  'gpt-5.4':           'zh-CN-YunjianNeural',        // 男，年轻（复用）
};

export const NARRATOR_VOICE = 'zh-CN-YunyangNeural';  // 旁白，播报风格
