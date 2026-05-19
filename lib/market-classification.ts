export type MarketPrimaryCategory = "文案" | "图片" | "声音" | "视频";

export type MarketClassification = {
  category: MarketPrimaryCategory;
  confidence: number;
  topic?: string;
  scores: Record<MarketPrimaryCategory, number>;
};

type CategoryRule = {
  category: MarketPrimaryCategory;
  pattern: RegExp;
  weight: number;
};

const DELIVERY_RULES: CategoryRule[] = [
  {
    category: "文案",
    pattern: /文案|文章|标题|金句|口号|slogan|话术|卖点|脚本|总结|回复|攻略|公众号|小红书|笔记|brief/i,
    weight: 5
  },
  {
    category: "文案",
    pattern: /策划|方案|计划|规划|提案|运营|项目|召集令|招募|商业计划|bp|需求梳理|活动方案|项目书|企划/i,
    weight: 5
  },
  {
    category: "图片",
    pattern: /图片|海报|logo|标志|头像|主图|修图|插画|封面|配图|banner|kv|长图|名片|包装|画面|出图|表情包/i,
    weight: 6
  },
  {
    category: "声音",
    pattern: /音频|配音|声音|音乐|歌曲|降噪|录音|bgm|配乐|音效|旁白|播客/i,
    weight: 6
  },
  {
    category: "视频",
    pattern: /视频|剪辑|字幕|vlog|数字人|短片|混剪|分镜|成片|片头|片尾|口播|动画|短剧/i,
    weight: 6
  }
];

const CONTEXT_RULES: CategoryRule[] = [
  {
    category: "文案",
    pattern: /视频脚本|短视频脚本|分镜脚本|口播稿|拍摄脚本|小红书文案|推广文案|品牌文案/i,
    weight: 4
  },
  {
    category: "图片",
    pattern: /视觉设计|平面设计|海报设计|logo设计|包装设计|封面设计|主视觉|图片生成/i,
    weight: 4
  },
  {
    category: "视频",
    pattern: /视频制作|视频剪辑|成片制作|短视频制作|数字人播报|动画制作/i,
    weight: 4
  },
  {
    category: "声音",
    pattern: /背景音乐|音频制作|配音制作|歌曲制作|声音处理/i,
    weight: 4
  }
];

const WEAK_CONTEXT_RULES: CategoryRule[] = [
  {
    category: "图片",
    pattern: /设计|品牌|视觉|排版|宣传/i,
    weight: 1
  },
  {
    category: "文案",
    pattern: /内容|创意|传播|推广|营销|产品/i,
    weight: 1
  }
];

const TOPIC_RULES = [
  { label: "项目策划", pattern: /项目|策划|方案|计划|规划|提案|召集令|招募|运营/ },
  { label: "小红书文案", pattern: /小红书|种草|笔记|标题/ },
  { label: "视频脚本", pattern: /视频脚本|脚本|短视频|vlog|分镜|剪辑/ },
  { label: "图文海报", pattern: /海报|图文|主图|封面|配图|图片/ },
  { label: "城市文旅", pattern: /文旅|旅游|城市|攻略|景区|出行/ },
  { label: "品牌推广", pattern: /推广|品牌|产品|营销|宣传|卖点/ },
  { label: "声音制作", pattern: /配音|音频|音乐|声音|歌曲|降噪/ }
];

function applyRules(text: string, scores: Record<MarketPrimaryCategory, number>, rules: CategoryRule[]) {
  for (const rule of rules) {
    if (rule.pattern.test(text)) {
      scores[rule.category] += rule.weight;
    }
  }
}

function getConfidence(bestScore: number, secondScore: number) {
  if (bestScore <= 0) return 0.35;

  const gap = bestScore - secondScore;
  const base = Math.min(0.9, 0.5 + bestScore / 20);
  const gapBonus = Math.min(0.08, gap / 50);
  return Number(Math.max(0.45, Math.min(0.98, base + gapBonus)).toFixed(2));
}

export function classifyMarketTask(description: string): MarketClassification {
  const text = description.toLowerCase();
  const scores: Record<MarketPrimaryCategory, number> = {
    文案: 0,
    图片: 0,
    声音: 0,
    视频: 0
  };

  applyRules(text, scores, DELIVERY_RULES);
  applyRules(text, scores, CONTEXT_RULES);
  applyRules(text, scores, WEAK_CONTEXT_RULES);

  const ranked = (Object.entries(scores) as [MarketPrimaryCategory, number][]).sort((left, right) => right[1] - left[1]);
  const [bestCategory, bestScore] = ranked[0];
  const [, secondScore] = ranked[1];
  const topic = TOPIC_RULES.find((rule) => rule.pattern.test(description))?.label;

  return {
    category: bestScore > 0 ? bestCategory : "文案",
    confidence: getConfidence(bestScore, secondScore),
    topic,
    scores
  };
}
