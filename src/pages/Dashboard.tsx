import { useState } from 'react';
import HeroList from '@/components/HeroList';
import QuestSimulation from '@/components/QuestSimulation';
import Ranking from '@/components/Ranking';
import { Sword, Swords, Trophy, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const TABS = [
  { id: 'list', label: '리스트 관리', icon: Sword },
  { id: 'quest', label: '퀘스트 시뮬레이션', icon: Swords },
  { id: 'ranking', label: '랭킹', icon: Trophy },
] as const;

type TabId = typeof TABS[number]['id'];

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<TabId>('list');
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-fantasy-gradient">
      {/* Top Bar */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <h1 className="font-display text-lg text-primary tracking-wide">Quest Simulator</h1>
          <button
            onClick={() => navigate('/')}
            className="text-muted-foreground hover:text-foreground transition-colors text-sm flex items-center gap-1.5"
          >
            <LogOut className="w-4 h-4" />
            나가기
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-border bg-card/40">
        <div className="max-w-6xl mx-auto px-4 flex gap-1">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-[1px] ${
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {activeTab === 'list' && <HeroList />}
        {activeTab === 'quest' && <QuestSimulation />}
        {activeTab === 'ranking' && <Ranking />}
      </main>
    </div>
  );
}
