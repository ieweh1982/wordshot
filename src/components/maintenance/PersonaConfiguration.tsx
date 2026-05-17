import React, { useState, useEffect, useCallback } from 'react';
import { getPersonaService, CreatePersonaInput } from '../../services/PersonaService';
import {
  PersonaConfig,
  PersonaSpeakingStyle,
  PersonaReplyTone,
} from '../../types';
import './PersonaConfiguration.css';

const SPEAKING_STYLE_OPTIONS: { value: PersonaSpeakingStyle; label: string }[] = [
  { value: 'casual', label: '轻松随意' },
  { value: 'energetic', label: '活力四射' },
  { value: 'warm', label: '温暖亲切' },
  { value: 'humorous', label: '幽默风趣' },
  { value: 'sarcastic', label: '幽默讽刺' },
  { value: 'professional', label: '专业严谨' },
  { value: 'playful', label: '俏皮可爱' },
  { value: 'cool', label: '高冷路线' },
  { value: 'rebellious', label: '叛逆不羁' },
];

const REPLY_TONE_OPTIONS: { value: PersonaReplyTone; label: string }[] = [
  { value: 'friendly', label: '友善热情' },
  { value: 'teasing', label: '调侃逗趣' },
  { value: 'serious', label: '认真专业' },
  { value: 'humorous', label: '幽默风趣' },
  { value: 'stylish', label: '酷炫有型' },
  { value: 'caring', label: '关怀备至' },
];

const RESPONSE_LENGTH_OPTIONS = [
  { value: 'short', label: '简短' },
  { value: 'medium', label: '适中' },
  { value: 'long', label: '详细' },
];

interface Props {
  className?: string;
}

interface PersonaFormData {
  name: string;
  description: string;
  personalityTraits: string;
  speakingStyle: PersonaSpeakingStyle;
  replyTone: PersonaReplyTone;
  responseLength: 'short' | 'medium' | 'long';
  customGuidelines: string;
}

const DEFAULT_FORM_DATA: PersonaFormData = {
  name: '',
  description: '',
  personalityTraits: '',
  speakingStyle: 'casual',
  replyTone: 'friendly',
  responseLength: 'medium',
  customGuidelines: '',
};

const DEFAULT_PERSONA_ID = 'default_talk_show';

export const PersonaConfiguration: React.FC<Props> = ({ className }) => {
  const [personas, setPersonas] = useState<PersonaConfig[]>([]);
  const [activePersonaId, setActivePersonaId] = useState<string | null>(null);
  const [editingPersona, setEditingPersona] = useState<PersonaConfig | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState<PersonaFormData>(DEFAULT_FORM_DATA);

  const personaService = getPersonaService();

  const loadPersonas = useCallback(() => {
    const allPersonas = personaService.getAllPersonas();
    setPersonas(allPersonas);
    const active = personaService.getActivePersona();
    setActivePersonaId(active?.id || null);
  }, [personaService]);

  useEffect(() => {
    loadPersonas();
  }, [loadPersonas]);

  const handleSetActive = useCallback(
    (id: string) => {
      personaService.setActivePersona(id);
      setActivePersonaId(id);
    },
    [personaService]
  );

  const handleAddPersona = useCallback(() => {
    setEditingPersona(null);
    setFormData(DEFAULT_FORM_DATA);
    setIsDialogOpen(true);
  }, []);

  const handleEditPersona = useCallback((persona: PersonaConfig) => {
    setEditingPersona(persona);
    setFormData({
      name: persona.name,
      description: persona.description,
      personalityTraits: persona.personalityTraits.join('、'),
      speakingStyle: persona.speakingStyle,
      replyTone: persona.replyTone,
      responseLength: persona.responseLength,
      customGuidelines: persona.customGuidelines,
    });
    setIsDialogOpen(true);
  }, []);

  const handleCloseDialog = useCallback(() => {
    setIsDialogOpen(false);
    setEditingPersona(null);
    setFormData(DEFAULT_FORM_DATA);
  }, []);

  const handleFormChange = useCallback(
    (field: keyof PersonaFormData, value: string) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const handleSavePersona = useCallback(() => {
    if (!formData.name.trim()) {
      window.alert('请填写角色名称');
      return;
    }

    const traits = formData.personalityTraits
      .split(/[,，、]/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const input: CreatePersonaInput = {
      name: formData.name.trim(),
      description: formData.description.trim(),
      personalityTraits: traits,
      speakingStyle: formData.speakingStyle,
      replyTone: formData.replyTone,
      responseLength: formData.responseLength,
      customGuidelines: formData.customGuidelines.trim(),
    };

    if (editingPersona) {
      personaService.updatePersona(editingPersona.id, input);
    } else {
      personaService.createPersona(input);
    }

    loadPersonas();
    handleCloseDialog();
  }, [formData, editingPersona, personaService, loadPersonas, handleCloseDialog]);

  const handleDeletePersona = useCallback(
    (id: string) => {
      if (id === DEFAULT_PERSONA_ID) {
        window.alert('默认角色不能删除');
        return;
      }
      if (window.confirm('确定要删除该角色吗？')) {
        personaService.deletePersona(id);
        loadPersonas();
      }
    },
    [personaService, loadPersonas]
  );

  const getStyleLabel = (style: PersonaSpeakingStyle) => {
    return SPEAKING_STYLE_OPTIONS.find((o) => o.value === style)?.label || style;
  };

  const getToneLabel = (tone: PersonaReplyTone) => {
    return REPLY_TONE_OPTIONS.find((o) => o.value === tone)?.label || tone;
  };

  return (
    <div className={`persona-config ${className || ''}`}>
      <div className="persona-config__header">
        <div className="persona-config__header-left">
          <h2 className="persona-config__title">角色配置</h2>
          <p className="persona-config__subtitle">
            设置主播的人设风格，影响 AI 弹幕回复的内容
          </p>
        </div>
        <button className="persona-config__btn persona-config__btn--primary" onClick={handleAddPersona}>
          + 添加角色
        </button>
      </div>

      <div className="persona-config__list">
        {personas.map((persona) => {
          const isActive = persona.id === activePersonaId;
          const isDefault = persona.id === DEFAULT_PERSONA_ID;

          return (
            <div
              key={persona.id}
              className={`persona-config__item ${isActive ? 'is-active' : ''}`}
            >
              <div className="persona-config__item-header">
                <div className="persona-config__item-info">
                  <span className="persona-config__item-name">
                    {persona.name}
                    {isDefault && <span className="persona-config__item-badge">默认</span>}
                    {isActive && <span className="persona-config__item-badge persona-config__item-badge--active">使用中</span>}
                  </span>
                  <span className="persona-config__item-desc">{persona.description}</span>
                </div>
                <div className="persona-config__item-toggle">
                  {!isDefault && !isActive && (
                    <button
                      className="persona-config__action-btn persona-config__action-btn--activate"
                      onClick={() => handleSetActive(persona.id)}
                    >
                      设为当前
                    </button>
                  )}
                  {isActive && (
                    <span className="persona-config__active-label">当前使用</span>
                  )}
                </div>
              </div>

              <div className="persona-config__item-details">
                <div className="persona-config__item-tags">
                  <span className="persona-config__item-tag">{getStyleLabel(persona.speakingStyle)}</span>
                  <span className="persona-config__item-tag">{getToneLabel(persona.replyTone)}</span>
                  <span className="persona-config__item-tag">
                    {persona.responseLength === 'short' ? '简短回复' : persona.responseLength === 'long' ? '详细回复' : '适中回复'}
                  </span>
                </div>
                {persona.personalityTraits.length > 0 && (
                  <div className="persona-config__item-traits">
                    {persona.personalityTraits.map((trait, i) => (
                      <span key={i} className="persona-config__trait">{trait}</span>
                    ))}
                  </div>
                )}
                {persona.customGuidelines && (
                  <div className="persona-config__item-guidelines">
                    {persona.customGuidelines.slice(0, 60)}{persona.customGuidelines.length > 60 ? '...' : ''}
                  </div>
                )}
              </div>

              <div className="persona-config__item-actions">
                <button
                  className="persona-config__action-btn persona-config__action-btn--edit"
                  onClick={() => handleEditPersona(persona)}
                >
                  编辑
                </button>
                {!isDefault && (
                  <button
                    className="persona-config__action-btn persona-config__action-btn--delete"
                    onClick={() => handleDeletePersona(persona.id)}
                  >
                    删除
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {personas.length === 0 && (
        <div className="persona-config__empty">
          <p>暂无角色配置</p>
          <p>点击"添加角色"按钮创建第一个主播人设</p>
        </div>
      )}

      {/* Dialog */}
      {isDialogOpen && (
        <div className="persona-config__dialog-overlay" onClick={handleCloseDialog}>
          <div className="persona-config__dialog" onClick={(e) => e.stopPropagation()}>
            <div className="persona-config__dialog-header">
              <h3>{editingPersona ? '编辑角色' : '添加角色'}</h3>
              <button className="persona-config__dialog-close" onClick={handleCloseDialog}>
                ×
              </button>
            </div>
            <div className="persona-config__dialog-body">
              <div className="persona-config__form-group">
                <label className="persona-config__label">
                  角色名称 <span className="persona-config__required">*</span>
                </label>
                <input
                  type="text"
                  className="persona-config__input"
                  value={formData.name}
                  onChange={(e) => handleFormChange('name', e.target.value)}
                  placeholder="例如：脱口秀主播"
                />
              </div>

              <div className="persona-config__form-group">
                <label className="persona-config__label">描述</label>
                <input
                  type="text"
                  className="persona-config__input"
                  value={formData.description}
                  onChange={(e) => handleFormChange('description', e.target.value)}
                  placeholder="例如：幽默风趣，擅长自嘲和调侃"
                />
              </div>

              <div className="persona-config__form-group">
                <label className="persona-config__label">性格特点</label>
                <input
                  type="text"
                  className="persona-config__input"
                  value={formData.personalityTraits}
                  onChange={(e) => handleFormChange('personalityTraits', e.target.value)}
                  placeholder="用逗号分隔，例如：幽默，自嘲，机智，亲和"
                />
                <p className="persona-config__hint">用逗号分隔多个特点</p>
              </div>

              <div className="persona-config__form-row">
                <div className="persona-config__form-group persona-config__form-group--half">
                  <label className="persona-config__label">说话风格</label>
                  <select
                    className="persona-config__select"
                    value={formData.speakingStyle}
                    onChange={(e) => handleFormChange('speakingStyle', e.target.value)}
                  >
                    {SPEAKING_STYLE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="persona-config__form-group persona-config__form-group--half">
                  <label className="persona-config__label">回复语气</label>
                  <select
                    className="persona-config__select"
                    value={formData.replyTone}
                    onChange={(e) => handleFormChange('replyTone', e.target.value)}
                  >
                    {REPLY_TONE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="persona-config__form-group">
                <label className="persona-config__label">回复长度</label>
                <div className="persona-config__radio-group">
                  {RESPONSE_LENGTH_OPTIONS.map((opt) => (
                    <label key={opt.value} className="persona-config__radio-label">
                      <input
                        type="radio"
                        name="responseLength"
                        value={opt.value}
                        checked={formData.responseLength === opt.value}
                        onChange={(e) => handleFormChange('responseLength', e.target.value)}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="persona-config__form-group">
                <label className="persona-config__label">自定义回复要求</label>
                <textarea
                  className="persona-config__textarea"
                  value={formData.customGuidelines}
                  onChange={(e) => handleFormChange('customGuidelines', e.target.value)}
                  placeholder="例如：回复要简短有力，适度自嘲，多用网络流行语，保持轻松氛围"
                  rows={3}
                />
                <p className="persona-config__hint">这些要求会作为额外提示词发送给 AI</p>
              </div>
            </div>
            <div className="persona-config__dialog-footer">
              <button className="persona-config__btn" onClick={handleCloseDialog}>
                取消
              </button>
              <button className="persona-config__btn persona-config__btn--primary" onClick={handleSavePersona}>
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PersonaConfiguration;