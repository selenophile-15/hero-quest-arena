import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SavedSimulationSummary } from '@/lib/savedSimulations';
import { getHeroes } from '@/lib/storage';
import { getJobImagePath, getChampionImagePath } from '@/lib/nameMap';
import { ELEMENT_ICON_MAP } from '@/types/game';
import { formatNumber } from '@/lib/format';
import type { Hero } from '@/types/game';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sim: SavedSimulationSummary | null;
}

// ELEMENT_ICON_MAP key map: 화염/냉기/지진/태풍/번개/맹독/생명/암흑 -> path string

function HeroDetailCard({ hero }: { hero: Hero }) {
  const isChampion = hero.type === 'champion';
  const iconPath = isChampion
    ? getChampionImagePath(hero.championName || hero.name)
    : hero.heroClass ? getJobImagePath(hero.heroClass) : '';
  const elementIcon = ELEMENT_ICON_MAP[hero.element];

  const equipSlots = hero.equipmentSlots || [];
  const slotCount = isChampion ? 2 : 6;
  const slots = Array.from({ length: slotCount }).map((_, i) => equipSlots[i] || null);

  return (
    <div className="card-fantasy p-3 border-2 rounded-xl flex flex-col gap-2 min-w-[200px] flex-1">
      {/* Header: icon + name + level */}
      <div className="flex items-center gap-2">
        <div className="w-12 h-12 rounded-full border border-primary/40 overflow-hidden bg-secondary/40 shrink-0 flex items-center justify-center">
          {iconPath && <img src={iconPath} alt="" className="w-full h-full object-cover" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-foreground truncate">{hero.name}</div>
          <div className="text-[11px] text-muted-foreground">
            {hero.heroClass || hero.championName} · Lv.{hero.level}
          </div>
        </div>
        {elementIcon && <img src={elementIcon} alt={hero.element} className="w-6 h-6 shrink-0" />}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px] font-mono">
        <div className="flex justify-between"><span className="text-muted-foreground">HP</span><span className="text-foreground">{formatNumber(hero.hp)}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">ATK</span><span className="text-foreground">{formatNumber(hero.atk)}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">DEF</span><span className="text-foreground">{formatNumber(hero.def)}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">전투력</span><span className="text-foreground">{formatNumber(hero.power)}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">치명</span><span className="text-foreground">{hero.crit?.toFixed(1)}%</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">치명대</span><span className="text-foreground">{hero.critDmg?.toFixed(0)}%</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">회피</span><span className="text-foreground">{hero.evasion?.toFixed(1)}%</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">위협</span><span className="text-foreground">{hero.threat}</span></div>
      </div>

      {/* Skills */}
      {!isChampion && hero.skills && hero.skills.length > 0 && (
        <div className="border-t border-border/30 pt-1.5">
          <div className="text-[10px] text-muted-foreground mb-1">스킬</div>
          <div className="flex flex-wrap gap-0.5">
            {hero.skills.map((sk, i) => (
              <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary/40 text-foreground/80">{sk}</span>
            ))}
          </div>
        </div>
      )}

      {/* Equipment */}
      <div className="border-t border-border/30 pt-1.5">
        <div className="text-[10px] text-muted-foreground mb-1">장비</div>
        <div className={`grid ${isChampion ? 'grid-cols-2' : 'grid-cols-3'} gap-1`}>
          {slots.map((slot, i) => (
            <div key={i} className="aspect-square rounded border border-border/40 bg-secondary/20 flex items-center justify-center overflow-hidden">
              {slot?.item?.imagePath ? (
                <img src={slot.item.imagePath} alt="" className="w-full h-full object-contain" onError={e => { e.currentTarget.style.display = 'none'; }} />
              ) : (
                <span className="text-[8px] text-muted-foreground/40">-</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function SavedSimDetailDialog({ open, onOpenChange, sim }: Props) {
  if (!sim) return null;
  const allHeroes = getHeroes();
  const heroes: Hero[] = sim.heroIds.map(id => {
    const existing = allHeroes.find(h => h.id === id);
    if (existing) return existing;
    return sim.heroSnapshots?.find(h => h.id === id) || null as any;
  }).filter(Boolean);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base font-bold">{sim.name} · 파티 상세</DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-1">
          <div className="flex gap-3 pb-2">
            {heroes.map(h => <HeroDetailCard key={h.id} hero={h} />)}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
