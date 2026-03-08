import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { STAT_ICON_MAP } from '@/types/game';
import { formatNumber } from '@/lib/format';
import { CalculatedStats } from '@/lib/statCalculator';

interface StatBreakdownDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  calcStats: CalculatedStats | null;
  equipmentSlots: Array<{ item: any | null; quality: string; element: any | null; spirit: any | null }>;
  selectedSkills: string[];
  uniqueSkillName: string;
  heroClass: string;
}

const QUALITY_MULTIPLIER: Record<string, number> = {
  common: 1, uncommon: 1.25, flawless: 1.5, epic: 2, legendary: 3,
};

const QUALITY_LABEL: Record<string, string> = {
  common: '일반', uncommon: '고급', flawless: '최고급', epic: '에픽', legendary: '전설',
};

type StatType = 'atk' | 'def' | 'hp';

const TAB_CONFIG: { key: StatType; label: string; icon: string; color: string; headerBg: string }[] = [
  { key: 'atk', label: '공격력', icon: STAT_ICON_MAP.atk, color: 'text-red-400', headerBg: 'bg-red-900/60' },
  { key: 'def', label: '방어력', icon: STAT_ICON_MAP.def, color: 'text-blue-400', headerBg: 'bg-blue-900/60' },
  { key: 'hp', label: '체력', icon: STAT_ICON_MAP.hp, color: 'text-orange-400', headerBg: 'bg-yellow-900/40' },
];

const EQUIP_STAT_KEY_MAP: Record<StatType, string> = {
  atk: '장비_공격력',
  def: '장비_방어력',
  hp: '장비_체력',
};

function getEquipBaseStatForType(item: any, statType: StatType): number {
  if (!item?.stats) return 0;
  const key = EQUIP_STAT_KEY_MAP[statType];
  const found = item.stats.find((s: any) => s.key === key);
  return found?.value || 0;
}

export default function StatBreakdownDrawer({
  open, onOpenChange, calcStats, equipmentSlots, selectedSkills, uniqueSkillName, heroClass,
}: StatBreakdownDrawerProps) {
  const [activeTab, setActiveTab] = useState<StatType>('atk');

  const renderBreakdownTable = (statType: StatType) => {
    const config = TAB_CONFIG.find(t => t.key === statType)!;
    const baseStat = calcStats
      ? statType === 'atk' ? calcStats.baseAtk : statType === 'def' ? calcStats.baseDef : calcStats.baseHp
      : 0;
    const seedStat = calcStats
      ? statType === 'atk' ? calcStats.seedAtk : statType === 'def' ? calcStats.seedDef : calcStats.seedHp
      : 0;

    return (
      <div className="grid grid-cols-[1fr_2fr] gap-4 h-full">
        {/* Left: Skill coefficients */}
        <div className="space-y-3 overflow-y-auto">
          <div className={`rounded-t ${config.headerBg} px-3 py-2`}>
            <h4 className="text-sm font-bold text-foreground">스킬</h4>
          </div>

          {/* Base stats */}
          <div className="px-3">
            <table className="w-full text-xs">
              <tbody>
                <tr className="border-b border-border/30">
                  <td className="py-1.5 text-foreground/70">기본 {config.label}</td>
                  <td className="py-1.5 text-right tabular-nums text-foreground font-medium">{formatNumber(baseStat)}</td>
                </tr>
                <tr className="border-b border-border/30">
                  <td className="py-1.5 text-foreground/70">씨앗 {config.label}</td>
                  <td className="py-1.5 text-right tabular-nums text-foreground font-medium">{formatNumber(seedStat)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Skill % bonuses */}
          <div className="px-3">
            <h5 className="text-xs font-semibold text-primary mb-1">직업 고유 보너스 스탯 : 깡/% 증가분</h5>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="py-1 text-left text-foreground/60">구분</th>
                  <th className="py-1 text-center text-foreground/60">X</th>
                  <th className="py-1 text-right text-foreground/60">O</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/20">
                  <td className="py-1 text-foreground/70">고유 스킬</td>
                  <td className="py-1 text-center text-foreground">X</td>
                  <td className="py-1 text-right tabular-nums text-muted-foreground">0</td>
                </tr>
                <tr className="border-b border-border/20">
                  <td className="py-1 text-foreground/70">공공 스킬</td>
                  <td className="py-1 text-center text-foreground">X</td>
                  <td className="py-1 text-right tabular-nums text-muted-foreground">0</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="px-3">
            <h5 className="text-xs font-semibold text-primary mb-1">모든 인캔트 스킬 계수</h5>
            <table className="w-full text-xs">
              <tbody>
                {['공용 스킬', '스킬1', '스킬2', '스킬3', '스킬4'].map((label, i) => (
                  <tr key={i} className="border-b border-border/20">
                    <td className="py-1 text-foreground/70">{label}</td>
                    <td className="py-1 text-right tabular-nums text-muted-foreground">0</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-3">
            <h5 className="text-xs font-semibold text-primary mb-1">장비별(특) 스킬 & 장비 물리지</h5>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="py-1 text-left text-foreground/60">구분</th>
                  <th className="py-1 text-center text-foreground/60">깡 스킬</th>
                  <th className="py-1 text-right text-foreground/60">스킬 계수</th>
                </tr>
              </thead>
              <tbody>
                {['스킬', '유물(관련)', '유물(전체)'].map((label, i) => (
                  <tr key={i} className="border-b border-border/20">
                    <td className="py-1 text-foreground/70">{label}</td>
                    <td className="py-1 text-center tabular-nums text-muted-foreground">0</td>
                    <td className="py-1 text-right tabular-nums text-muted-foreground">0</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-3">
            <h5 className="text-xs font-semibold text-primary mb-1">공통 전체(+소울&인캔트 계수</h5>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="py-1 text-left text-foreground/60">구분</th>
                  <th className="py-1 text-center text-foreground/60">깡 스킬</th>
                  <th className="py-1 text-right text-foreground/60">스킬 계수</th>
                </tr>
              </thead>
              <tbody>
                {['스킬', '소울1', '소울2', '소울3', '소울4'].map((label, i) => (
                  <tr key={i} className="border-b border-border/20">
                    <td className="py-1 text-foreground/70">{label}</td>
                    <td className="py-1 text-center tabular-nums text-muted-foreground">0</td>
                    <td className="py-1 text-right tabular-nums text-muted-foreground">0</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Equipment breakdown */}
        <div className="space-y-3 overflow-y-auto">
          <div className={`rounded-t ${config.headerBg} px-3 py-2`}>
            <h4 className="text-sm font-bold text-foreground">무기, 장비 {config.label}</h4>
          </div>

          {/* Equipment grid: 2 columns x 3 rows */}
          <div className="grid grid-cols-2 gap-3 px-3">
            {equipmentSlots.map((slot, i) => {
              const item = slot.item;
              const quality = slot.quality || 'common';
              const qualityMult = QUALITY_MULTIPLIER[quality] || 1;
              const baseStat = item ? getEquipBaseStatForType(item, statType) : 0;
              const qualityStat = Math.floor(baseStat * qualityMult);

              return (
                <div key={i} className="border border-border/40 rounded overflow-hidden">
                  <div className="bg-secondary/40 px-2 py-1 flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">장비 {i + 1}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {item ? `${item.name}` : '비어있음'}
                    </span>
                  </div>
                  <table className="w-full text-xs">
                    <tbody>
                      <tr className="border-b border-border/20">
                        <td className="px-2 py-1 text-foreground/70">유형</td>
                        <td className="px-2 py-1 text-right text-foreground">{item?.type || '-'}</td>
                      </tr>
                      <tr className="border-b border-border/20">
                        <td className="px-2 py-1 text-foreground/70">등급</td>
                        <td className="px-2 py-1 text-right text-foreground">{QUALITY_LABEL[quality] || quality}</td>
                      </tr>
                      <tr className="border-b border-border/20">
                        <td className="px-2 py-1 text-foreground/70">기본 {config.label}</td>
                        <td className="px-2 py-1 text-right tabular-nums text-foreground">{formatNumber(baseStat)}</td>
                      </tr>
                      <tr className="border-b border-border/20">
                        <td className="px-2 py-1 text-foreground/70">등급 적용 {config.label}</td>
                        <td className="px-2 py-1 text-right tabular-nums font-medium text-foreground">{formatNumber(qualityStat)}</td>
                      </tr>
                      <tr className="border-b border-border/20">
                        <td className="px-2 py-1 text-foreground/70">원소 마부 {config.label}</td>
                        <td className="px-2 py-1 text-right tabular-nums text-muted-foreground">0</td>
                      </tr>
                      <tr className="border-b border-border/20">
                        <td className="px-2 py-1 text-foreground/70">영혼 마부 {config.label}</td>
                        <td className="px-2 py-1 text-right tabular-nums text-muted-foreground">0</td>
                      </tr>
                      <tr className="border-b border-border/20">
                        <td className="px-2 py-1 text-foreground/70">해당 인캔트 스킬 가치</td>
                        <td className="px-2 py-1 text-right tabular-nums text-muted-foreground">0</td>
                      </tr>
                      <tr className="border-b border-border/20">
                        <td className="px-2 py-1 text-foreground/70">해당 장비 스킬 보너스 %</td>
                        <td className="px-2 py-1 text-right tabular-nums text-muted-foreground">0</td>
                      </tr>
                      <tr>
                        <td className="px-2 py-1 text-foreground/70">스펠나이트 보조 계수</td>
                        <td className="px-2 py-1 text-right tabular-nums text-muted-foreground">1</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>

          {/* Final calculation summary */}
          <div className={`mx-3 rounded ${config.headerBg} overflow-hidden`}>
            <div className="px-3 py-2">
              <h5 className="text-xs font-bold text-foreground mb-2">최종 계산식</h5>
              <table className="w-full text-xs">
                <tbody>
                  <tr className="border-b border-border/30">
                    <td className="py-1.5 text-foreground/80">기본 스탯</td>
                    <td className="py-1.5 text-right tabular-nums text-foreground">{formatNumber(baseStat)}</td>
                  </tr>
                  <tr className="border-b border-border/30">
                    <td className="py-1.5 text-foreground/80">씨앗 습격치</td>
                    <td className="py-1.5 text-right tabular-nums text-foreground">{formatNumber(seedStat)}</td>
                  </tr>
                  {[1, 2, 3, 4, 5, 6].map(n => (
                    <tr key={n} className="border-b border-border/20">
                      <td className="py-1 text-foreground/70">장비 {n}</td>
                      <td className="py-1 text-right tabular-nums text-muted-foreground">0</td>
                    </tr>
                  ))}
                  <tr className="border-b border-border/30">
                    <td className="py-1.5 text-foreground/80">깡 보너스 스탯 & 장비 물자치</td>
                    <td className="py-1.5 text-right tabular-nums text-muted-foreground">0</td>
                  </tr>
                  <tr className="border-b border-border/30">
                    <td className="py-1.5 text-foreground/80">1 + 공통 장비(+소울&인캔트 물자치)</td>
                    <td className="py-1.5 text-right tabular-nums text-foreground">1</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className={`px-3 py-3 border-t border-border/40 flex items-center justify-between`}>
              <span className="text-sm font-bold text-foreground">최종 {config.label}</span>
              <span className={`text-xl font-bold tabular-nums ${config.color}`}>
                {calcStats ? formatNumber(
                  statType === 'atk' ? calcStats.totalAtk : statType === 'def' ? calcStats.totalDef : calcStats.totalHp
                ) : '0'}
              </span>
            </div>
          </div>

          {/* Formula */}
          <div className="px-3 pb-3">
            <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
              ※ {config.label} = (기본 {config.label} + 씨앗 {config.label} + [깡 보너스] + 장비 {config.label} 합 + 공통 장비(+소울&인캔트 물자치) × 1 + 해당 아이템 스킬 계수 + 공통 장비 보너스 스킬 계수)
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right-wide" className="p-0 flex flex-col overflow-hidden">
        <SheetHeader className="px-4 pt-4 pb-2 border-b border-border flex-shrink-0">
          <SheetTitle className="text-lg font-display text-primary">
            공격력, 방어력, 체력 상세 수치 및 계산 방식
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            각 스탯의 구성 요소와 계산 과정을 확인할 수 있습니다
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-hidden p-4">
          <Tabs value={activeTab} onValueChange={v => setActiveTab(v as StatType)} className="h-full flex flex-col">
            <TabsList className="w-full grid grid-cols-3 mb-3 flex-shrink-0">
              {TAB_CONFIG.map(tab => (
                <TabsTrigger key={tab.key} value={tab.key} className="flex items-center gap-1.5 text-sm">
                  <img src={tab.icon} alt="" className="w-4 h-4" />
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {TAB_CONFIG.map(tab => (
              <TabsContent key={tab.key} value={tab.key} className="flex-1 overflow-y-auto mt-0">
                {renderBreakdownTable(tab.key)}
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
