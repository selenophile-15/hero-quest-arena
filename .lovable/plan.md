## 변경 계획 — 퀘스트 시뮬레이션 상세 정보 개선 (5개 항목)

### 1. 치명타 생존 로직 개정

**현재 동작 (잘못된 부분):**
- 치명타 생존 발동 시 HP를 1로 만듦 (`hp[idx] = 1`)
- 회피와 별개로 처리되는지 명확하지 않음

**바꿀 동작:**
- 회피 판정 먼저 → 회피 성공 시 치명타 생존은 발동하지 않음 (이미 그렇게 동작 중인지 확인 후 보정)
- 회피 실패 + 치사 대미지일 때만 치명타 생존 발동
- 발동 성공 시 HP를 1로 만들지 않고, **해당 데미지 자체를 무시** (HP 변화 없음)
- 판당 1회 (`surviveChance[idx] = 0` 처리 유지)
- 군주의 보호: 별개로 동작 — 치명타 생존이 없거나, 이미 소진했거나, 발동 실패한 경우 모두에 대해 동료 보호 가능 (현재 로직 확인 후 보정)

**구현 위치:**
- `src/lib/combatSimulation.ts`
  - `handleFatalBlow`: HP를 1로 설정하는 대신 외부에서 데미지를 0으로 만드는 시그널 반환. 호출부에서 데미지 적용 자체를 스킵하도록 변경
  - 회피 분기 → 치명타 생존 분기 → 군주의 보호 분기 순서로 정리
  - 로그 문구: `HP 1로 생존` → `치명타 생존! 대미지 무시`

**통계 반영:**
- `critSurvivalApplyRate` 등 발동 비율 통계는 전체/성공/실패 버킷별로 분리되어야 함 (5번 항목과 연관). 현재 전역 카운터로만 잡혀 있다면 성공/실패 버킷에도 누적하도록 추가.

### 2. 회복 통계 — 실제 매턴 체력 재생 합산

**현재:** "턴당 평균" = 총 회복량 ÷ 라운드 수 형태로 추정 표시

**바꿀 동작:**
- 각 라운드 회복 페이즈에서 발생한 모든 회복 합계를 실제로 누적
- 표시값 = 실제 누적 회복 ÷ 라운드 수 (이미 `totalHealing[i]`로 누적 중이므로, 표시 라벨/계산식만 "실제 매턴 회복 합산"으로 명확화)
- 챔피언/오라의 노래로 인한 매턴 체력 재생도 회복 페이즈에서 합산되도록 확인 (`liluHealFlat`, 챔피언 회복 효과 포함)

**구현 위치:** `src/lib/combatSimulation.ts` 회복 페이즈 (라인 2066-2085 부근), `QuestSimulation.tsx` 회복 표시 컬럼

### 3. 탭 라벨 변경

- 대분류 탭: "퀘스트 시뮬레이션" 유지
- 소분류 탭(상세 내 sub-tab): "퀘스트 시뮬레이션" → "시뮬레이션"

**구현 위치:** `src/components/QuestSimulation.tsx` 의 sub-tab 라벨

### 4. 파티원 데이터 실시간 동기화

**현재 문제:**
- 리스트 관리에서 영웅/챔피언을 새로 추가해도 퀘스트 시뮬레이션의 파티원 선택 다이얼로그/결과 화면에 즉시 반영되지 않음
- "리스트에 영웅/챔피언을 추가해주세요" 안내가 새로고침 전까지 사라지지 않음

**바꿀 동작:**
- `HeroSelectDialog`(파티원 선택 다이얼로그)와 `QuestSimulation` 본문 모두, 현재 시점의 `getHeroes()` 결과를 매 렌더 또는 다이얼로그 오픈 시 새로 읽도록 변경
- LocalStorage 변경 이벤트(`storage` 이벤트 + 기존 프로젝트의 focus 동기화 패턴)에 구독하여 자동 리렌더
- 결과(저장된 시뮬레이션) 로드 시: 각 파티원 ID를 현재 리스트와 대조
  - 리스트에 존재하면 → 현재 리스트의 최신 데이터 사용
  - 없으면 → 결과 저장 시점의 파티원 스냅샷 그대로 사용
- 저장 데이터에 파티원 전체 스냅샷이 이미 들어있는지 확인 (`SavedSimulationSummary.heroSummaries`는 요약만이라 부족할 수 있음 → 필요 시 `heroSnapshots: Hero[]` 추가)

**구현 위치:**
- `src/components/QuestSimulation.tsx` — 파티 구성/결과 로드 시 hero ID로 lookup
- `src/components/HeroSelectDialog.tsx` — 매 오픈 시 fresh heroes 사용
- `src/lib/savedSimulations.ts` — `heroSnapshots` 필드 추가 (옵셔널, 기존 데이터 호환)
- `SavedResults.tsx` — 저장 시 스냅샷 포함

**용량 관리:** 스냅샷은 결과당 최대 5명 정도라 큰 부담은 아니지만, 필요한 핵심 필드만 저장(현재 `Hero` 그대로) — 별도 압축은 하지 않음.

### 5. "주요 결과" 전체/성공/실패 드롭다운 변경

- 현재: 셀렉트 드롭다운 형태
- 바꿀 것: "상세 정보" 섹션에서 사용 중인 토글/세그먼트 컨트롤 형태와 동일한 UI로 통일

**구현 위치:** `src/components/QuestSimulation.tsx` 주요 결과 섹션 헤더 부근의 Select → 기존 상세 정보 토글 컴포넌트 재사용

---

### 기술적 구현 상세

**치명타 생존 — handleFatalBlow 리팩토링 예시**
```ts
// 반환: 'survived' | 'absorbed_by_guard' | 'died'
function handleFatalBlow(idx: number, incomingDmg: number): {
  survived: boolean;
  ignoreDamage: boolean;
} {
  if (Math.random() < surviveChance[idx]) {
    surviveChance[idx] = 0;
    critSurvivals[idx]++;
    return { survived: true, ignoreDamage: true }; // 데미지 자체를 무시
  }
  return { survived: false, ignoreDamage: false };
}
// 호출부:
// 1) 회피 판정 → 회피 성공 시 데미지 0, 치명타 생존 호출 안 함
// 2) 회피 실패 + (hp - dmg <= 0) → handleFatalBlow → ignoreDamage면 dmg = 0
// 3) 그래도 죽을 경우 → 군주의 보호 판정 (현재 로직 유지)
```

**파티원 동기화 패턴**
```ts
const [heroesVersion, setHeroesVersion] = useState(0);
useEffect(() => {
  const refresh = () => setHeroesVersion(v => v + 1);
  window.addEventListener('storage', refresh);
  window.addEventListener('focus', refresh);
  window.addEventListener('heroes-updated', refresh); // 커스텀 이벤트
  return () => { /* cleanup */ };
}, []);
const heroes = useMemo(() => getHeroes(), [heroesVersion]);
```
리스트 관리(추가/수정/삭제) 코드에서도 `window.dispatchEvent(new Event('heroes-updated'))` 발행.

### 파일 수정 예정
- `src/lib/combatSimulation.ts` — 치명타 생존 데미지 무시 처리, 회복 누적 확인, 전체/성공/실패 버킷별 생존 통계
- `src/components/QuestSimulation.tsx` — 소분류 탭 라벨, 파티원 실시간 lookup, 주요 결과 전체/성공/실패 UI 변경, 회복 라벨
- `src/components/HeroSelectDialog.tsx` — fresh heroes 사용
- `src/components/SavedResults.tsx` — 저장 시 hero 스냅샷 포함, 로드 시 ID 매칭
- `src/lib/savedSimulations.ts` — 타입에 `heroSnapshots?` 추가
- `src/components/HeroList.tsx` / `HeroForm.tsx` / `ChampionForm.tsx` — heroes 변경 시 커스텀 이벤트 발행 (기존 storage 동기화 패턴 활용)

이 계획대로 진행할까요? 특히 4번 — 저장된 결과의 파티원이 현재 리스트에 있을 때는 "최신 데이터"로 갱신해서 보여주는 게 맞는지(저장 당시 상태가 아니라) 확인 부탁드려요.