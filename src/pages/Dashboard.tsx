import { useState } from 'react';
import HeroList from '@/components/HeroList';
import QuestSimulation from '@/components/QuestSimulation';
import Ranking from '@/components/Ranking';
import { Sword, Swords, Trophy } from 'lucide-react';

const TABS = [
  { id: 'list', label: '리스트 관리', icon: Sword },
  { id: 'quest', label: '퀘스트 시뮬레이션', icon: Swords },
  { id: 'ranking', label: '랭킹', icon: Trophy },
] as const;

type TabId = typeof TABS[number]['id'];

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<TabId>('list');
  const [listResetKey, setListResetKey] = useState(0);

  const handleLogoClick = () => {
    setActiveTab('list');
    setListResetKey(k => k + 1);
  };

  return (
    <div className="min-h-screen bg-fantasy-gradient">
      {/* Top Bar */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="w-full px-6 h-14 flex items-center">
          <button
            onClick={handleLogoClick}
            className="font-display text-lg text-primary tracking-wide transition-all duration-300 hover:text-primary/80 hover:scale-105 active:scale-95"
          >
            셀레노필
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-border bg-card/40">
        <div className="w-full px-6 flex gap-1">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-[1px]
                  transition-all duration-300 ease-out
                  hover:translate-y-[-1px]
                  ${isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-primary/30'
                  }`}
              >
                <Icon className={`w-4 h-4 transition-transform duration-300 ${isActive ? 'scale-110' : ''}`} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <main className="w-full px-6 py-6 animate-fade-in">
        <div style={{ display: activeTab === 'list' ? 'block' : 'none' }}>
          <HeroList key={listResetKey} />
        </div>
        <div style={{ display: activeTab === 'quest' ? 'block' : 'none' }}>
          <QuestSimulation />
        </div>
        <div style={{ display: activeTab === 'ranking' ? 'block' : 'none' }}>
          <Ranking />
        </div>
      </main>
    </div>
  );
}
