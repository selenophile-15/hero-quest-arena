import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMobileGestures } from '@/hooks/use-mobile-gestures';
import { useDesktopModeState } from '@/hooks/use-desktop-mode';
import HeroList from '@/components/HeroList';
import QuestSimulation from '@/components/QuestSimulation';
import Ranking from '@/components/Ranking';
import { List, Swords, Trophy, Sun, Moon, Monitor } from 'lucide-react';
import { useTheme, ThemeMode } from '@/hooks/use-theme';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const TABS = [
  { id: 'list', label: '리스트 관리', icon: List },
  { id: 'quest', label: '퀘스트 시뮬레이션', icon: Swords },
  { id: 'ranking', label: '랭킹', icon: Trophy },
] as const;

type TabId = typeof TABS[number]['id'];

const THEMES: { id: ThemeMode; label: string; desc: string; color: string }[] = [
  { id: 'wine', label: '로제', desc: '깊은 와인빛 레드', color: 'hsl(348 65% 58%)' },
  { id: 'orange', label: '오렌지', desc: '활기찬 오렌지빛', color: 'hsl(24 85% 55%)' },
  { id: 'gold', label: '옐로우', desc: '따뜻한 황금빛', color: 'hsl(40 85% 55%)' },
  { id: 'olive', label: '올리브그린', desc: '자연의 올리브빛', color: 'hsl(82 55% 48%)' },
  { id: 'cyan', label: '소라', desc: '시원한 시안+틸 빛', color: 'hsl(185 65% 50%)' },
  { id: 'blue', label: '블루', desc: '코발트 블루', color: 'hsl(220 70% 55%)' },
  { id: 'moonlight', label: '라벤더', desc: '은은한 연보랏빛', color: 'hsl(245 35% 72%)' },
  { id: 'purple', label: '퍼플', desc: '우아한 보랏빛', color: 'hsl(280 55% 62%)' },
  { id: 'caramel', label: '카라멜', desc: '버버리풍 황갈색', color: 'hsl(32 55% 52%)' },
];


export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<TabId>('list');
  const { theme, setTheme, colorMode, setColorMode } = useTheme();
  const { desktopMode, setDesktopMode } = useDesktopModeState();

  const navigate = useNavigate();

  // Handle gestures (pinch-zoom, double-tap) and CSS zoom for desktop mode
  useMobileGestures(desktopMode);

  return (
    <div className="min-h-screen bg-fantasy-gradient">
      {/* Top Bar */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="w-full px-6 h-14 flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="font-display text-lg text-primary tracking-wide transition-all duration-300 hover:text-primary/80 hover:scale-105 active:scale-95 logo-flicker"
          >
            QUEST SIMULATOR
          </button>

          <div className="flex items-center gap-2">
            {/* Desktop Mode Toggle */}
            <button
              onClick={() => setDesktopMode(v => !v)}
              title={desktopMode ? '모바일 모드로 전환' : '데스크탑 모드로 전환'}
              className={`flex items-center justify-center w-8 h-8 rounded-md border border-border transition-colors ${
                desktopMode ? 'bg-primary text-primary-foreground' : 'bg-secondary/50 text-muted-foreground hover:text-foreground'
              }`}
            >
              <Monitor className="w-4 h-4" />
            </button>

            {/* Light/Dark Toggle */}
            <button
              onClick={() => setColorMode(colorMode === 'dark' ? 'light' : 'dark')}
              className="flex items-center gap-0 rounded-full border border-border bg-secondary/50 p-0.5 transition-colors"
            >
              <span className={`flex items-center justify-center w-7 h-7 rounded-full transition-all duration-300 ${
                colorMode === 'light' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
              }`}>
                <Sun className="w-3.5 h-3.5" />
              </span>
              <span className={`flex items-center justify-center w-7 h-7 rounded-full transition-all duration-300 ${
                colorMode === 'dark' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
              }`}>
                <Moon className="w-3.5 h-3.5" />
              </span>
            </button>

            {/* Theme Color Picker */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                  <span
                    className="w-5 h-3.5 rounded-sm border border-border/50"
                    style={{ backgroundColor: THEMES.find(t => t.id === theme)?.color }}
                  />
                  <span className="hidden sm:inline">{THEMES.find(t => t.id === theme)?.label}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {THEMES.map(t => (
                  <DropdownMenuItem
                    key={t.id}
                    onClick={() => setTheme(t.id)}
                    className={`flex items-center gap-2.5 cursor-pointer ${theme === t.id ? 'bg-primary/10 text-primary' : ''}`}
                  >
                    <span
                      className="w-5 h-3.5 rounded-sm border border-border/50 shrink-0"
                      style={{ backgroundColor: t.color }}
                    />
                    <div className="flex flex-col">
                      <span className="font-medium">{t.label}</span>
                      <span className="text-xs text-muted-foreground">{t.desc}</span>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
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
                className={`group relative flex items-center gap-2 px-5 py-3 text-sm font-medium -mb-[1px]
                  transition-all duration-300 ease-out
                  ${isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                  }`}
              >
                <Icon className={`w-4 h-4 transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-105 group-hover:-translate-y-[1px]'}`} />
                <span className={`transition-transform duration-300 ${isActive ? '' : 'group-hover:-translate-y-[1px]'}`}>
                  {tab.label}
                </span>
                <span className={`absolute bottom-0 left-0 h-[2px] bg-primary transition-all duration-300 ease-out ${
                  isActive ? 'w-full' : 'w-0 group-hover:w-full opacity-30'
                }`} />
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <main className="w-full px-6 py-6 animate-fade-in">
        <div style={{ display: activeTab === 'list' ? 'block' : 'none' }}>
          <HeroList />
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