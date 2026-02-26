import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  getSkillImagePath,
  getSkillGrade,
  areSkillsIncompatible,
  STAT_FILTER_OPTIONS,
  setSkillGradeCache,
} from '@/lib/skillUtils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface SkillSelectDialogProps {
  open: boolean;
  onClose: () => void;
  availableSkills: string[];
  selectedSkills: string[];
  maxSlots: number;
  commonSkillsData: Record<string, any>;
  onConfirm: (skills: string[]) => void;
  recommendedSets?: Record<string, string[]>;
  jobElementValue?: number;
}

const GRADE_COLORS: Record<string, string> = {
  '일반': 'border-amber-700/60 bg-amber-900/20',
  '희귀': 'border-cyan-500/60 bg-cyan-900/20',
  '에픽': 'border-yellow-400/60 bg-yellow-900/20',
};

const GRADE_HEADER_COLORS: Record<string, string> = {
  '일반': 'bg-amber-800/80 text-amber-100',
  '희귀': 'bg-cyan-700/80 text-cyan-100',
  '에픽': 'bg-yellow-600/80 text-yellow-100',
};

export default function SkillSelectDialog({
  open,
  onClose,
  availableSkills,
  selectedSkills: initialSelected,
  maxSlots,
  commonSkillsData,
  onConfirm,
  recommendedSets,
  jobElementValue = 0,
}: SkillSelectDialogProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [gradeFilter, setGradeFilter] = useState<string>('');
  const [statFilter, setStatFilter] = useState<string>('');

  useEffect(() => {
    if (commonSkillsData && Object.keys(commonSkillsData).length > 0) {
      setSkillGradeCache(commonSkillsData);
    }
  }, [commonSkillsData]);

  useEffect(() => {
    if (open) {
      setSelected([...initialSelected]);
    }
  }, [open, initialSelected]);

  const skillsByGrade = useMemo(() => {
    const groups: Record<string, string[]> = { '일반': [], '희귀': [], '에픽': [] };
    for (const skillName of availableSkills) {
      const data = commonSkillsData[skillName];
      const grade = data?.['희귀도'] || '일반';
      if (gradeFilter && grade !== gradeFilter) continue;
      if (statFilter) {
        const filterOption = STAT_FILTER_OPTIONS.find(o => o.label === statFilter);
        if (filterOption) {
          const bonuses = data?.['스탯_보너스'] || {};
          const bonusKeys = Object.keys(bonuses);
          const hasMatch = filterOption.keys.some(k => bonusKeys.includes(k));
          if (!hasMatch) continue;
        }
      }
      if (!groups[grade]) groups[grade] = [];
      groups[grade].push(skillName);
    }
    return groups;
  }, [availableSkills, commonSkillsData, gradeFilter, statFilter]);

  const toggleSkill = (skillName: string) => {
    setSelected(prev => {
      if (prev.includes(skillName)) {
        return prev.filter(s => s !== skillName);
      }
      if (prev.length >= maxSlots) return prev;
      for (const existing of prev) {
        if (areSkillsIncompatible(skillName, existing, commonSkillsData)) {
          return prev;
        }
      }
      return [...prev, skillName];
    });
  };

  const isIncompatibleWithSelected = (skillName: string): string | null => {
    for (const existing of selected) {
      if (areSkillsIncompatible(skillName, existing, commonSkillsData)) {
        return existing;
      }
    }
    return null;
  };

  const getSkillTooltipContent = (skillName: string) => {
    const data = commonSkillsData[skillName];
    if (!data) return null;

    // Calculate level based on jobElementValue
    const thresholds: number[] = (data['원소_기준치'] || []).map((v: unknown) => Number(v)).filter((v: number) => Number.isFinite(v));
    let levelIndex = 0;
    for (let t = 0; t < thresholds.length; t++) {
      if (jobElementValue >= thresholds[t]) levelIndex = t;
    }
    const currentLevel = levelIndex + 1;

    const desc = data['스킬_설명']?.[levelIndex] || data['스킬_설명']?.[0] || '';
    const levelName = data['레벨별_스킬명']?.[levelIndex] || skillName;
    return (
      <div className="max-w-xs space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold text-sm">{levelName}</p>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">Lv.{currentLevel}</span>
        </div>
        <p className="text-xs text-foreground/80 whitespace-pre-line">{desc}</p>
      </div>
    );
  };

  const handleConfirm = () => {
    onConfirm(selected);
    onClose();
  };

  const handleReset = () => {
    setSelected([]);
  };

  const applyRecommendedSet = (setName: string) => {
    if (!recommendedSets || setName === '_none') return;
    const skills = recommendedSets[setName];
    if (!skills) return;
    const validSkills = skills.filter(s => availableSkills.includes(s)).slice(0, maxSlots);
    setSelected(validSkills);
  };

  const gradeOrder = ['일반', '희귀', '에픽'];

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-primary font-semibold" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>스킬 선택</DialogTitle>
        </DialogHeader>

        {/* Selected skills preview + slots + recommended set */}
        <div className="flex items-center gap-2 py-2 border-b border-border">
          <span className="text-sm text-foreground/70 mr-2">
            선택: {selected.length} / {maxSlots}
          </span>
          {Array.from({ length: maxSlots }).map((_, i) => {
            const skill = selected[i];
            return (
              <div
                key={i}
                className={`w-11 h-11 rounded border-2 flex items-center justify-center overflow-hidden transition-all ${
                  skill
                    ? 'border-accent/60 bg-accent/10'
                    : 'border-border/50 bg-secondary/20'
                }`}
                title={skill || `슬롯 ${i + 1}`}
              >
                {skill ? (
                  <img
                    src={getSkillImagePath(skill)}
                    alt={skill}
                    className="w-9 h-9 object-contain"
                    onError={e => { e.currentTarget.style.display = 'none'; }}
                  />
                ) : (
                  <span className="text-[9px] text-muted-foreground">{i + 1}</span>
                )}
              </div>
            );
          })}
          {/* Locked slots */}
          {Array.from({ length: Math.max(0, 4 - maxSlots) }).map((_, i) => (
            <div
              key={`locked-${i}`}
              className="w-11 h-11 rounded border-2 border-border/20 bg-secondary/10 flex items-center justify-center opacity-30"
            >
              <span className="text-[9px] text-muted-foreground">🔒</span>
            </div>
          ))}
          {/* Recommended sets - right aligned */}
          <div className="ml-auto flex items-center gap-1.5">
            {recommendedSets && Object.keys(recommendedSets).length > 0 && (
              <>
                <span className="text-[10px] text-foreground/50">추천:</span>
                <Select onValueChange={applyRecommendedSet}>
                  <SelectTrigger className="h-8 w-28 text-xs">
                    <SelectValue placeholder="불러오기" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(recommendedSets).map(setName => (
                      <SelectItem key={setName} value={setName}>
                        {setName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 py-2">
          <span className="text-xs text-foreground/60">등급:</span>
          <Button
            size="sm"
            variant={gradeFilter === '' ? 'default' : 'outline'}
            className="h-6 text-xs px-2"
            onClick={() => setGradeFilter('')}
          >
            전체
          </Button>
          {gradeOrder.map(g => (
            <Button
              key={g}
              size="sm"
              variant={gradeFilter === g ? 'default' : 'outline'}
              className="h-6 text-xs px-2"
              onClick={() => setGradeFilter(gradeFilter === g ? '' : g)}
            >
              {g}
            </Button>
          ))}
          <span className="text-xs text-foreground/60 ml-3">스탯:</span>
          <select
            className="h-6 text-xs bg-secondary/50 border border-border rounded px-1 text-foreground"
            value={statFilter}
            onChange={e => setStatFilter(e.target.value)}
          >
            <option value="">전체</option>
            {STAT_FILTER_OPTIONS.map(opt => (
              <option key={opt.label} value={opt.label}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Skill grid by grade */}
        <TooltipProvider delayDuration={200}>
          <div className="flex-1 overflow-y-auto scrollbar-fantasy space-y-4 pr-1">
            {gradeOrder.map(grade => {
              const skills = skillsByGrade[grade] || [];
              if (skills.length === 0) return null;
              return (
                <div key={grade}>
                  <div className={`text-center text-sm font-semibold py-1 rounded-t ${GRADE_HEADER_COLORS[grade]}`}>
                    {grade}
                  </div>
                  <div className="grid grid-cols-7 sm:grid-cols-9 md:grid-cols-11 gap-1 p-2 border border-t-0 rounded-b border-border/30 bg-secondary/10">
                    {skills.map(skillName => {
                      const isSelected = selected.includes(skillName);
                      const isFull = selected.length >= maxSlots && !isSelected;
                      const incompatWith = isIncompatibleWithSelected(skillName);
                      const disabled = isFull || (!!incompatWith && !isSelected);

                      return (
                        <Tooltip key={skillName}>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => !disabled && toggleSkill(skillName)}
                              disabled={disabled}
                              className={`flex flex-col items-center gap-0.5 p-1 rounded transition-all ${
                                isSelected
                                  ? 'ring-2 ring-accent bg-accent/15 scale-105'
                                  : disabled
                                    ? 'opacity-30 cursor-not-allowed'
                                    : 'hover:bg-secondary/40 cursor-pointer'
                              }`}
                            >
                              <div className={`w-10 h-10 rounded border ${GRADE_COLORS[grade]} flex items-center justify-center overflow-hidden`}>
                                <img
                                  src={getSkillImagePath(skillName)}
                                  alt={skillName}
                                  className="w-9 h-9 object-contain"
                                  onError={e => {
                                    const target = e.currentTarget;
                                    target.style.display = 'none';
                                    const parent = target.parentElement;
                                    if (parent && !parent.querySelector('.fallback-text')) {
                                      const span = document.createElement('span');
                                      span.className = 'fallback-text text-[6px] text-muted-foreground text-center';
                                      span.textContent = skillName.slice(0, 4);
                                      parent.appendChild(span);
                                    }
                                  }}
                                />
                              </div>
                              <span className="text-[9px] text-foreground leading-tight text-center w-full truncate">
                                {skillName}
                              </span>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" align="start" className="p-2 z-[100]" avoidCollisions={true} collisionPadding={10}>
                            {incompatWith && !isSelected ? (
                              <p className="text-xs text-destructive">{incompatWith}와(과) 호환 불가</p>
                            ) : (
                              getSkillTooltipContent(skillName)
                            )}
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {availableSkills.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">직업을 먼저 선택하세요</p>
            )}
          </div>
        </TooltipProvider>

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t border-border">
          <Button variant="destructive" size="sm" onClick={handleReset} className="text-xs px-3">
            초기화
          </Button>
          <div className="flex-1" />
          <Button onClick={handleConfirm} className="flex-1">확인</Button>
          <Button variant="outline" onClick={onClose} className="flex-1">취소</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}