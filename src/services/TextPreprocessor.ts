/**
 * TextPreprocessor - 直播文本智能预处理
 *
 * 功能：
 * 1. 移除时间戳和发言人标签
 * 2. 识别主播名称
 * 3. 去除语气词
 * 4. 过滤人物/账户名称并替换为占位符
 * 5. 识别内容类型
 */

export interface PreprocessResult {
  cleanedContent: string;      // 清理后的内容
  identifiedHost: string;      // 识别的主播名称（如"宝哥"）
  placeholder: string;         // 使用的占位符（如"【主播】"）
  contentType: string;        // 内容类型（脱口秀/带货/聊天等）
  removedCount: number;        // 被移除的项目数量
}

// 语气词列表（用于过滤）
const FILLER_WORDS = [
  '啊', '嗯', '哎', '哦', '噢', '嘛', '呢', '呀', '哈', '呵', '嘿', '呃', '哇', '哟', '唉',
  '哈哈', '哈哈哈', '哈哈哈哈', '呵呵', '嘿嘿', '么么哒', '么么',
  '然后', '那个', '这个', '其实', '就是', '就是就是', '不是', '对不对',
  '是不是', '对吧', '是吧', '我说', '你说', '咱们', '咱们说',
  '咱说', '咱是说', '说实话', '说真的', '我是说', '你看', '你看啊',
];

// 时间戳格式正则
const TIMESTAMP_PATTERNS = [
  /\b\d{1,2}:\d{2}(:\d{2})?\b/g,                              // 00:56, 01:10:30
  /\[\d{1,2}:\d{2}(:\d{2})?\]/g,                               // [00:56]
  /发言人\d+\s+\d{1,2}:\d{2}(:\d{2})?/g,                       // 发言人1 00:56
  /发言人\d+/g,                                                 // 发言人1, 发言人2
  /\(\d{1,2}:\d{2}(:\d{2})?\)/g,                               // (00:56)
  /\d{1,2}:\d{2}(:\d{2})?\s*-\s*\d{1,2}:\d{2}(:\d{2})?/g,     // 00:56 - 01:10
];

// 人物名称模式（需要替换的）
const PERSON_NAME_PATTERNS = [
  /感谢[^，,\s！!?。]{1,8}(哥|姐|叔|姨|总|老板|老师|大哥|小姐姐|老铁|铁子)/g,
  /祝[^，,\s！!?。]{1,8}(哥|姐|叔|姨|总|老板|老师|大哥|小姐姐|老铁|铁子)/g,
  /我们家[^，,\s！!?。]{1,6}(哥|姐|叔|姨|总|老板|老师|大哥|小姐姐)/g,
  /给[^，,\s！!?。]{1,6}(哥|姐|叔|姨|总|老板|老师|大哥|小姐姐)送/g,
  /祝我[^，,\s！!?。]{1,6}(哥|姐|叔|姨|总|老板|老师|大哥|小姐姐)/g,
  /用户[^，,\s！!?。]+/g,                                       // 用户三六九
  /我家[^，,\s！!?。]+/g,                                       // 我家红姐
];

// 主播自称模式
const HOST_SELF_REFERENCE_PATTERNS = [
  /我是([^，,，\s！!?。]{1,8})/g,
  /(?:大家|你们|哥哥|姐姐|老铁)叫我([^，,，\s！!?。]{1,8})/g,
  /叫我([^，,，\s！!?。]{1,8})/g,
  /我的名字叫([^，,，\s！!?。]{1,8})/g,
  /我(?:是|叫)([^，,，\s！!?。]{1,8})(啊|呀|呢)?$/gm,
];

// 内容类型关键词
const CONTENT_TYPE_KEYWORDS = {
  '脱口秀': ['哈哈哈', '笑死', '牛逼', '吹牛', '主播好会说', '口才', '搞笑'],
  '带货': ['链接', '购买', '下单', '库存', '优惠', '秒杀', '特价', '宝贝', '商品', '卖', '购物'],
  '闲聊': ['聊天', '互动', '问答', '家常', '日常'],
};

/**
 * 移除时间戳格式
 */
function removeTimestamps(text: string): string {
  let result = text;
  for (const pattern of TIMESTAMP_PATTERNS) {
    result = result.replace(pattern, '');
  }
  return result;
}

/**
 * 识别主播名称
 */
function identifyHostName(text: string): string | null {
  const selfRefCounts: Record<string, number> = {};

  // 扩展的主播自称模式
  const hostPatterns = [
    /我是([^，,，\s！!?。]{1,8})/g,
    /(?:大家|你们|哥哥|姐姐|老铁)叫我([^，,，\s！!?。]{1,8})/g,
    /叫我([^，,，\s！!?。]{1,8})/g,
    /我的名字叫([^，,，\s！!?。]{1,8})/g,
    /我(?:是|叫)([^，,，\s！!?。]{1,8})(啊|呀|呢)?$/gm,
    // 添加更多模式来捕获"宝哥"
    /(?:我|咱|咱们)(?:是|叫|名(?:叫|字)?)([^，,，\s！!?。]{1,8})/g,
    /(?:^|\s)([^，,，\s!.?]{2,6})哥(?:\s|$|[，,。!?"'])/gm,  // 匹配 X哥 作为独立词
    /(?:^|\s)([^，,，\s!.?]{2,6})姐(?:\s|$|[，,。!?"'])/gm,  // 匹配 X姐 作为独立词
    /(主播|老师|老板|哥|姐)(?:好|啊)/g,  // 主播好, 哥啊
  ];

  // 统计自称出现的频率
  for (const pattern of hostPatterns) {
    const matches = text.matchAll(new RegExp(pattern.source, pattern.flags));
    for (const match of matches) {
      const name = match[1];
      if (name && name.length >= 2 && name.length <= 6 && !/^\d+$/.test(name)) {
        selfRefCounts[name] = (selfRefCounts[name] || 0) + 1;
      }
    }
  }

  // 查找自称频率最高的名称
  let maxCount = 0;
  let hostName: string | null = null;

  for (const [name, count] of Object.entries(selfRefCounts)) {
    if (count > maxCount && !['我是', '我是说', '咱们', '咱说', '你说'].includes(name)) {
      maxCount = count;
      hostName = name;
    }
  }

  return hostName;
}

/**
 * 识别内容类型
 */
function identifyContentType(text: string): string {
  const typeScores: Record<string, number> = {
    '脱口秀': 0,
    '带货': 0,
    '闲聊': 0,
  };

  for (const [type, keywords] of Object.entries(CONTENT_TYPE_KEYWORDS)) {
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        typeScores[type]++;
      }
    }
  }

  const maxScore = Math.max(...Object.values(typeScores));
  if (maxScore === 0) {
    return '其他';
  }

  return Object.entries(typeScores).find(([, score]) => score === maxScore)?.[0] || '其他';
}

/**
 * 去除语气词
 */
function removeFillerWords(text: string): string {
  let result = text;

  // 移除单个语气词（但保留有意义的词）
  for (const word of FILLER_WORDS) {
    // 使用单词边界来避免误删
    const regex = new RegExp(`\\b${word}\\b`, 'g');
    result = result.replace(regex, '');
  }

  // 移除连续重复的语气词
  result = result.replace(/([啊嗯哎哦噢嘛呢呀哈呵嘿呃哇哟唉])\1{2,}/g, '');
  result = result.replace(/([哈哈呵呵嘿嘿])\\1{1,}/g, '');

  return result;
}

/**
 * 过滤并替换人物名称
 */
function replacePersonNames(text: string, hostName: string | null): string {
  let result = text;

  // 如果识别到主播名称，先替换主播名称为占位符
  if (hostName) {
    // 替换各种称呼变体
    const hostVariants = [
      hostName,
      `${hostName}哥`,
      `${hostName}姐`,
      `宝${hostName.slice(1)}`,  // 宝哥
      hostName.replace(/^(.)/, (m) => m.toUpperCase()),  // 首字母大写
    ];

    for (const variant of hostVariants) {
      result = result.replace(new RegExp(variant, 'g'), '【主播】');
    }
  }

  // 替换其他人物名称为【用户】
  for (const pattern of PERSON_NAME_PATTERNS) {
    result = result.replace(pattern, (match) => {
      // 判断是否是感谢类，如果是则替换为【用户】
      if (match.includes('感谢') || match.includes('祝')) {
        return match.replace(/[^，,\s！!?。]{1,8}(哥|姐|叔|姨|总|老板|老师|大哥|小姐姐|老铁|铁子)/, '【用户】');
      }
      return match;
    });
  }

  // 清理残留的格式
  result = result.replace(/\s+/g, ' ');
  result = result.replace(/【主播】【主播】/g, '【主播】');
  result = result.replace(/【用户】【用户】/g, '【用户】');

  return result;
}

/**
 * 移除空行和过渡性语句
 */
function removeEmptyLines(text: string): string {
  let result = text;

  // 移除空行
  result = result.split('\n').filter(line => line.trim().length > 0).join('\n');

  // 移除只有标点符号的行
  result = result.split('\n').filter(line => {
    const trimmed = line.trim();
    return trimmed.length > 0 && !/^[，。！？、；：""''（）【】\s]+$/.test(trimmed);
  }).join('\n');

  return result;
}

/**
 * 清理特殊字符
 */
function cleanSpecialChars(text: string): string {
  let result = text;

  // 保留中文、标点和基本字母数字
  // 移除控制字符和一些特殊符号
  result = result.replace(/[\x00-\x1F\x7F]/g, '');

  // 规范化引号
  result = result.replace(/[""]/g, '"').replace(/['']/g, "'");

  // 规范化空格
  result = result.replace(/\s+/g, ' ').trim();

  return result;
}

/**
 * 预处理直播文本
 */
export function preprocessTranscript(rawText: string): PreprocessResult {
  let content = rawText;
  let removedCount = 0;

  // 1. 移除时间戳
  const timestampMatches = content.match(/\d{1,2}:\d{2}(:\d{2})?/g) || [];
  removedCount += timestampMatches.length;
  content = removeTimestamps(content);

  // 2. 清理发言人标签（如发言人1、发言人2）
  content = content.replace(/发言人\d+/g, '');

  // 3. 识别主播名称（先做初步识别，不需要AI）
  const hostName = identifyHostName(content);

  // 4. 识别内容类型
  const contentType = identifyContentType(content);

  // 5. 预处理：去除多余空白但保留换行（以便AI理解段落结构）
  content = content.split('\n').map(line => line.trim()).filter(line => line.length > 0).join('\n');

  // 6. 移除空行
  content = removeEmptyLines(content);

  // 7. 清理特殊字符
  content = cleanSpecialChars(content);

  // 8. 去除语气词
  content = removeFillerWords(content);

  // 9. 替换人物名称为占位符
  content = replacePersonNames(content, hostName);

  // 10. 再次清理空行（语气词移除后可能产生空行）
  content = removeEmptyLines(content);

  return {
    cleanedContent: content,
    identifiedHost: hostName || '未知主播',
    placeholder: '【主播】',
    contentType,
    removedCount,
  };
}

/**
 * 批量预处理（用于长文本）
 */
export function batchPreprocess(transcripts: string[], batchSize: number = 50000): PreprocessResult[] {
  return transcripts.map(preprocessTranscript);
}

/**
 * 快速清理（不识别主播，仅移除格式）
 */
export function quickClean(rawText: string): string {
  let content = rawText;
  content = removeTimestamps(content);
  content = removeFillerWords(content);
  content = removeEmptyLines(content);
  content = cleanSpecialChars(content);
  return content;
}