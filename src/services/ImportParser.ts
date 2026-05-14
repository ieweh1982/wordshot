import { Script, ScriptCategory } from '../types';
import { getAIManager } from './AIManager';
import { preprocessTranscript, PreprocessResult } from './TextPreprocessor';
import { generateNumericId } from './IdGenerator';

export interface ParsedScript {
  category: ScriptCategory | 'uncategorized';
  content: string;
  tags: string[];
  confidence: number; // 0-1, how confident the parser is about the category
}

export interface ParseResult {
  scripts: ParsedScript[];
  unrecognizedLines: string[];
  statistics: {
    totalLines: number;
    parsedCount: number;
    unrecognizedCount: number;
  };
}

// Category keywords for rule-based parsing
const CATEGORY_KEYWORDS: Record<ScriptCategory, string[]> = {
  thanks: ['感谢', '谢谢', '感谢大哥', '感谢老板', '谢了', '多谢', '感谢老铁', '谢谢老板', '礼物', '火箭', '飞机', '航母'],
  rebuttal: ['回击', '来啊', '有本事', '当面说', '黑粉', '喷子', '键盘侠', '杠精', '不服', '来战', '喷我', '骂我'],
  interaction: ['互动', '扣', '投票', '觉得', '觉得主播', '同意的', '认可的', '评论', '留言', '聊聊', '说说'],
  ad: ['带货', '链接', '购买', '下单', '优惠券', '特价', '秒杀', '库存', '宝贝', '商品', '卖', '购'],
  praise: ['夸', '夸赞', '夸人', '好看', '漂亮', '帅气', '美', '真棒', '厉害', '优秀', '不错'],
  opening: ['开播', '开场', '欢迎', '欢迎来到', '大家', '朋友们', '开播了', '开始了', '上线'],
  closing: ['闭播', '下播', '结束', '拜拜', '再见', '感谢观看', '下次见', '收工', '下播了'],
  lottery: ['抽奖', '抽', '中奖', '幸运', '福袋', '红包', '抽奖', '抽中', '恭喜'],
  crisis: ['危机', '节奏', '节奏点', '节奏大师', '节奏来了', '黑料', '节奏党'],
};

/**
 * Generate a unique ID
 */
function generateId(): string {
  return generateNumericId();
}

/**
 * Detect category based on keywords
 */
function detectCategoryByKeywords(content: string): { category: ScriptCategory | null; confidence: number } {
  const lowerContent = content.toLowerCase();

  let bestMatch: ScriptCategory | null = null;
  let bestScore = 0;

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = 0;
    for (const keyword of keywords) {
      if (lowerContent.includes(keyword.toLowerCase())) {
        score++;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = category as ScriptCategory;
    }
  }

  return {
    category: bestMatch,
    confidence: bestScore > 0 ? Math.min(bestScore / 3, 1) : 0,
  };
}

/**
 * Parse plain text format
 * Format: Category indicators followed by content lines
 * Example:
 * # 感谢类
 * 感谢大哥送来的火箭！
 * 谢谢老板的礼物~
 */
export function parseTextFormat(content: string): ParseResult {
  const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  const scripts: ParsedScript[] = [];
  const unrecognizedLines: string[] = [];

  let currentCategory: ScriptCategory | 'uncategorized' = 'uncategorized';
  const categoryHeaderRegex = /^#\s*(\S+)[\s\S]*$/;
  const categoryNames: Record<string, ScriptCategory> = {
    '感谢': 'thanks',
    '感谢类': 'thanks',
    '回击': 'rebuttal',
    '回击类': 'rebuttal',
    '互动': 'interaction',
    '互动类': 'interaction',
    '带货': 'ad',
    '带货类': 'ad',
    '夸': 'praise',
    '夸奖': 'praise',
    '夸奖类': 'praise',
    '开播': 'opening',
    '开播类': 'opening',
    '闭播': 'closing',
    '闭播类': 'closing',
    '抽奖': 'lottery',
    '抽奖类': 'lottery',
    '危机': 'crisis',
    '危机类': 'crisis',
  };

  for (const line of lines) {
    // Check if it's a category header
    const headerMatch = line.match(categoryHeaderRegex);
    if (headerMatch) {
      const categoryName = headerMatch[1];
      if (categoryNames[categoryName]) {
        currentCategory = categoryNames[categoryName];
        continue;
      }
    }

    // Check if it's a markdown header without # (just category name)
    for (const [name, cat] of Object.entries(categoryNames)) {
      if (line === name || line === name + '类') {
        currentCategory = cat;
        continue;
      }
    }

    // If it's content
    if (line.length > 0 && !line.startsWith('#')) {
      const { category, confidence } = detectCategoryByKeywords(line);
      const finalCategory = currentCategory === 'uncategorized' && category
        ? category
        : currentCategory;

      if (finalCategory === 'uncategorized' && confidence < 0.3) {
        unrecognizedLines.push(line);
      } else {
        scripts.push({
          category: finalCategory,
          content: line,
          tags: [],
          confidence: finalCategory !== 'uncategorized' ? 0.8 : confidence,
        });
      }
    }
  }

  return {
    scripts,
    unrecognizedLines,
    statistics: {
      totalLines: lines.length,
      parsedCount: scripts.length,
      unrecognizedCount: unrecognizedLines.length,
    },
  };
}

/**
 * Parse Markdown format with headers as category separators
 * Example:
 * # 感谢类
 * 内容1
 * 内容2
 *
 * # 回击类
 * 内容3
 */
export function parseMarkdown(content: string): ParseResult {
  // First try to parse as structured markdown
  const scripts: ParsedScript[] = [];
  const unrecognizedLines: string[] = [];

  // Split by markdown headers (# Category)
  const headerRegex = /^#\s+(.+?)[\s]*$/gm;
  const parts = content.split(headerRegex);

  // If we have matched headers, parts[0] is before first header, parts[1,2] are header+content pairs, etc.
  if (parts.length > 1) {
    // First part is before any header - treat as uncategorized
    const firstPart = parts[0].trim();
    if (firstPart) {
      const lines = firstPart.split('\n').filter(l => l.trim());
      for (const line of lines) {
        unrecognizedLines.push(line.trim());
      }
    }

    // Process header + content pairs
    for (let i = 1; i < parts.length; i += 2) {
      const header = parts[i]?.trim() || '';
      const body = parts[i + 1] || '';

      // Map header to category
      const categoryMap: Record<string, ScriptCategory> = {
        '感谢': 'thanks',
        '感谢类': 'thanks',
        '回击': 'rebuttal',
        '回击类': 'rebuttal',
        '互动': 'interaction',
        '互动类': 'interaction',
        '带货': 'ad',
        '带货类': 'ad',
        '夸': 'praise',
        '夸奖': 'praise',
        '夸奖类': 'praise',
        '开播': 'opening',
        '开播类': 'opening',
        '闭播': 'closing',
        '闭播类': 'closing',
        '抽奖': 'lottery',
        '抽奖类': 'lottery',
        '危机': 'crisis',
        '危机类': 'crisis',
      };

      const category = categoryMap[header];

      // Parse body content
      const contentLines = body
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0 && !line.startsWith('#'));

      for (const line of contentLines) {
        if (!category) {
          const { category: detectedCat, confidence } = detectCategoryByKeywords(line);
          if (detectedCat) {
            scripts.push({
              category: detectedCat,
              content: line,
              tags: [],
              confidence,
            });
          } else {
            unrecognizedLines.push(line);
          }
        } else {
          scripts.push({
            category: category as ScriptCategory,
            content: line,
            tags: [],
            confidence: 0.9,
          });
        }
      }
    }
  } else {
    // No headers found, treat as plain text
    return parseTextFormat(content);
  }

  return {
    scripts,
    unrecognizedLines,
    statistics: {
      totalLines: content.split('\n').filter(l => l.trim()).length,
      parsedCount: scripts.length,
      unrecognizedCount: unrecognizedLines.length,
    },
  };
}

/**
 * Use AI to convert text/markdown to scripts with proper categorization
 * With intelligent preprocessing for transcript content
 */
export async function useAIConversion(
  content: string,
  options?: {
    onProgress?: (stage: string) => void;
  }
): Promise<ParseResult> {
  const aimanager = getAIManager();

  options?.onProgress?.('正在预处理内容...');

  // Step 1: Preprocess the content
  const preprocessResult = preprocessTranscript(content);
  console.log('[ImportParser] Preprocess result:', preprocessResult);

  // Step 2: First AI call - identify host name and content type (lightweight)
  options?.onProgress?.('正在识别内容信息...');

  const analysisPrompt = `你是一个直播内容分析助手。请分析以下内容，识别：

1. 主播自称的名称（如"我是宝哥"、"叫我宝哥"）
2. 内容类型（脱口秀/带货/聊天/其他）
3. 主要特点

【重要】只看文本内容，识别主播自称的昵称。
如果主播自称是"宝哥"，返回：{"hostName": "宝哥", "contentType": "脱口秀", "notes": "..."}
如果无法识别，返回：{"hostName": null, "contentType": "其他", "notes": "..."}

直接返回JSON，不要有其他内容。`;

  let hostName = preprocessResult.identifiedHost;
  let contentType = preprocessResult.contentType;

  try {
    const analysisResponse = await aimanager.generateChatCompletion(
      analysisPrompt,
      `分析以下内容：\n\n${content.substring(0, 8000)}`, // First 8000 chars for analysis
      { temperature: 0.3, maxTokens: 8000 }
    );

    const jsonMatch = analysisResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.hostName) {
        hostName = parsed.hostName;
      }
      if (parsed.contentType) {
        contentType = parsed.contentType;
      }
    }
  } catch (error) {
    console.warn('[ImportParser] Analysis failed, using preprocess result:', error);
  }

  console.log('[ImportParser] Identified host:', hostName, 'content type:', contentType);

  // Step 3: Main parsing with optimized prompt
  const systemPrompt = `你是一个直播话术解析专家。请解析并分类话术。

【内容类型】${contentType}
【主播昵称】${hostName || '未知'}

【预处理规则】
- 已移除时间戳和发言人标签
- 已移除语气词（啊、嗯、哎、哈哈等）
- 空行和过渡语句已清理

【占位符规则】
- 主播名称已统一替换为【主播】
- 用户/观众名称已统一替换为【用户】
- 保持话术的自然表达，只替换名称，不替换其他内容

【话术合并规则 - 重要！】
1. 语义连贯的句子必须合并为一条话术，不要拆分！
   - 例如："你看我像缺你的人吗？咱说。啊，活到这个年纪了，已经没有兴趣给别人留下好印象了。" 应合并为一条
   - 例如："你人前不敢卸下自己的伪装，人后不敢直视自己的肮脏。哎，是不是你世俗不容，好色人又怂？" 应合并为一条
2. 避免过度拆分：单句太短（如"你看我像缺你的人吗？"）没有独立意义，应与上下文合并
3. 判断标准：如果删除某句后意思不完整，说明应该合并

【分类类别】
- thanks: 感谢类（感谢礼物、感谢关注、感谢观众）
- rebuttal: 回击类（回应黑粉、调侃、反驳）
- interaction: 互动类（提问、互动、让观众参与）
- ad: 带货类（推广产品、引导购买）
- praise: 夸奖类（夸观众、夸产品）
- opening: 开播类（欢迎、开场、暖场）
- closing: 闭播类（告别、下播、收尾）
- lottery: 抽奖类（抽奖、福利、红包）
- crisis: 危机类（处理节奏、危机公关）

【重要规则】
1. 每条话术要有完整的语义，不得拆分语义连贯的句子
2. 每条话术长度至少10个字以上
3. 分类要准确，不要归类到"uncategorized"
4. confidence 0.0-1.0，表示分类确信度
5. 保留话术的核心意思，即使有省略号或截断

返回JSON格式：
{
  "scripts": [
    {"category": "thanks", "content": "感谢【用户】送来的小心心", "tags": ["感谢", "小心心"], "confidence": 0.95},
    {"category": "rebuttal", "content": "我不好欺负，别得寸进尺，你欺负我我退一步，你还欺负我我就全力以赴", "tags": ["回击", "强硬"], "confidence": 0.9}
  ],
  "unrecognizedLines": ["无法归类的内容"],
  "summary": {"total": 10, "thanks": 3, "rebuttal": 2, ...}
}`;

  options?.onProgress?.('正在调用 AI 分析...');

  try {
    const cleanedContent = preprocessResult.cleanedContent;
    // Limit content to prevent long processing time
    const truncatedContent = cleanedContent.length > 5000
      ? cleanedContent.substring(0, 5000) + '\n\n[内容过长已截断...]'
      : cleanedContent;

    console.log('[ImportParser] Sending to AI - cleanedContent length:', cleanedContent.length, 'truncated:', cleanedContent.length > 5000);

    const response = await aimanager.generateChatCompletion(
      systemPrompt,
      `请分析并分类以下内容：\n\n${truncatedContent}`,
      {
        temperature: 0.3,
        maxTokens: 128000,
      }
    );

    options?.onProgress?.('正在解析 AI 返回结果...');

    // Parse JSON response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse AI response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      scripts: (parsed.scripts || []).map((s: any) => ({
        category: (s.category || 'uncategorized') as ScriptCategory | 'uncategorized',
        content: s.content || '',
        tags: s.tags || [],
        confidence: s.confidence || 0.5,
      })),
      unrecognizedLines: parsed.unrecognizedLines || [],
      statistics: {
        totalLines: cleanedContent.split('\n').filter(l => l.trim()).length,
        parsedCount: (parsed.scripts || []).length,
        unrecognizedCount: (parsed.unrecognizedLines || []).length,
      },
    };
  } catch (error) {
    console.error('AI conversion failed:', error);
    // Fall back to rule-based parsing
    options?.onProgress?.('AI 分析失败，使用规则解析...');
    return parseTextFormat(content);
  }
}

/**
 * Convert ParsedScript array to Script array ready for storage
 */
export function convertToScripts(parsedScripts: ParsedScript[]): Script[] {
  return parsedScripts.map(parsed => ({
    id: generateId(),
    category: parsed.category === 'uncategorized' ? 'interaction' : parsed.category,
    content: parsed.content,
    color: '#ffffff',
    priority: 5,
    triggers: [],
    tags: parsed.tags,
    usageCount: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }));
}

/**
 * Export scripts to JSON format
 */
export function exportToJSON(scripts: Script[]): string {
  return JSON.stringify(scripts, null, 2);
}

/**
 * Export scripts to Markdown format
 */
export function exportToMarkdown(scripts: Script[], includeMetadata: boolean = false): string {
  const categoryNames: Record<string, string> = {
    thanks: '感谢类',
    rebuttal: '回击类',
    interaction: '互动类',
    ad: '带货类',
    praise: '夸奖类',
    opening: '开播类',
    closing: '闭播类',
    lottery: '抽奖类',
    crisis: '危机类',
  };

  // Group scripts by category
  const grouped = new Map<string, Script[]>();
  for (const script of scripts) {
    const cat = script.category;
    if (!grouped.has(cat)) {
      grouped.set(cat, []);
    }
    grouped.get(cat)!.push(script);
  }

  let markdown = '';

  for (const [category, categoryScripts] of grouped) {
    const catName = categoryNames[category] || category;
    markdown += `# ${catName}\n\n`;

    for (const script of categoryScripts) {
      markdown += script.content + '\n\n';

      if (includeMetadata && (script.tags.length > 0 || script.priority !== 5)) {
        const meta: string[] = [];
        if (script.tags.length > 0) {
          meta.push(`标签: ${script.tags.join(', ')}`);
        }
        if (script.priority !== 5) {
          meta.push(`优先级: ${script.priority}`);
        }
        markdown += `> ${meta.join(' | ')}\n\n`;
      }
    }

    markdown += '---\n\n';
  }

  return markdown.trim();
}

/**
 * Export scripts to plain text format
 */
export function exportToText(scripts: Script[]): string {
  const categoryNames: Record<string, string> = {
    thanks: '【感谢类】',
    rebuttal: '【回击类】',
    interaction: '【互动类】',
    ad: '【带货类】',
    praise: '【夸奖类】',
    opening: '【开播类】',
    closing: '【闭播类】',
    lottery: '【抽奖类】',
    crisis: '【危机类】',
  };

  // Group scripts by category
  const grouped = new Map<string, Script[]>();
  for (const script of scripts) {
    const cat = script.category;
    if (!grouped.has(cat)) {
      grouped.set(cat, []);
    }
    grouped.get(cat)!.push(script);
  }

  let text = '';

  for (const [category, categoryScripts] of grouped) {
    const catName = categoryNames[category] || `【${category}】`;
    text += `${catName}\n`;

    for (const script of categoryScripts) {
      text += `  ${script.content}\n`;
    }

    text += '\n';
  }

  return text.trim();
}

/**
 * Parse Excel file content (expects base64 encoded .xlsx)
 * This is a simplified implementation - in production you'd use a proper xlsx library
 */
export function parseExcelContent(base64Content: string): ParseResult {
  // Note: Full Excel parsing would require a library like 'xlsx'
  // This is a placeholder for the interface
  return {
    scripts: [],
    unrecognizedLines: [],
    statistics: {
      totalLines: 0,
      parsedCount: 0,
      unrecognizedCount: 0,
    },
  };
}

/**
 * Generate Excel-compatible data from scripts
 */
export function scriptsToExcelData(scripts: Script[]): Array<Array<string | number>> {
  const headers = ['分类', '内容', '标签', '优先级', '使用次数', '创建时间'];
  const rows: Array<Array<string | number>> = [headers];

  const categoryNames: Record<string, string> = {
    thanks: '感谢类',
    rebuttal: '回击类',
    interaction: '互动类',
    ad: '带货类',
    praise: '夸奖类',
    opening: '开播类',
    closing: '闭播类',
    lottery: '抽奖类',
    crisis: '危机类',
  };

  for (const script of scripts) {
    rows.push([
      categoryNames[script.category] || script.category,
      script.content,
      script.tags.join(', '),
      script.priority,
      script.usageCount,
      new Date(script.createdAt).toLocaleDateString('zh-CN'),
    ]);
  }

  return rows;
}
