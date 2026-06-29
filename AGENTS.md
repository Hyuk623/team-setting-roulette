# AGENTS.md

이 저장소는 팀 세팅 룰렛 PWA입니다.

## 작업 원칙

- UI 문구는 한국어를 유지합니다.
- 로그인, 서버, 원격 DB를 추가하지 않습니다.
- 팀 설정과 현재 진행 상태는 `localStorage` 기반으로 유지합니다.
- 팀 배정 로직은 `src/lib/teamAssignment.ts`의 순수 TypeScript 모듈 안에 둡니다.
- 룰렛 애니메이션은 결과를 결정하지 않습니다. 결과는 애니메이션 시작 전에 계산되어야 합니다.
- 한 캐릭터는 하나의 같은 팀 피하기 묶음에만 포함될 수 있습니다.
- 팀별 전체 인원 차이는 기본 1명 이내여야 하며, 어떤 경우에도 2명을 초과하면 안 됩니다.

## 검증

변경 후 아래 명령을 실행합니다.

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```
