## 변경 계획 — 리스트 관리: 영웅/챔피언 추가, 수정

크기가 큰 작업이라, 6개 항목 전체를 묶어 정리합니다. 각 항목별 어디 파일을 어떻게 손볼지 미리 보여드릴게요.

### 1. 치명타 생존 확률 (이름 변경 + 로직 추가)
- 표기 변경: `'죽기 전 공격 한 번 버틸 확률'` → `'치명타 생존 확률%'` (스킬/소울 detail key + 표시 라벨 일괄 변경)
- 합산이 100을 초과하면 100으로 클램프
- 비숍/성직자(클래스명)는 무조건 100%로 강제(소울/스킬 합산 후 base 100% 부여)
- 아르마딜로 영혼 등 영혼 효과 → 이미 detail.survivalChance 합산되는 구조이면 그대로, 아니라면 `parseSoulBonuses`에서 매핑 추가
- 시뮬레이션 (`combatSimulation.ts`) — 캐릭터별로 `critSurvivalUsed: boolean` 플래그 1회용. "죽을 대미지를 받기 직전" 확률체크 → 성공 시 0 데미지(or HP 1로 보존), 1회만 발동, 군주 보호와 별개

### 2. 수정창 진입 시 스탯 재계산 속도 + 장비 선택창 스탯 표시
- HeroForm/ChampionForm: 첫 마운트 시 모든 장비/스킬을 한 번에 계산하던 흐름을 메모이즈/배치로 묶어 불필요한 awa it/setState 루프 줄이기
- EquipmentSelectDialog: 아이템 카드/툴팁/테이블에 표시되는 스탯이 **현재 선택된 등급 + 천상 여부** 반영 (마법부여 영향 X). 등급 변경 시 전체 표시값 재렌더

### 3. 영웅 수정 — 스킬 선택 버튼 색상
- HeroForm.tsx 의 스킬 선택 버튼을 스탯 계산표 박스와 동일한 배경/보더 토큰으로 통일

### 4. 천상(Airship Heaven) 1.25배 시스템
- 데이터: 장비 JSON에 `"천상": 1` 또는 `"천상": 1.25` 추후 입력 예정 → 로직만 선반영
- 슬롯 데이터 모델에 `heavenly: boolean` 추가 (기본 false)
- 계산: `equipStatCalculator.ts` — 장비 최종 스탯 산출 단계에서 슬롯이 heavenly이고 아이템의 `천상` 값이 1.25이면 모든 능력치(공/방/체/치확/회피/위협 등)에 1.25 곱한 뒤 반올림
- 마법부여로 인한 보너스에는 적용하지 않음
- 표시: 스탯 계산표(StatBreakdownDrawer / 영웅 폼 우측 표)에 천상 곱 단계가 보이도록
- UI:
  - EquipmentSelectDialog: 등급 셀렉터 옆에 "천상" 체크박스 + 일괄 적용 토글
  - ManualEquipmentForm: 천상 체크박스 (1.25배 적용)
  - 장비 박스 시각효과:
    - 내부 광채 = 등급 색상(기존 유지)
    - 테두리 + 외부 광채 = 무지개+다이아 대각선 회전(미용실 간판 스타일)
    - 외부 광채 두께는 기존과 동일, 색만 conic/linear-gradient 대각선
    - CSS 클래스 `equip-heavenly` 추가, 적용 위치:
      • 영웅/챔피언 장비 선택창(앨범)
      • 선택된 장비 이미지
      • 영웅/챔피언 추가/수정 화면의 장비 테이블
      • 리스트 관리 테이블식 확장 화면 장비 박스
      • 리스트 관리 앨범식 장비 박스
- 도움말(`?` 버튼) 텍스트에 천상 설명 추가

### 5. 영웅 장비 테이블 폰트
- HeroForm 장비 테이블 셀의 스탯 숫자 폰트 +2pt (`text-xs` → `text-sm` 정도, 정확한 현재값 확인 후 +2pt)

### 6. 장비/마법부여 선택창 크기
- EquipmentSelectDialog 앨범 장비 이미지 크기 약간 ↑ (예: w-16 h-16 → w-20 h-20 검토)
- EnchantPickerDialog 다이얼로그 높이 ↑ 또는 슬롯 간격 ↓ → 6개 슬롯이 모두 한 화면에 보이도록 (현재 5번까지만 보임)

---

### 기술적 구현 상세

**천상 멀티플라이어 적용 위치 (equipStatCalculator)**
```
finalStat = roundToInt( (baseItemStat + qualityBonus) * heavenlyMul )
heavenlyMul = (slot.heavenly && item['천상'] === 1.25) ? 1.25 : 1
// 마법부여로 추가되는 분량은 별도 합산 (천상 곱 미적용)
```

**치명타 생존 (combatSimulation)**
```
- character.critSurvivalChance: number (0~100, clamped)
- character.critSurvivalUsed: boolean
- 데미지 적용 직전 newHp <= 0 이면:
    if (!critSurvivalUsed && rand(100) < critSurvivalChance) {
       damage = currentHp - 1; critSurvivalUsed = true;
    }
- Bishop/Cleric: critSurvivalChance = max(critSurvivalChance, 100)
```

**미반영 사항(이번 스코프 제외)**
- 데이터 파일에 실제 `"천상"` 키를 채워 넣는 작업 — 사용자가 직접 입력 예정
- 앞선 메시지의 닌자/센세/광전사/잘 균형 재정리 — "나중에 정리해서 알려줄게"라고 하셨으므로 보류

### 파일 수정 예정
- `src/lib/equipStatCalculator.ts` — 천상 곱
- `src/lib/skillBonusParser.ts` — 치명타 생존 키 이름 변경 + 클램프
- `src/lib/combatSimulation.ts` — 생존 발동 로직
- `src/lib/championStatCalculator.ts` — 천상 곱
- `src/components/HeroForm.tsx` — 폰트 +2, 스킬버튼 색, 재계산 최적화
- `src/components/ChampionForm.tsx` — 재계산 최적화
- `src/components/EquipmentSelectDialog.tsx` — 천상 체크/일괄, 등급별 스탯 반영, 이미지 크기, 천상 시각효과
- `src/components/ManualEquipmentForm.tsx` — 천상 체크박스
- `src/components/EnchantPickerDialog.tsx` — 다이얼로그 높이/간격
- `src/components/HeroList.tsx` — 확장/앨범 장비 박스에 천상 클래스
- `src/components/StatBreakdownDrawer.tsx`, `ChampionStatBreakdownDrawer.tsx` — 표에 천상 단계 표시
- `src/index.css` — `.equip-heavenly` 무지개+다이아 대각선 보더/외광 효과
- `src/types/game.ts` — 슬롯에 `heavenly?: boolean`

이 계획대로 진행하면 될까요? 천상 시각효과의 회전 애니메이션은 잔잔한 속도(예: 6s linear infinite)로 잡으려고 합니다.