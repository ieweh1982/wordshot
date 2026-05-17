/**
 * PersonaService - Character/Persona Configuration Management
 *
 * Features:
 * - CRUD operations for persona configurations
 * - Default persona for different streaming styles
 * - Persona validation and migration
 * - Storage via localStorage (browser) or IPC (Electron)
 */

import { PersonaConfig, PersonaSpeakingStyle, PersonaReplyTone } from '../types';

const PERSONA_STORAGE_KEY = 'wordshot_personas';
const DEFAULT_PERSONA_ID = 'default_talk_show';

export interface CreatePersonaInput {
  name: string;
  description?: string;
  personalityTraits?: string[];
  speakingStyle?: PersonaSpeakingStyle;
  replyTone?: PersonaReplyTone;
  responseLength?: 'short' | 'medium' | 'long';
  customGuidelines?: string;
}

// Pre-defined personas for quick start
export const DEFAULT_PERSONAS: Omit<PersonaConfig, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: '脱口秀主播',
    description: '幽默风趣，擅长自嘲和调侃，能机智回应观众',
    personalityTraits: ['幽默', '自嘲', '机智', '亲和'],
    speakingStyle: 'humorous',
    replyTone: 'teasing',
    responseLength: 'medium',
    customGuidelines: '回复要简短有力，适度自嘲，多用网络流行语，保持轻松氛围',
  },
  {
    name: '才艺主播',
    description: '擅长唱歌表演，温暖鼓励观众',
    personalityTraits: ['热情', '鼓励', '专业', '温暖'],
    speakingStyle: 'warm',
    replyTone: 'caring',
    responseLength: 'short',
    customGuidelines: '回复要简洁温暖，多用感叹句，鼓励观众打赏和关注',
  },
  {
    name: '游戏主播',
    description: '专注游戏解说，理性分析，操作骚气',
    personalityTraits: ['专业', '骚气', '冷静', '搞笑'],
    speakingStyle: 'casual',
    replyTone: 'friendly',
    responseLength: 'short',
    customGuidelines: '回复要简短，游戏术语丰富，适度玩梗，保持弹幕互动',
  },
  {
    name: '带货主播',
    description: '专业销售，热情推销，催单能力强',
    personalityTraits: ['热情', '专业', '催促', '实惠'],
    speakingStyle: 'energetic',
    replyTone: 'friendly',
    responseLength: 'medium',
    customGuidelines: '回复要突出产品卖点，强调优惠，催促下单，不拖泥带水',
  },
];

class PersonaService {
  private personas: Map<string, PersonaConfig> = new Map();
  private activePersonaId: string | null = null;

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(PERSONA_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as PersonaConfig[];
        parsed.forEach((p) => this.personas.set(p.id, p));
      }

      if (this.personas.size === 0) {
        this.initializeDefaults();
      }

      if (!this.activePersonaId) {
        this.activePersonaId = DEFAULT_PERSONA_ID;
      }
    } catch (e) {
      console.error('[PersonaService] Failed to load personas:', e);
      this.initializeDefaults();
    }
  }

  private saveToStorage(): void {
    try {
      const arr = Array.from(this.personas.values());
      localStorage.setItem(PERSONA_STORAGE_KEY, JSON.stringify(arr));
    } catch (e) {
      console.error('[PersonaService] Failed to save personas:', e);
    }
  }

  private initializeDefaults(): void {
    DEFAULT_PERSONAS.forEach((p, index) => {
      const id = index === 0 ? DEFAULT_PERSONA_ID : `persona_${Date.now()}_${index}`;
      const now = Date.now();
      this.personas.set(id, {
        ...p,
        id,
        createdAt: now,
        updatedAt: now,
      } as PersonaConfig);
    });

    this.activePersonaId = DEFAULT_PERSONA_ID;
    this.saveToStorage();
  }

  getAllPersonas(): PersonaConfig[] {
    return Array.from(this.personas.values());
  }

  getPersonaById(id: string): PersonaConfig | undefined {
    return this.personas.get(id);
  }

  getActivePersona(): PersonaConfig | undefined {
    if (!this.activePersonaId) return undefined;
    return this.personas.get(this.activePersonaId);
  }

  setActivePersona(id: string): boolean {
    if (!this.personas.has(id)) return false;
    this.activePersonaId = id;
    return true;
  }

  createPersona(input: CreatePersonaInput): PersonaConfig {
    const now = Date.now();
    const persona: PersonaConfig = {
      id: `persona_${now}_${Math.random().toString(36).substr(2, 9)}`,
      name: input.name,
      description: input.description || '',
      personalityTraits: input.personalityTraits || [],
      speakingStyle: input.speakingStyle || 'casual',
      replyTone: input.replyTone || 'friendly',
      responseLength: input.responseLength || 'medium',
      customGuidelines: input.customGuidelines || '',
      createdAt: now,
      updatedAt: now,
    };

    this.personas.set(persona.id, persona);
    this.saveToStorage();
    return persona;
  }

  updatePersona(id: string, updates: Partial<CreatePersonaInput>): PersonaConfig | undefined {
    const existing = this.personas.get(id);
    if (!existing) return undefined;

    const updated: PersonaConfig = {
      ...existing,
      ...updates,
      updatedAt: Date.now(),
    };

    this.personas.set(id, updated);
    this.saveToStorage();
    return updated;
  }

  deletePersona(id: string): boolean {
    if (id === DEFAULT_PERSONA_ID) return false;

    const deleted = this.personas.delete(id);
    if (deleted && this.activePersonaId === id) {
      this.activePersonaId = DEFAULT_PERSONA_ID;
    }
    this.saveToStorage();
    return deleted;
  }

  buildPersonaContext(persona?: PersonaConfig): string {
    if (!persona) {
      persona = this.getActivePersona();
    }

    if (!persona) {
      return '你是一个友善的直播间主播。';
    }

    const traits = persona.personalityTraits.join('、');
    const styleMap: Record<PersonaSpeakingStyle, string> = {
      casual: '轻松随意',
      energetic: '活力四射',
      warm: '温暖亲切',
      humorous: '幽默风趣',
      sarcastic: '幽默讽刺',
      professional: '专业严谨',
      playful: '俏皮可爱',
      cool: '高冷路线',
      rebellious: '叛逆不羁',
    };

    const toneMap: Record<PersonaReplyTone, string> = {
      friendly: '友善热情',
      teasing: '调侃逗趣',
      serious: '认真专业',
      humorous: '幽默风趣',
      stylish: '酷炫有型',
      caring: '关怀备至',
    };

    const lengthDesc =
      persona.responseLength === 'short'
        ? '简短精炼'
        : persona.responseLength === 'long'
          ? '详细丰富'
          : '适中';

    return `你是${persona.name}（${persona.description}）。
你的性格特点：${traits}。
说话风格：${styleMap[persona.speakingStyle]}。
回复语气：${toneMap[persona.replyTone]}。
回复长度：${lengthDesc}。
${persona.customGuidelines ? `额外要求：${persona.customGuidelines}` : ''}`;
  }
}

let personaServiceInstance: PersonaService | null = null;

export function getPersonaService(): PersonaService {
  if (!personaServiceInstance) {
    personaServiceInstance = new PersonaService();
  }
  return personaServiceInstance;
}