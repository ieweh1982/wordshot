import { AIProviderConfig } from '../types';
import { getAIProviders, saveAIProviders } from './configStorage';

export interface LLMRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  temperature?: number;
  max_tokens?: number;
}

export interface LLMResponse {
  content: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * AIManager - AI Multi-Provider Management
 *
 * Supports:
 * - Multiple AI Provider configurations (baseURL + apiKey + model + priority)
 * - Reading ai_providers.json configuration
 * - Selecting available Provider by priority
 * - Unified AI request interface with failover
 */
export class AIManager {
  private providers: AIProviderConfig[] = [];
  private enabledProviders: AIProviderConfig[] = [];

  constructor() {
    this.loadProviders();
  }

  /**
   * Load providers from configuration file
   */
  public loadProviders(): void {
    const config = getAIProviders();
    this.providers = config.providers;
    this.enabledProviders = this.providers
      .filter(p => p.enabled)
      .sort((a, b) => a.priority - b.priority); // Lower priority number = higher priority
  }

  /**
   * Save providers to configuration file
   */
  public saveProviders(): void {
    saveAIProviders({ providers: this.providers });
    this.loadProviders(); // Reload to update enabledProviders
  }

  /**
   * Get all providers
   */
  public getProviders(): AIProviderConfig[] {
    return [...this.providers];
  }

  /**
   * Get all enabled providers sorted by priority
   */
  public getEnabledProviders(): AIProviderConfig[] {
    return [...this.enabledProviders];
  }

  /**
   * Add or update a provider
   */
  public setProvider(provider: AIProviderConfig): void {
    const index = this.providers.findIndex(p => p.id === provider.id);
    if (index >= 0) {
      this.providers[index] = provider;
    } else {
      this.providers.push(provider);
    }
    this.saveProviders();
  }

  /**
   * Remove a provider by ID
   */
  public removeProvider(providerId: string): boolean {
    const index = this.providers.findIndex(p => p.id === providerId);
    if (index >= 0) {
      this.providers.splice(index, 1);
      this.saveProviders();
      return true;
    }
    return false;
  }

  /**
   * Enable or disable a provider
   */
  public setProviderEnabled(providerId: string, enabled: boolean): boolean {
    const provider = this.providers.find(p => p.id === providerId);
    if (provider) {
      provider.enabled = enabled;
      this.saveProviders();
      return true;
    }
    return false;
  }

  /**
   * Get provider by ID
   */
  public getProviderById(providerId: string): AIProviderConfig | undefined {
    return this.providers.find(p => p.id === providerId);
  }

  /**
   * Call LLM with automatic failover across providers
   */
  public async callLLM(request: LLMRequest): Promise<LLMResponse> {
    console.warn('[AIManager] callLLM called with', this.enabledProviders.length, 'enabled providers');
    const errors: string[] = [];

    for (const provider of this.enabledProviders) {
      try {
        const response = await this.callProvider(provider, request);
        return response;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        errors.push(`${provider.name}: ${errorMsg}`);
        console.warn(`AI Provider ${provider.name} failed, trying next provider...`, errorMsg);
      }
    }

    throw new Error(`All AI providers failed: ${errors.join('; ')}`);
  }

  /**
   * Call a specific provider
   */
  private async callProvider(provider: AIProviderConfig, request: LLMRequest): Promise<LLMResponse> {
    console.warn('[AIManager] callProvider called for provider:', provider.name, provider.baseURL);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add authorization header if apiKey is provided
    if (provider.apiKey) {
      headers['Authorization'] = `Bearer ${provider.apiKey}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), provider.timeout);

    // Check if we're in Electron environment with IPC bridge
    const api = (window as any).electronAPI;
    const useIPC = api && typeof api.chatCompletion === 'function';
    console.log('[AIManager] useIPC:', useIPC, 'api:', !!api, 'chatCompletion:', typeof api?.chatCompletion);

    try {
      let responseData: any;

      if (useIPC) {
        // Use IPC bridge to route through main process (avoids CORS)
        console.log('[AIManager] Using IPC bridge for chat completion');
        // Use longer timeout (10 minutes for AI responses)
        const result = await api.chatCompletion({
          provider: {
            baseURL: provider.baseURL,
            apiKey: provider.apiKey,
            model: request.model || provider.model,
            timeout: Math.max(provider.timeout, 600000), // 10 minutes
          },
          messages: request.messages,
          temperature: request.temperature ?? 0.7,
          max_tokens: request.max_tokens ?? 128000,
        });

        clearTimeout(timeoutId);

        console.log('[AIManager] IPC result:', JSON.stringify(result));

        if (!result.success) {
          throw new Error(result.error || 'Unknown error');
        }

        // Handle both OpenAI-compatible and xunfei formats
        let content = result.content;
        if (!content && result.data) {
          // xunfei might use different structure
          content = result.data.text || result.data.result || JSON.stringify(result.data);
        }

        // Return directly instead of going through responseData
        return {
          content: content || '',
          usage: result.usage,
        };
      } else {
        // Browser fallback - direct fetch (may fail due to CORS)
        console.log('[AIManager] Using direct fetch (browser mode)');
        const response = await fetch(`${provider.baseURL}/chat/completions`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: request.model || provider.model,
            messages: request.messages,
            temperature: request.temperature ?? 0.7,
            max_tokens: request.max_tokens ?? 2000,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        responseData = await response.json();
      }

      // Handle OpenAI-compatible response format
      if (responseData.choices && responseData.choices[0]) {
        return {
          content: responseData.choices[0].message?.content || '',
          usage: responseData.usage,
        };
      }

      throw new Error('Invalid response format from AI provider');
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Generate a chat completion using the first available provider
   */
  public async generateChatCompletion(
    systemPrompt: string,
    userMessage: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<string> {
    const response = await this.callLLM({
      model: '', // Use provider's default model
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 8192, // Limit response tokens to prevent long generation
    });

    return response.content;
  }
}

// Singleton instance
let aimanagerInstance: AIManager | null = null;

export function getAIManager(): AIManager {
  if (!aimanagerInstance) {
    aimanagerInstance = new AIManager();
  }
  return aimanagerInstance;
}

export function resetAIManager(): void {
  aimanagerInstance = null;
}
