// 谁是卧底 — 词库

import type { WordPair } from './GameState.js';

// 词对设计原则：
// 1. 两个词属于同一类别，有相似性但有明确区别
// 2. 避免过于依赖中文文化的词（照顾国外模型）
// 3. 描述空间要大——能从多个角度描述，不会一句话就暴露

export const WORD_PAIRS: WordPair[] = [
  // 饮品
  { civilian: '咖啡', undercover: '奶茶' },
  { civilian: '可乐', undercover: '雪碧' },
  { civilian: '啤酒', undercover: '鸡尾酒' },
  { civilian: '豆浆', undercover: '牛奶' },

  // 交通
  { civilian: '地铁', undercover: '公交车' },
  { civilian: '高铁', undercover: '飞机' },
  { civilian: '自行车', undercover: '电动车' },
  { civilian: '出租车', undercover: '网约车' },

  // 食物
  { civilian: '火锅', undercover: '烧烤' },
  { civilian: '饺子', undercover: '包子' },
  { civilian: '面条', undercover: '米饭' },
  { civilian: '蛋糕', undercover: '面包' },
  { civilian: '薯条', undercover: '薯片' },

  // 电子产品
  { civilian: '手机', undercover: '平板' },
  { civilian: '耳机', undercover: '音箱' },
  { civilian: '笔记本电脑', undercover: '台式电脑' },

  // 社交/通讯
  { civilian: '微信', undercover: '短信' },
  { civilian: '朋友圈', undercover: '微博' },
  { civilian: '视频通话', undercover: '语音通话' },

  // 娱乐
  { civilian: '电影院', undercover: '剧院' },
  { civilian: '游泳', undercover: '泡温泉' },
  { civilian: '唱歌', undercover: '跳舞' },
  { civilian: '小说', undercover: '漫画' },

  // 动物
  { civilian: '猫', undercover: '狗' },
  { civilian: '老鹰', undercover: '麻雀' },
  { civilian: '金鱼', undercover: '乌龟' },

  // 场所
  { civilian: '图书馆', undercover: '书店' },
  { civilian: '医院', undercover: '诊所' },
  { civilian: '超市', undercover: '便利店' },
  { civilian: '公园', undercover: '游乐场' },

  // 天气/自然
  { civilian: '下雨', undercover: '下雪' },
  { civilian: '日出', undercover: '日落' },
  { civilian: '大海', undercover: '湖泊' },
];
