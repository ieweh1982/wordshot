/**
 * DanmuReplyService - Danmu Reply Generation Service
 *
 * Features:
 * - Two-tier matching: trigger-based first, then content-based, then LLM
 * - Persona influence on LLM prompts
 * - Script usage tracking
 * - Confidence scoring
 */

import {
  Danmu,
  Script,
  AIReplyItem,
  DanmuReplyRequest,
  DanmuReplyResult,
  DanmuReplyResponse,
  TriggerType,
  DanmuType,
} from '../types';
import { searchScripts, getScriptsByTrigger, useScript, getAllScripts } from './scriptService';
import { getPersonaService } from './PersonaService';
import { getAIManager } from './AIManager';

export interface DanmuReplyOptions {
  maxReplies?: number;
  minConfidence?: number;
  useTriggerMatch?: boolean;
  useContentMatch?: boolean;
  useLLMFallback?: boolean;
  personaId?: string;
}

// Mapping from DanmuType to TriggerType[]
const DANMU_TYPE_TO_TRIGGERS: Record<DanmuType, TriggerType[]> = {
  normal: [],
  gift: ['gift'],
  big_gift: ['big_gift', 'gift'],
  follower: ['follower'],
  question: ['question'],
  hater: ['hater', 'negative'],
  ribbit: ['ribbit', 'negative'],
  provocative: ['provocative', 'negative'],
  vip: ['vip'],
  pk: ['vote'],
  praise: ['praise'],
};

class DanmuReplyService {
  private aiManager = getAIManager();

  async generateReply(
    request: DanmuReplyRequest,
    options: DanmuReplyOptions = {}
  ): Promise<DanmuReplyResponse> {
    const maxReplies = options.maxReplies ?? 3;
    const minConfidence = options.minConfidence ?? 0.5;
    const useTriggerMatch = options.useTriggerMatch ?? true;
    const useContentMatch = options.useContentMatch ?? true;
    const useLLMFallback = options.useLLMFallback ?? true;

    const danmu = request.danmu;
    const persona = options.personaId
      ? getPersonaService().getPersonaById(options.personaId)
      : (request.persona || getPersonaService().getActivePersona());

    const results: DanmuReplyResult[] = [];

    // Step 1: Trigger-based matching
    if (useTriggerMatch) {
      const triggerMatches = this.matchByTriggers(danmu, maxReplies);
      results.push(...triggerMatches);
    }

    // Step 2: Content FTS matching
    if (useContentMatch && results.length < maxReplies) {
      const contentMatches = await this.matchByContent(danmu, maxReplies - results.length);

      const existingIds = new Set(results.map((r) => r.matchedScriptId));
      const newMatches = contentMatches.filter((r) => !existingIds.has(r.matchedScriptId));

      results.push(...newMatches);
    }

    // Step 3: LLM generation
    if (useLLMFallback && results.length === 0) {
      const llmReplies = await this.generateWithLLM(danmu, maxReplies, persona);
      results.push(...llmReplies);
    }

    // Sort by confidence
    results.sort((a, b) => b.reply.confidence - a.reply.confidence);

    const finalReplies = results.slice(0, maxReplies);

    // Track usage for matched scripts
    for (const result of finalReplies) {
      if (result.matchType === 'trigger' || result.matchType === 'content') {
        await useScript(result.matchedScriptId!);
      }
    }

    return {
      danmu,
      replies: finalReplies,
      generatedAt: Date.now(),
      personaUsed: persona?.id,
    };
  }

  private matchByTriggers(danmu: Danmu, maxResults: number): DanmuReplyResult[] {
    const triggerTypes = DANMU_TYPE_TO_TRIGGERS[danmu.type] || [];

    if (triggerTypes.length === 0) {
      return [];
    }

    const scripts = getScriptsByTrigger(triggerTypes);

    const matches = scripts
      .map((script) => {
        const matchedTriggers = script.triggers.filter((t) => triggerTypes.includes(t));
        const exactMatch = matchedTriggers.includes(danmu.type as TriggerType);
        const baseScore = exactMatch ? 0.9 : 0.6;

        return {
          script,
          matchScore: Math.min(baseScore + matchedTriggers.length * 0.03, 1.0),
        };
      })
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, maxResults)
      .map((m) => ({
        reply: {
          order: 0,
          content: m.script.content,
          confidence: this.calculateScriptConfidence(m.script, m.matchScore),
        },
        matchType: 'trigger' as const,
        matchedScriptId: m.script.id,
      }));

    return matches;
  }

  private async matchByContent(danmu: Danmu, maxResults: number): Promise<DanmuReplyResult[]> {
    try {
      const scripts = await searchScripts(danmu.content);

      return scripts.slice(0, maxResults).map((script, index) => ({
        reply: {
          order: 0,
          content: script.content,
          confidence: 0.5 + 0.3 * (1 - index / scripts.length),
        },
        matchType: 'content' as const,
        matchedScriptId: script.id,
      }));
    } catch (error) {
      console.error('[DanmuReplyService] Content match error:', error);
      return [];
    }
  }

  private calculateScriptConfidence(script: Script, baseScore: number): number {
    const priorityScore = (script.priority / 10) * 0.15;
    const usageScore = Math.min(script.usageCount / 100, 1) * 0.1;

    let recencyScore = 0;
    if (script.lastUsedAt) {
      const daysSinceUse = (Date.now() - script.lastUsedAt) / (1000 * 60 * 60 * 24);
      recencyScore = Math.max(0, 0.05 - (daysSinceUse / 30) * 0.05);
    }

    return Math.min(baseScore + priorityScore + usageScore + recencyScore, 1.0);
  }

  private async generateWithLLM(
    danmu: Danmu,
    maxReplies: number,
    persona?: any
  ): Promise<DanmuReplyResult[]> {
    const personaContext = getPersonaService().buildPersonaContext(persona);

    const systemPrompt = `${personaContext}

你是一个直播间主播，需要为观众的弹幕生成回复建议。
请根据上面的角色设定，生成${maxReplies}条合适的回复。

回复要求：
1. 符合角色的说话风格
2. 简短有力（一般不超过20字）
3. 能引发观众互动
4. 根据弹幕内容给出不同风格的回复

弹幕信息：
- 用户名: ${danmu.username}
- 内容: ${danmu.content}
- 类型: ${danmu.type}
- 重要性: ${danmu.importance}
- 情感倾向: ${danmu.sentiment > 0 ? '正面' : danmu.sentiment < 0 ? '负面' : '中性'}

输出格式（仅返回JSON数组）：
[
  {"content": "回复内容1", "confidence": 0.9},
  {"content": "回复内容2", "confidence": 0.8}
]

只返回JSON数组，不要有其他文字。`;

    const userMessage = `请为这条弹幕生成回复：${danmu.content}`;

    try {
      const response = await this.aiManager.generateChatCompletion(
        systemPrompt,
        userMessage,
        { temperature: 0.8, maxTokens: 500 }
      );

      const replies = this.parseLLMResponse(response, maxReplies);

      return replies.map((reply) => ({
        reply,
        matchType: 'llm' as const,
        matchedScriptId: undefined,
      }));
    } catch (error) {
      console.error('[DanmuReplyService] LLM generation error:', error);
      return [];
    }
  }

  private parseLLMResponse(response: string, maxReplies: number): AIReplyItem[] {
    try {
      let jsonStr = response.trim();

      const jsonMatch = jsonStr.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }

      const parsed = JSON.parse(jsonStr) as Array<{
        content?: string;
        confidence?: number;
      }>;

      return parsed
        .filter((item) => item.content)
        .slice(0, maxReplies)
        .map((item, index) => ({
          order: index + 1,
          content: item.content || '',
          confidence: Math.max(0, Math.min(1, item.confidence || 0.5)),
        }));
    } catch (error) {
      console.error('[DanmuReplyService] Parse error:', error);
      return [];
    }
  }
}

let danmuReplyServiceInstance: DanmuReplyService | null = null;

export function getDanmuReplyService(): DanmuReplyService {
  if (!danmuReplyServiceInstance) {
    danmuReplyServiceInstance = new DanmuReplyService();
  }
  return danmuReplyServiceInstance;
}