# 데이터 구조 영어화 대응 계획

## 목표
- 업로드된 새 `equipment/` 구조(영어 키 + `name_ko` + `image_key` + `이미지_경로` 직접 포함, 친밀감/원소/영혼 영문화, `장비_에어쉽파워보너스`·`천상` 등 추가 필드)를 적용
- 기존 컴포넌트/시뮬레이션 로직은 한국어 키 기반으로 동작하므로 **로더 단계에서 한국어 키 기반 구조로 정규화**해 다운스트림 코드 수정 최소화
- 향후 i18n(영/한 전환)을 위한 영문 식별자(`engName`, `image_key`)는 EquipmentItem에 함께 보존

## 구현 범위

### 1) 새 파일 교체
업로드된 `equipment_new/*` 전체를 `public/data/equipment/`에 덮어쓴다.

### 2) 어댑터 레이어 추가
새 파일: `src/lib/dataAdapter.ts`
- `ELEMENT_EN_TO_KO`, `SPIRIT_EN_TO_KO` 매핑(불/물/공기/대지/빛/어둠/골드, 늑대/양/독수리 등) 보유
- `normalizeEquipFile(rawJson)` → 기존 형태(`{ "n티어": { 한국어이름: { ... } } }`)로 변환
  - 각 아이템: 한국어명 = `name_ko`로 키 재배치
  - 친밀감/고유원소/고유영혼 배열을 영문→한글 변환
  - `engName`, `image_key`, `이미지_경로` 등 신규 필드는 그대로 유지(추가만 됨)
- `normalizeElementEnchant(rawJson)`, `normalizeSpiritEnchant(rawJson)` → 내부 키를 한국어로 재매핑
- 모든 변환 결과는 메모이즈

### 3) 로더 통합
- `src/lib/equipmentUtils.ts`
  - `loadEquipmentByTypes`: 응답을 `normalizeEquipFile`로 통과
  - `loadDualWieldData`: 동일
  - `getEquipImagePath`/`EquipmentItem.imagePath`: 아이템 자체 `이미지_경로`를 우선 사용, 없으면 기존 name_map 폴백
  - `EquipmentItem`에 `engName`, `imageKey`, `airshipPowerBonus`, `heavenly`(천상 계수) 필드 추가
- `src/lib/championEquipUtils.ts`(familiar/aurasong) 동일 패턴 적용(필요 시)
- `src/lib/skillBonusParser.ts`, `src/lib/partyBuffCalculator.ts`(spirit/aurasong fetch) 정규화 호출 추가
- `src/components/EnchantPickerDialog.tsx` 직접 fetch 부분도 정규화 호출

### 4) 신규 필드 활용
- `천상`(per-item 1 또는 1.25): 이미 `equipStatCalculator`에서 `item['천상']`로 읽고 있으므로 동작함 — 정규화에서 키만 보존하면 OK
- `장비_에어쉽파워보너스`: `EquipmentItem.airshipPowerBonus`로 노출. 현재 시뮬레이션이 사용하지 않으므로 표시·후속 작업용으로 보존만 함

### 5) 검증
- 기존 저장된 영웅(한국어 장비명)이 정상 매칭되는지 확인
- 친밀감 표기·고유 원소 적용·영혼 효과·이미지 표시·천상 1.25 적용 케이스 확인
- 합성·시뮬레이션 결과가 변경 전과 동일한지 빠른 비교

## 비-목표
- UI 텍스트 영어화는 이번 작업 범위 아님(데이터 구조만 대응)
- `장비_에어쉽파워보너스`의 실제 게임 효과 적용은 별도 작업(보존만)

---

질문(짧게):
1. `장비_에어쉽파워보너스`의 정확한 의미/적용 방식이 정해져 있다면 알려줘. 정해져 있지 않으면 이번엔 보존만 하고 추후 작업할게.
2. 어댑터 방식(다운스트림 영향 최소)으로 가도 괜찮지? 아니면 코어 로직까지 영어 키 기반으로 점진 마이그레이션을 원해?
