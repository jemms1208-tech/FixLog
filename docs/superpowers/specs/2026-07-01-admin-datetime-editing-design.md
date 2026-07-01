# 관리자급 날짜시간 직접 편집 기능 — 설계

작성일: 2026-07-01
대상 파일: `src/app/dashboard/records/page.tsx`, `supabase/add_datetime_admin_protection.sql`(신규)

## 배경 / 목적

접수 건은 **대기(접수) → 처리중(1차처리) → 완료** 3단계로 관리되며, 각 단계의 날짜시간이 자동으로 기록된다. 현실에서는 실제 발생 시각과 시스템 입력 시각이 어긋나는 경우(전날 접수분을 다음 날 입력, 담당자의 시각 오입력 등)가 있어, **관리자급이 사후에 시각을 바로잡을 수 있는 수단**이 필요하다.

## 확정 요구사항

1. 일반 동작은 그대로 유지 — 접수/1차처리/완료 시 현재 시각 자동 기록, 일반 사용자는 시각 변경 불가.
2. **`admin`·`operator`(관리자급)만** 접수 등록 시·수정 시에 접수/1차처리/완료 날짜시간을 직접 수정 가능.
3. 시간 순서 검증은 하지 않는다(관리자는 자유롭게 입력).
4. UI뿐 아니라 **DB(트리거) 레벨까지 안전하게** — 일반 사용자가 API를 직접 조작해도 시각을 임의 지정할 수 없어야 한다.

관리자급 판별은 기존 `check_is_admin()`(role IN ('admin','operator'))과 프론트의 `userRole` 상태를 재사용한다.

## 현재 동작 (조사 결과)

날짜시간 필드: `reception_at`(접수), `started_at`(1차처리 시작), `processed_at`(완료).

날짜시간을 만질 수 있는 화면은 4곳:

| 화면 | 현재 날짜 편집 UI | 현재 동작 |
|------|------------------|-----------|
| ① 신규 접수 모달 | 없음 | 상태 버튼 클릭 시 `started_at`/`processed_at` 현재 시각 자동 세팅. `reception_at`은 DB `DEFAULT now()` |
| ② 접수 수정 모달 | 없음 | 날짜 편집 불가(담당자·상태·내용만). `handleUpdateRecord`는 기존 `started_at`/`processed_at` 값을 그대로 전송 |
| ③ 1차처리 모달 | `datetime-local` 있음 | **현재 누구나** `started_at` 변경 가능 |
| ④ 완료 처리 모달 | `datetime-local` 있음 | **현재 누구나** `processed_at` 변경 가능 |

RLS 정책(`FINAL_RLS_HARDENING.sql`)은 행 단위라 특정 컬럼만 잠글 수 없다. 따라서 DB 방어는 트리거로 구현한다.

## 변경 범위

### A. 프론트엔드 (`records/page.tsx`)

`isAdmin = userRole === 'admin' || userRole === 'operator'` 파생값을 도입하고, 4개 화면에 조건부 UI를 적용한다.

- **① 신규 접수 모달**: `isAdmin`에게만
  - 접수일시 `datetime-local` 편집칸 추가(기본값=현재 시각). 일반 사용자는 미노출 → `reception_at`은 DB `now()`.
  - 1차처리/완료 상태 선택 시 나타나는 영역에 `started_at`/`processed_at` `datetime-local` 편집칸을 노출.
  - `newRecord`에 `reception_at` 필드 추가. `handleAddRecord`는 `isAdmin && reception_at`일 때만 `reception_at`을 payload에 포함(아니면 미포함 → DB default).
- **② 수정 모달**: `isAdmin`에게만 접수/1차처리/완료 일시 편집칸 3개 추가. 일반 사용자는 지금처럼 날짜 편집 불가. `handleUpdateRecord`는 `isAdmin`일 때만 `reception_at`을 update에 포함.
- **③ 1차처리 모달 / ④ 완료 모달**: 기존 `datetime-local`을 `isAdmin`에게만 편집 가능하게 하고, 일반 사용자에겐 읽기전용 표시 + "현재 시각으로 기록됩니다" 안내. 값은 항상 현재 시각으로 전송(서버가 어차피 강제하므로 무해).

UTC 저장값 ↔ `datetime-local`(로컬, `YYYY-MM-DDTHH:mm`) 변환 헬퍼를 추가한다. 기존 코드의 `new Date(now.getTime() - now.getTimezoneOffset()*60000).toISOString().slice(0,16)` 패턴을 함수화하여 신규/수정 모달에서 기존 값을 편집칸에 올바르게 채운다. 저장 시에는 `new Date(value).toISOString()`.

### B. DB 트리거 (신규 `supabase/add_datetime_admin_protection.sql`)

`service_records`에 `BEFORE INSERT OR UPDATE` 트리거 함수(`SECURITY DEFINER`, `SET search_path = public`)를 추가한다. 로직:

```
IF check_is_admin() THEN
    RETURN NEW;                     -- 관리자: 보낸 값 그대로 존중
END IF;

-- 일반 사용자
IF TG_OP = 'INSERT' THEN
    NEW.reception_at := now();                       -- 접수일시 강제
    IF NEW.started_at   IS NOT NULL THEN NEW.started_at   := now(); END IF;
    IF NEW.processed_at IS NOT NULL THEN NEW.processed_at := now(); END IF;

ELSIF TG_OP = 'UPDATE' THEN
    NEW.reception_at := OLD.reception_at;             -- 접수일시 변경 금지

    -- started_at
    IF OLD.started_at IS NULL AND NEW.started_at IS NOT NULL THEN
        NEW.started_at := now();                     -- 최초 기록 → 서버 시각
    ELSIF OLD.started_at IS NOT NULL AND NEW.started_at IS NOT NULL
          AND NEW.started_at <> OLD.started_at THEN
        NEW.started_at := OLD.started_at;            -- 변경 시도 → 무시
    END IF;   -- 값→NULL(대기 되돌리기)은 허용

    -- processed_at: started_at과 동일 규칙
    ...
END IF;
RETURN NEW;
```

- 파일은 재실행 가능하도록 `CREATE OR REPLACE FUNCTION` + `DROP TRIGGER IF EXISTS` 후 `CREATE TRIGGER`로 작성한다.
- 기존 RLS 정책은 변경하지 않는다.

### C. 범위 밖 (하지 않을 것)

- 시간 순서(접수 ≤ 1차 ≤ 완료) 검증 없음.
- `activity_logs`는 기존 `UPDATE_RECORD`/`CREATE_RECORD` 로그를 그대로 사용(날짜 변경 별도 세분화 없음).
- 다른 페이지·기존 RLS 정책·기존 컬럼 스키마 변경 없음.

## 배포 절차

1. 프론트엔드 변경 배포.
2. `supabase/add_datetime_admin_protection.sql`을 **Supabase 대시보드 SQL Editor(또는 psql)에서 실행**하여 트리거 적용. (레포에는 파일만 커밋되며 자동 적용되지 않음.)

두 단계는 순서 무관하나, 트리거 미적용 상태에서 프론트만 배포되면 UI 게이팅만 동작(DB 방어 공백)하므로 가급적 함께 적용한다.

## 테스트 시나리오

관리자(admin/operator):
1. 신규 접수에서 접수일시를 과거로 지정 → 저장된 `reception_at`이 지정값과 일치.
2. 신규 접수를 완료 상태로 만들며 1차/완료 일시를 임의 지정 → 각 값 일치.
3. 수정 모달에서 세 날짜를 각각 변경 → 저장값 일치.

일반 사용자(callcenter/field):
4. 신규 접수(대기) 등록 → `reception_at`이 현재 시각.
5. 1차처리 모달에서 처리일시 편집칸 미노출, 저장 시 `started_at`이 현재 시각.
6. 완료 모달에서 완료일시 편집칸 미노출, 저장 시 `processed_at`이 현재 시각.
7. (우회 시도) API로 `reception_at`/`started_at`/`processed_at`에 임의 과거값 전송 → 트리거가 서버 시각/기존값으로 강제.
8. 처리중 건을 대기로 되돌리기 → `started_at`/`processed_at`이 NULL로 정상 초기화(트리거가 막지 않음).
