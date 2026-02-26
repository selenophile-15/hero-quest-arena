import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { SKILL_NAME_MAP } from '@/lib/nameMap';
import {
  getSkillImagePath,
  getSkillGrade,
  areSkillsIncompatible,
  STAT_BONUS_LABELS,
  setSkillGradeCache,
} from '@/lib/skillUtils';

interface SkillSelectDialogProps {
  open: boolean;
  onClose: () => void;
  availableSkills: string[];           // Skills this job can learn (from SKD1)
  selectedSkills: string[];            // Currently selected common skills
  maxSlots: number;                    // Max selectable slots
  commonSkillsData: Record<string, any>;
  onConfirm: (skills: string[]) => void;
  // Recommended skill sets
  recommendedSets?: Record<string, string[]>;
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
}: SkillSelectDialogProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [gradeFilter, setGradeFilter] = useState<string>('');
  const [statFilter, setStatFilter] = useState<string>('');

  // Initialize grade cache
  useEffect(() => {
    if (commonSkillsData && Object.keys(commonSkillsData).length > 0) {
      setSkillGradeCache(commonSkillsData);
    }
  }, [commonSkillsData]);

  // Reset selection when dialog opens
  useEffect(() => {
    if (open) {
      setSelected([...initialSelected]);
    }
  }, [open, initialSelected]);

  // Get all stat types available in the current skill set
  const statTypes = useMemo(() => {
    const types = new Set<string>();
    for (const skillName of availableSkills) {
      const data = commonSkillsData[skillName];
      if (data?.['스탯_보너스']) {
        for (const key of Object.keys(data['스탯_보너스'])) {
          types.add(key);
        }
      }
    }
    return Array.from(types).sort();
  }, [availableSkills, commonSkillsData]);

  // Group available skills by grade
  const skillsByGrade = useMemo(() => {
    const groups: Record<string, string[]> = { '일반': [], '희귀': [], '에픽': [] };
    for (const skillName of availableSkills) {
      const data = commonSkillsData[skillName];
      const grade = data?.['희귀도'] || '일반';
      // Apply filters
      if (gradeFilter && grade !== gradeFilter) continue;
      if (statFilter) {
        const bonuses = data?.['스탯_보너스'] || {};
        if (!Object.keys(bonuses).includes(statFilter)) continue;
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
      // Check incompatibility
      for (const existing of prev) {
        if (areSkillsIncompatible(skillName, existing, commonSkillsData)) {
          return prev; // Can't add
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

  const handleConfirm = () => {
    onConfirm(selected);
    onClose();
  };

  const applyRecommendedSet = (setSkills: string[]) => {
    // Only apply skills that are in available list and respect max slots
    const validSkills = setSkills.filter(s => availableSkills.includes(s)).slice(0, maxSlots);
    setSelected(validSkills);
  };

  const gradeOrder = ['일반', '희귀', '에픽'];

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-primary font-display">공용 스킬 선택</DialogTitle>
        </DialogHeader>

        {/* Selected skills preview + slots */}
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
                } ${i >= maxSlots ? 'opacity-30' : ''}`}
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
          {/* Show locked slots */}
          {Array.from({ length: Math.max(0, 4 - maxSlots) }).map((_, i) => (
            <div
              key={`locked-${i}`}
              className="w-11 h-11 rounded border-2 border-border/20 bg-secondary/10 flex items-center justify-center opacity-30"
            >
              <span className="text-[9px] text-muted-foreground">🔒</span>
            </div>
          ))}

          {/* Recommended sets */}
          {recommendedSets && Object.keys(recommendedSets).length > 0 && (
            <div className="ml-auto flex items-center gap-1">
              <span className="text-xs text-foreground/60 mr-1">추천:</span>
              {Object.entries(recommendedSets).map(([setName, skills]) => (
                <Button
                  key={setName}
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs px-2"
                  onClick={() => applyRecommendedSet(skills)}
                >
                  {setName}
                </Button>
              ))}
            </div>
          )}
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
            {statTypes.map(st => (
              <option key={st} value={st}>
                {STAT_BONUS_LABELS[st] || st.replace('스킬_', '')}
              </option>
            ))}
          </select>
        </div>

        {/* Skill grid by grade */}
        <div className="flex-1 overflow-y-auto scrollbar-fantasy space-y-4 pr-1">
          {gradeOrder.map(grade => {
            const skills = skillsByGrade[grade] || [];
            if (skills.length === 0) return null;
            return (
              <div key={grade}>
                <div className={`text-center text-sm font-semibold py-1 rounded-t ${GRADE_HEADER_COLORS[grade]}`}>
                  {grade} ({skills.length})
                </div>
                <div className="grid grid-cols-7 sm:grid-cols-9 md:grid-cols-11 gap-1 p-2 border border-t-0 rounded-b border-border/30 bg-secondary/10">
                  {skills.map(skillName => {
                    const isSelected = selected.includes(skillName);
                    const isFull = selected.length >= maxSlots && !isSelected;
                    const incompatWith = isIncompatibleWithSelected(skillName);
                    const disabled = isFull || (!!incompatWith && !isSelected);

                    return (
                      <button
                        key={skillName}
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
                        title={
                          incompatWith && !isSelected
                            ? `${incompatWith}와(과) 호환 불가`
                            : skillName
                        }
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

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t border-border">
          <Button onClick={handleConfirm} className="flex-1">확인</Button>
          <Button variant="outline" onClick={onClose} className="flex-1">취소</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
