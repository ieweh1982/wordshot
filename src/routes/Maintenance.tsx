import { useState } from 'react';
import ScriptManagement from '../components/maintenance/ScriptManagement';
import TemplateEditor from '../components/maintenance/TemplateEditor';
import DanmuCaptureConfig from '../components/maintenance/DanmuCaptureConfig';
import ImportExport from '../components/maintenance/ImportExport';
import Settings from '../components/maintenance/Settings';
import AIConfiguration from '../components/maintenance/AIConfiguration';
import SlotConfiguration from '../components/maintenance/SlotConfiguration';
import ThemeConfiguration from '../components/maintenance/ThemeConfiguration';
import './Maintenance.css';

type MaintenanceTab = 'scripts' | 'templates' | 'danmu' | 'display' | 'ai' | 'import' | 'theme' | 'settings';

export default function Maintenance() {
  const [activeTab, setActiveTab] = useState<MaintenanceTab>('scripts');

  const tabs: { id: MaintenanceTab; label: string }[] = [
    { id: 'scripts', label: '话术管理' },
    { id: 'templates', label: '模板编辑' },
    { id: 'danmu', label: '弹幕抓取' },
    { id: 'display', label: '槽位配置' },
    { id: 'ai', label: 'AI配置' },
    { id: 'import', label: '导入导出' },
    { id: 'theme', label: '主题配置' },
    { id: 'settings', label: '系统设置' },
  ];

  return (
    <div className="maintenance">
      <header className="maintenance__header">
        <div className="maintenance__title">
          <h1>维护后台</h1>
        </div>
        <div className="maintenance__tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`maintenance__tab ${activeTab === tab.id ? 'maintenance__tab--active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
          <button
            className="maintenance__tab maintenance__tab--link"
            onClick={() => window.location.hash = '#/'}
          >
            返回直播
          </button>
        </div>
      </header>

      <main className="maintenance__content">
        {activeTab === 'scripts' && <ScriptManagement />}
        {activeTab === 'templates' && <TemplateEditor />}
        {activeTab === 'danmu' && <DanmuCaptureConfig />}
        {activeTab === 'display' && <SlotConfiguration />}
        {activeTab === 'ai' && <AIConfiguration />}
        {activeTab === 'import' && <ImportExport />}
        {activeTab === 'theme' && <ThemeConfiguration />}
        {activeTab === 'settings' && <Settings />}
      </main>
    </div>
  );
}