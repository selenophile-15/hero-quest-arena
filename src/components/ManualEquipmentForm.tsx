import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { EQUIP_TYPE_MAP, EquipmentItem } from '@/lib/equipmentUtils';
import { Plus, Trash2 } from 'lucide-react';

const WEAPON_TYPES = Object.entries(EQUIP_TYPE_MAP)
  .filter(([, v]) => v.category === 'weapon' && v.file !== 'dual_wield')
  .map(([k]) => k);

const ALL_TYPES = Object.entries(EQUIP_TYPE_MAP)
  .filter(([, v]) => v.file !== 'dual_wield')
  .map(([k]) => k);

function getAllowedTypesForSlot(allowedTypes?: string[]) {
  if (!allowedTypes || allowedTypes.length === 0) return ALL_TYPES;
  const hasWeapon = allowedTypes.some(t => EQUIP_TYPE_MAP[t]?.category === 'weapon');
  const base = allowedTypes.filter(t => t !== '쌍수');
  return hasWeapon ? [...base, '쌍수'] : base;
}

const ELEMENT_OPTIONS = ['불', '물', '공기', '대지', '빛', '어둠', '골드', '모든 원소'];
const UNIQUE_ELEMENT_OPTIONS = ['불', '물', '공기', '대지', '빛', '어둠'];

const SPIRIT_OPTIONS = [
  '바하무트', '레비아탄', '그리핀', '명인', '조상', '베히모스', '우로보로스',
  '기린', '크람푸스', '크리스마스', '크라켄', '키메라', '카벙클', '타라스크', '하이드라', '불사조',
  '케찰코아틀',
  '호랑이', '매머드', '공룡', '사자', '곰', '바다코끼리', '상어',
  '다람쥐', '하마', '말', '도마뱀', '아르마딜로', '부엉이', '코뿔소',
  '졸로틀',
  '독수리', '황소', '양', '늑대', '고양이', '거위', '독사', '토끼',
];

const UNIQUE_ELEMENT_TIERS = [4, 7, 9, 12, 14];

const RELIC_STAT_OPTIONS = [
  { value: '깡공격력', label: '공격력' },
  { value: '공격력%', label: '공격력%' },
  { value: '해당장비공격력%', label: '해당 장비 공격력%' },
  { value: '깡방어력', label: '방어력' },
  { value: '방어력%', label: '방어력%' },
  { value: '해당장비방어력%', label: '해당 장비 방어력%' },
  { value: '깡체력', label: '체력' },
  { value: '체력%', label: '체력%' },
  { value: '해당장비전체%', label: '해당 장비 전체%' },
  { value: '모든장비보너스%', label: '모든 장비 보너스%' },
  { value: '치명타확률%', label: '치명타 확률%' },
  { value: '치명타데미지%', label: '치명타 데미지%' },
  { value: '치명타생존%', label: '치명타 생존%' },
  { value: '회피%', label: '회피%' },
  { value: '위협도', label: '위협도' },
];

const RELIC_OP_OPTIONS = [
  { value: '증가', label: '증가' },
  { value: '감소', label: '감소' },
  { value: '고정', label: '고정' },
];

export interface RelicStatBonus {
  stat: string;
  op: string;
  value: number;
}

export interface ManualEquipmentData {
  name: string;
  type: string;
  dualWieldTypes: string[];
  atk: number;
  def: number;
  hp: number;
  crit: number;
  evasion: number;
  elementMode: 'none' | 'affinity' | 'unique';
  affinityElement: string;
  uniqueElement: string;
  uniqueElementTier: number;
  spiritMode: 'none' | 'affinity' | 'unique';
  affinitySpirit: string;
  uniqueSpirit: string;
  isRelic: boolean;
  relicBonuses: RelicStatBonus[];
}

interface ManualEquipmentFormProps {
  initialData?: ManualEquipmentData | null;
  allowedTypes?: string[];
  onConfirm: (item: EquipmentItem, manualData: ManualEquipmentData) => void;
  onCancel: () => void;
}

function emptyData(): ManualEquipmentData {
  return {
    name: '',
    type: '',
    dualWieldTypes: [],
    atk: 0,
    def: 0,
    hp: 0,
    crit: 0,
    evasion: 0,
    elementMode: 'none',
    affinityElement: '',
    uniqueElement: '',
    uniqueElementTier: 1,
    spiritMode: 'none',
    affinitySpirit: '',
    uniqueSpirit: '',
    isRelic: false,
    relicBonuses: [],
  };
}

// Migration helper for old data format
function migrateData(d: any): ManualEquipmentData {
  if (d.elementMode !== undefined) return d as ManualEquipmentData;
  return {
    ...emptyData(),
    ...d,
    elementMode: d.affinityElement ? 'affinity' : 'none',
    affinityElement: d.affinityElement || '',
    uniqueElement: '',
    uniqueElementTier: 1,
    spiritMode: d.affinitySpirit ? 'affinity' : 'none',
    affinitySpirit: d.affinitySpirit || '',
    uniqueSpirit: '',
  };
}

export default function ManualEquipmentForm({ initialData, allowedTypes, onConfirm, onCancel }: ManualEquipmentFormProps) {
  const [data, setData] = useState<ManualEquipmentData>(initialData ? migrateData(initialData) : emptyData());
  const [rawStats, setRawStats] = useState<Record<string, string>>({});
  const [rawRelicValues, setRawRelicValues] = useState<Record<number, string>>({});
  const typeOptions = getAllowedTypesForSlot(allowedTypes);

  useEffect(() => {
    if (initialData) {
      setData(migrateData(initialData));
      setRawStats({});
      setRawRelicValues({});
    }
  }, [initialData]);

  const update = <K extends keyof ManualEquipmentData>(key: K, val: ManualEquipmentData[K]) => {
    setData(prev => ({ ...prev, [key]: val }));
  };

  const isDualWield = data.type === '쌍수';

  const toggleDualType = (t: string) => {
    const cur = data.dualWieldTypes;
    if (cur.includes(t)) {
      update('dualWieldTypes', cur.filter(x => x !== t));
    } else if (cur.length < 2) {
      update('dualWieldTypes', [...cur, t]);
    }
  };

  const addRelicBonus = () => {
    if (data.relicBonuses.length >= 3) return;
    update('relicBonuses', [...data.relicBonuses, { stat: '깡공격력', op: '증가', value: 0 }]);
  };

  const removeRelicBonus = (i: number) => {
    update('relicBonuses', data.relicBonuses.filter((_, idx) => idx !== i));
  };

  const updateBonus = (i: number, field: keyof RelicStatBonus, val: string | number) => {
    const updated = [...data.relicBonuses];
    updated[i] = { ...updated[i], [field]: val };
    update('relicBonuses', updated);
  };

  const handleConfirm = () => {
    if (!data.name.trim() || !data.type) return;

    const typeInfo = EQUIP_TYPE_MAP[data.type];
    const fileType = typeInfo?.file || 'unknown';
    const category = typeInfo?.category || 'unknown';

    const stats: { key: string; value: number }[] = [];
    if (data.atk) stats.push({ key: '장비_공격력', value: data.atk });
    if (data.def) stats.push({ key: '장비_방어력', value: data.def });
    if (data.hp) stats.push({ key: '장비_체력', value: data.hp });
    if (data.crit) stats.push({ key: '장비_치명타확률%', value: data.crit });
    if (data.evasion) stats.push({ key: '장비_회피%', value: data.evasion });

    let relicEffect: string | null = null;
    if (data.isRelic && data.relicBonuses.length > 0) {
      relicEffect = data.relicBonuses.map(b => {
        const label = RELIC_STAT_OPTIONS.find(o => o.value === b.stat)?.label || b.stat;
        if (b.op === '고정') return `${label} ${b.value}으로 고정`;
        return `${label} ${b.op === '증가' ? '+' : '-'}${b.value}`;
      }).join('\n');
    }

    const elementAffinity = data.elementMode === 'affinity' && data.affinityElement ? [data.affinityElement] : null;
    const uniqueElement = data.elementMode === 'unique' && data.uniqueElement ? [data.uniqueElement] : null;
    const uniqueElementTier = data.elementMode === 'unique' && data.uniqueElement ? data.uniqueElementTier : null;
    const spiritAffinity = data.spiritMode === 'affinity' && data.affinitySpirit ? [data.affinitySpirit] : null;
    const uniqueSpirit = data.spiritMode === 'unique' && data.uniqueSpirit ? [data.uniqueSpirit] : null;

    const item: EquipmentItem = {
      name: data.name.trim(),
      engName: '',
      type: isDualWield ? 'dual_wield' : fileType,
      typeKor: data.type,
      category,
      tier: 0,
      imagePath: '',
      stats,
      quality: 'common',
      relic: data.isRelic,
      relicEffect,
      airshipPower: 0,
      elementAffinity,
      spiritAffinity,
      uniqueElement,
      uniqueElementTier,
      uniqueSpirit,
      judgmentTypes: isDualWield ? data.dualWieldTypes : null,
      manual: true,
      manualData: data,
      relicStatBonuses: data.isRelic ? data.relicBonuses : undefined,
    };

    onConfirm(item, data);
  };

  return (
    <div className="space-y-3 p-3">
      <h3 className="text-sm font-bold text-foreground">수동 입력</h3>

      <div className="grid grid-cols-2 gap-4">
        {/* ===== LEFT COLUMN: Name, Type, Stats ===== */}
        <div className="space-y-3">
          {/* Name */}
          <div className="grid grid-cols-[56px_1fr] gap-2 items-center text-xs">
            <span className="text-foreground">이름</span>
            <Input className="h-7 text-xs" value={data.name} onChange={e => update('name', e.target.value)} placeholder="장비 이름" />
          </div>

          {/* Type */}
          <div className="grid grid-cols-[56px_1fr] gap-2 items-center text-xs">
            <span className="text-foreground">타입</span>
            <Select value={data.type} onValueChange={v => { update('type', v); if (v !== '쌍수') update('dualWieldTypes', []); }}>
              <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="선택" /></SelectTrigger>
              <SelectContent className="max-h-[240px]">
                {typeOptions.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Dual wield sub-types */}
          {isDualWield && (
            <div className="text-xs">
              <span className="text-foreground text-[10px]">쌍수 타입</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {WEAPON_TYPES.map(t => (
                  <button
                    key={t}
                    onClick={() => toggleDualType(t)}
                    className={`px-2 py-0.5 rounded text-[10px] border transition-all ${
                      data.dualWieldTypes.includes(t)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-secondary/30 text-muted-foreground border-border/50 hover:border-primary/50'
                    }`}
                  >
                    {t}
                  </button>
                ))}
                <span className="text-[10px] text-muted-foreground ml-1">({data.dualWieldTypes.length}/2)</span>
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="text-[10px] text-foreground">일반 등급 기준 스탯</div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            {/* Left: atk, def, hp */}
            <div className="flex flex-col gap-1.5">
              {[
                { key: 'atk' as const, label: '공격력' },
                { key: 'def' as const, label: '방어력' },
                { key: 'hp' as const, label: '체력' },
              ].map(s => (
                <div key={s.key} className="grid grid-cols-[56px_1fr] gap-1 items-center">
                  <span className="text-foreground text-[10px]">{s.label}</span>
                  <Input
                    type="number"
                    className="h-7 text-xs text-center"
                    value={rawStats[s.key] ?? (data[s.key] === 0 ? '' : String(data[s.key]))}
                    onChange={e => {
                      const v = e.target.value;
                      setRawStats(prev => ({ ...prev, [s.key]: v }));
                      update(s.key, v === '' ? 0 : (parseFloat(v) || 0));
                    }}
                  />
                </div>
              ))}
            </div>
            {/* Right: crit, evasion */}
            <div className="flex flex-col gap-1.5">
              {[
                { key: 'crit' as const, label: '치명타 확률' },
                { key: 'evasion' as const, label: '회피' },
              ].map(s => (
                <div key={s.key} className="grid grid-cols-[56px_1fr] gap-1 items-center">
                  <span className="text-foreground text-[10px]">{s.label}</span>
                  <div className="relative">
                    <Input
                      type="number"
                      className="h-7 text-xs text-center pr-4"
                      value={rawStats[s.key] ?? (data[s.key] === 0 ? '' : String(data[s.key]))}
                      onChange={e => {
                        const v = e.target.value;
                        setRawStats(prev => ({ ...prev, [s.key]: v }));
                        update(s.key, v === '' ? 0 : (parseFloat(v) || 0));
                      }}
                    />
                    <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ===== RIGHT COLUMN: Element, Spirit, Relic ===== */}
        <div className="space-y-3">
          {/* Element */}
          <div className="space-y-1.5">
            <span className="text-foreground text-[10px] font-semibold">원소</span>
            <RadioGroup
              value={data.elementMode}
              onValueChange={v => {
                const mode = v as 'none' | 'affinity' | 'unique';
                update('elementMode', mode);
                if (mode !== 'affinity') update('affinityElement', '');
                if (mode !== 'unique') { update('uniqueElement', ''); update('uniqueElementTier', 1); }
              }}
              className="flex gap-3 text-[10px]"
            >
              <div className="flex items-center gap-1">
                <RadioGroupItem value="none" id="elem-none" className="h-3 w-3" />
                <label htmlFor="elem-none" className="text-foreground cursor-pointer">없음</label>
              </div>
              <div className="flex items-center gap-1">
                <RadioGroupItem value="affinity" id="elem-affinity" className="h-3 w-3" />
                <label htmlFor="elem-affinity" className="text-foreground cursor-pointer">친밀</label>
              </div>
              <div className="flex items-center gap-1">
                <RadioGroupItem value="unique" id="elem-unique" className="h-3 w-3" />
                <label htmlFor="elem-unique" className="text-foreground cursor-pointer">고유</label>
              </div>
            </RadioGroup>

            {data.elementMode === 'affinity' && (
              <Select value={data.affinityElement || '_none'} onValueChange={v => update('affinityElement', v === '_none' ? '' : v)}>
                <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="원소 선택" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">선택 안 함</SelectItem>
                  {ELEMENT_OPTIONS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
            )}

            {data.elementMode === 'unique' && (
              <div className="space-y-1.5">
                <Select value={data.uniqueElement || '_none'} onValueChange={v => update('uniqueElement', v === '_none' ? '' : v)}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="고유 원소 선택" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">선택 안 함</SelectItem>
                    {UNIQUE_ELEMENT_OPTIONS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2">
                  <span className="text-foreground text-[10px]">티어</span>
                  <Select value={String(data.uniqueElementTier)} onValueChange={v => update('uniqueElementTier', Number(v))}>
                    <SelectTrigger className="h-7 text-xs w-16"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {UNIQUE_ELEMENT_TIERS.map(t => <SelectItem key={t} value={String(t)}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          {/* Spirit */}
          <div className="space-y-1.5">
            <span className="text-foreground text-[10px] font-semibold">영혼</span>
            <RadioGroup
              value={data.spiritMode}
              onValueChange={v => {
                const mode = v as 'none' | 'affinity' | 'unique';
                update('spiritMode', mode);
                if (mode !== 'affinity') update('affinitySpirit', '');
                if (mode !== 'unique') update('uniqueSpirit', '');
              }}
              className="flex gap-3 text-[10px]"
            >
              <div className="flex items-center gap-1">
                <RadioGroupItem value="none" id="spirit-none" className="h-3 w-3" />
                <label htmlFor="spirit-none" className="text-foreground cursor-pointer">없음</label>
              </div>
              <div className="flex items-center gap-1">
                <RadioGroupItem value="affinity" id="spirit-affinity" className="h-3 w-3" />
                <label htmlFor="spirit-affinity" className="text-foreground cursor-pointer">친밀</label>
              </div>
              <div className="flex items-center gap-1">
                <RadioGroupItem value="unique" id="spirit-unique" className="h-3 w-3" />
                <label htmlFor="spirit-unique" className="text-foreground cursor-pointer">고유 (문드라)</label>
              </div>
            </RadioGroup>

            {data.spiritMode === 'affinity' && (
              <Select value={data.affinitySpirit || '_none'} onValueChange={v => update('affinitySpirit', v === '_none' ? '' : v)}>
                <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="영혼 선택" /></SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  <SelectItem value="_none">선택 안 함</SelectItem>
                  {SPIRIT_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            )}

            {data.spiritMode === 'unique' && (
              <Select value={data.uniqueSpirit || '_none'} onValueChange={v => update('uniqueSpirit', v === '_none' ? '' : v)}>
                <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="고유 영혼 선택" /></SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  <SelectItem value="_none">선택 안 함</SelectItem>
                  {SPIRIT_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Relic */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs">
              <Checkbox
                checked={data.isRelic}
                onCheckedChange={v => update('isRelic', !!v)}
                id="manual-relic"
              />
              <label htmlFor="manual-relic" className="text-foreground cursor-pointer">유물</label>
            </div>

            {data.isRelic && (
              <div className="space-y-2 pl-2 border-l-2 border-yellow-400/30">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-yellow-400 font-semibold">유물 효과 (최대 3개)</span>
                  {data.relicBonuses.length < 3 && (
                    <Button variant="ghost" size="sm" className="h-5 text-[10px] px-1.5" onClick={addRelicBonus}>
                      <Plus className="w-3 h-3 mr-0.5" />추가
                    </Button>
                  )}
                </div>
                {data.relicBonuses.map((b, i) => (
                  <div key={i} className="flex items-center gap-1.5 flex-wrap">
                    <Select value={b.stat} onValueChange={v => updateBonus(i, 'stat', v)}>
                      <SelectTrigger className="h-7 text-[10px] w-[120px]"><SelectValue /></SelectTrigger>
                      <SelectContent className="max-h-[200px]">
                        {RELIC_STAT_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={b.op} onValueChange={v => updateBonus(i, 'op', v)}>
                      <SelectTrigger className="h-7 text-[10px] w-14"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {RELIC_OP_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      className="h-7 text-[10px] w-16 text-center"
                      value={rawRelicValues[i] ?? (b.value === 0 ? '' : String(b.value))}
                      onChange={e => {
                        const v = e.target.value;
                        setRawRelicValues(prev => ({ ...prev, [i]: v }));
                        updateBonus(i, 'value', v === '' ? 0 : (parseFloat(v) || 0));
                      }}
                    />
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => removeRelicBonus(i)}>
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2 border-t border-border/50">
        <Button variant="outline" size="sm" className="text-xs" onClick={onCancel}>취소</Button>
        <Button size="sm" className="text-xs" onClick={handleConfirm} disabled={!data.name.trim() || !data.type}>
          적용
        </Button>
      </div>
    </div>
  );
}
