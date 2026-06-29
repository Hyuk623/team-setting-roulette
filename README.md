# 팀 세팅 룰렛

체육 활동에서 동물·도형·번호 캐릭터와 선택 이름으로 팀을 빠르게 편성하는 React + TypeScript + Vite PWA입니다. 로그인과 백엔드는 없고, 팀 설정과 현재 선택 상태는 브라우저 `localStorage`에 저장됩니다.

## 주요 기능

- 2~8개 팀 설정
- 2~40명 캐릭터 터치 선택 및 선택 이름 입력
- 강사용 같은 팀 피하기 묶음 여러 개 설정
- seeded random 기반 순수 TypeScript 팀 배정 알고리즘
- 룰렛 애니메이션 전 사전 계산된 결과로 캐릭터 이동
- 팀별 인원 차이 기본 최대 1명, 절대 2명 초과 방지
- 재룰렛 시 캐릭터와 같은 팀 피하기 묶음 유지
- PWA 설치 및 오프라인 재실행
- GitHub Pages 배포 워크플로

## 개발

```bash
npm install
npm run dev
```

검증 명령:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## 팀 배정 알고리즘

핵심 로직은 `src/lib/teamAssignment.ts`에 UI와 분리된 순수 TypeScript 모듈로 작성되어 있습니다.

- `assignTeams`는 참가자 ID, 팀 수, 같은 팀 피하기 묶음, seed를 받아 팀 결과를 반환합니다.
- 같은 seed와 같은 입력은 항상 같은 결과를 만듭니다.
- 같은 팀 피하기 묶음은 팀 수를 늘리지 않고 `5명/4팀 → 2·1·1·1`처럼 균등하게 나눕니다.
- 여러 같은 팀 피하기 묶음과 일반 참가자를 합쳐도 전체 팀 인원 차이를 1명 이내로 맞춥니다.

## GitHub Pages

저장소 이름은 `team-setting-roulette`를 기준으로 Vite `base`가 `/team-setting-roulette/`로 설정됩니다. GitHub 저장소에서 Pages source를 `GitHub Actions`로 선택하면 `.github/workflows/deploy.yml`이 `main` 브랜치 push 때 배포합니다.

## 저장소 생성 예시

GitHub CLI가 설치되어 있고 로그인되어 있다면:

```bash
git remote add origin https://github.com/Hyuk623/team-setting-roulette.git
git push -u origin main
```

이후 Pages 설정에서 `GitHub Actions`를 선택하거나, 이미 선택되어 있다면 `main` push 후 자동 배포됩니다.
