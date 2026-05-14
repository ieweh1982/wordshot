import { v4 as uuidv4 } from 'uuid';
import { Danmu, AIRecommendationResult, AIReplyItem, Script } from '../types';
import { getAIManager } from './AIManager';
import { searchScripts } from './scriptService';
import * as db from './database';

export interface RecommendationOptions {
  maxReplies?: number;      // Maximum number of reply suggestions
  minConfidence?: number;   // Minimum confidence threshold
  useCacheFirst?: boolean;  // Whether to search cache first (default: true)
}

/**
 * AIRecommendationEngine - AI Recommendation Engine
 *
 * Features:
 * - Cache-first: Search script library for similar content first
 * - Script library search: Uses FTS5 full-text search
 * - LLM generation: Call LLM when no script available
 * - Store in pending_scripts: Generated recommendations stored for review
 */
export class AIRecommendationEngine {
  private aiManager = getAIManager();

  /**
   * Generate recommendations for a danmu
   *
   * Flow:
   * 1. Search script library for similar content (cache-first)
   * 2. If found, return cached scripts as recommendations
   * 3. If not found, call LLM to generate recommendations
   * 4. Store generated recommendations in pending_scripts table
   */
  public async generateRecommendation(
    danmu: Danmu,
    options: RecommendationOptions = {}
  ): Promise<AIRecommendationResult> {
    const maxReplies = options.maxReplies ?? 3;
    const minConfidence = options.minConfidence ?? 0.5;
    const useCacheFirst = options.useCacheFirst ?? true;

    let replies: AIReplyItem[] = [];

    // Step 1: Try to find cached scripts from script library
    if (useCacheFirst) {
      replies = await this.searchCachedScripts(danmu, maxReplies);
    }

    // Step 2: If no cached scripts found, generate with LLM
    if (replies.length === 0) {
      replies = await this.generateWithLLM(danmu, maxReplies, minConfidence);
    }

    // Step 3: Filter by confidence threshold
    replies = replies.filter(r => r.confidence >= minConfidence);

    return {
      danmu,
      replies,
      generatedAt: Date.now(),
    };
  }

  /**
   * Batch process multiple danmu
   */
  public async generateBatchRecommendations(
    danmus: Danmu[],
    options: RecommendationOptions = {}
  ): Promise<AIRecommendationResult[]> {
    const results: AIRecommendationResult[] = [];

    for (const danmu of danmus) {
      const result = await this.generateRecommendation(danmu, options);
      results.push(result);
    }

    return results;
  }

  /**
   * Search script library for similar scripts using FTS5
   */
  private async searchCachedScripts(
    danmu: Danmu,
    maxResults: number
  ): Promise<AIReplyItem[]> {
    try {
      // Use the danmu content as the search query
      const scripts = searchScripts(danmu.content);

      if (scripts.length === 0) {
        return [];
      }

      // Map scripts to reply items
      // Assign confidence based on priority and usage count
      const replies: AIReplyItem[] = scripts.slice(0, maxResults).map((script, index) => ({
        order: index + 1,
        content: script.content,
        confidence: this.calculateCacheConfidence(script),
      }));

      return replies;
    } catch (error) {
      console.error('Error searching cached scripts:', error);
      return [];
    }
  }

  /**
   * Calculate confidence score for cached scripts
   */
  private calculateCacheConfidence(script: Script): number {
    // Base confidence from priority (0.5 - 1.0)
    const priorityScore = 0.5 + (script.priority / 10) * 0.5;

    // Usage bonus (up to 0.2)
    const usageScore = Math.min(script.usageCount / 100, 1) * 0.2;

    // Recency bonus (up to 0.1)
    let recencyScore = 0;
    if (script.lastUsedAt) {
      const daysSinceUse = (Date.now() - script.lastUsedAt) / (1000 * 60 * 60 * 24);
      recencyScore = Math.max(0, 0.1 - (daysSinceUse / 30) * 0.1);
    }

    return Math.min(priorityScore + usageScore + recencyScore, 1.0);
  }

  /**
   * Generate recommendations using LLM
   */
  private async generateWithLLM(
    danmu: Danmu,
    maxReplies: number,
    minConfidence: number
  ): Promise<AIReplyItem[]> {
    const systemPrompt = `You are a helpful live streaming assistant AI.
Your task is to generate recommended replies to viewer danmu (comments).
You should generate 1-${maxReplies} natural, engaging replies that a streamer might use.

Guidelines:
- Replies should be natural and conversational
- Each reply should be different and offer variety
- Replies should match the tone and style of live streaming
- Consider the danmu type and sentiment when generating replies
- Generate replies that encourage engagement

Output format:
Return a JSON array of reply objects with fields:
- order: number (starting from 1)
- content: string (the reply text)
- confidence: number (0.0 to 1.0, higher = more confident)

Only return the JSON array, no other text.`;

    const userMessage = `Generate recommended replies for this danmu:
- Username: ${danmu.username}
- Content: ${danmu.content}
- Type: ${danmu.type}
- Importance: ${danmu.importance}
- Sentiment: ${danmu.sentiment}`;

    try {
      const response = await this.aiManager.generateChatCompletion(
        systemPrompt,
        userMessage,
        { temperature: 0.8, maxTokens: 1000 }
      );

      // Parse the JSON response
      const replies = this.parseLLMResponse(response);

      // Store generated scripts in pending_scripts table
      await this.storePendingScripts(danmu, replies);

      return replies;
    } catch (error) {
      console.error('Error generating with LLM:', error);
      return [];
    }
  }

  /**
   * Parse LLM response to extract reply items
   */
  private parseLLMResponse(response: string): AIReplyItem[] {
    try {
      // Try to extract JSON array from response
      let jsonStr = response.trim();

      // Handle cases where response might have markdown code blocks
      const jsonMatch = jsonStr.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }

      const parsed = JSON.parse(jsonStr) as Array<{
        order?: number;
        content?: string;
        confidence?: number;
      }>;

      return parsed
        .filter(item => item.content)
        .map(item => ({
          order: item.order || 1,
          content: item.content || '',
          confidence: Math.max(0, Math.min(1, item.confidence || 0.5)),
        }))
        .sort((a, b) => a.order - b.order);
    } catch (error) {
      console.error('Error parsing LLM response:', error);
      return [];
    }
  }

  /**
   * Store generated scripts in pending_scripts table
   */
  private async storePendingScripts(
    danmu: Danmu,
    replies: AIReplyItem[]
  ): Promise<void> {
    const database = db.getDatabase();

    const stmt = database.prepare(`
      INSERT INTO pending_scripts (originalDanmu, content, category, status, createdAt)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const reply of replies) {
      // Only store if confidence is above threshold
      if (reply.confidence >= 0.6) {
        stmt.run(
          JSON.stringify({
            id: danmu.id,
            userId: danmu.userId,
            username: danmu.username,
            content: danmu.content,
            type: danmu.type,
          }),
          reply.content,
          this.inferCategory(danmu),
          'pending',
          Date.now()
        );
      }
    }
  }

  /**
   * Infer script category from danmu type
   */
  private inferCategory(danmu: Danmu): string {
    const categoryMap: Record<string, string> = {
      gift: 'thanks',
      big_gift: 'thanks',
      follower: 'thanks',
      question: 'interaction',
      praise: 'praise',
      normal: 'interaction',
      ribbit: 'rebuttal',
      provocative: 'rebuttal',
      hater: 'rebuttal',
      vip: 'interaction',
      pk: 'interaction',
    };

    return categoryMap[danmu.type] || 'interaction';
  }

  /**
   * Get pending scripts for review
   */
  public getPendingScripts(): any[] {
    return db.getPendingScripts();
  }

  /**
   * Approve a pending script and move it to the script library
   */
  public approvePendingScript(pendingId: number, scriptId: string): boolean {
    try {
      const pending = db.getPendingScripts().find(p => (p as any).id === pendingId);
      if (!pending) {
        return false;
      }

      const script: Script = {
        id: scriptId,
        category: (pending as any).category as any,
        content: (pending as any).content,
        color: '#ffffff',
        priority: 5,
        triggers: [],
        tags: ['ai-generated', 'pending-review'],
        usageCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      db.approveScript(pendingId, script);
      return true;
    } catch (error) {
      console.error('Error approving pending script:', error);
      return false;
    }
  }

  /**
   * Reject a pending script
   */
  public rejectPendingScript(pendingId: number): boolean {
    try {
      db.rejectScript(pendingId);
      return true;
    } catch (error) {
      console.error('Error rejecting pending script:', error);
      return false;
    }
  }
}

// Singleton instance
let engineInstance: AIRecommendationEngine | null = null;

export function getAIRecommendationEngine(): AIRecommendationEngine {
  if (!engineInstance) {
    engineInstance = new AIRecommendationEngine();
  }
  return engineInstance;
}

export function resetAIRecommendationEngine(): void {
  engineInstance = null;
}
