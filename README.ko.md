# PhaseHarness

PhaseHarness는 AI 코딩 에이전트가 큰 작업을 단계적으로 처리하도록 돕는 workflow harness입니다.

진행 순서는 아래와 같습니다.

```text
clarify -> context-gather -> plan -> generate -> evaluate
```

각 run의 상태와 산출물은 `.phaseharness/runs/<run-id>/` 아래에 저장되고, Codex 또는 Claude 세션 hook을 통해 자동 workflow를 이어갈 수 있습니다.

## 설치

PhaseHarness를 사용할 저장소에서 실행하세요.

```bash
npx phaseharness@latest init
```

pnpm 사용자는 아래처럼 실행할 수 있습니다.

```bash
pnpm dlx phaseharness@latest init
```

installer는 대상이 git 저장소인지, `python3`를 사용할 수 있는지 확인한 뒤 어떤 agent와 연결할지 물어봅니다.

```text
[x] Codex
[ ] Claude
```

프롬프트 없이 설치하려면:

```bash
npx phaseharness@latest init --agents codex,claude
# 또는
pnpm dlx phaseharness@latest init --agents codex,claude
```

## Agent 통합

설치 선택지는 아래 파일에 저장됩니다.

```text
.phaseharness/install.json
```

선택한 agent만 SessionStart 때 reconcile됩니다.

- Codex: `.codex/config.toml`, `.codex/hooks.json`, `.codex/skills`
- Claude: `.claude/settings.json`, `.claude/skills`

`.phaseharness/skills`가 원본입니다. Codex/Claude 쪽 skill 디렉터리는 이 원본에서 덮어써지는 generated bridge output입니다. symlink는 사용하지 않습니다.

나중에 Claude를 추가하려면:

```bash
npx phaseharness@latest add claude
# 또는
pnpm dlx phaseharness@latest add claude
```

기존 설치를 최신 npm package payload로 갱신하려면:

```bash
npx phaseharness@latest init -y --force
# 또는
pnpm dlx phaseharness@latest init -y --force
```

수동으로 skill 복사본을 동기화하려면:

```bash
npx phaseharness@latest sync
```

`sync`는 core `.phaseharness` payload를 내려받거나 교체하지 않습니다. 설치된 `.phaseharness/skills` 원본에서 선택된 agent hook과 generated skill 복사본을 덮어씁니다.

## 빠른 시작

에이전트에게 아래처럼 요청하세요.

```text
Use `phaseharness` to implement <task>.
```

시작 전 옵션:

- `loop count`: evaluate 실패 시 `generate -> evaluate`를 다시 돌릴 수 있는 최대 횟수
- `commit mode`: `none`, `phase`, `final`

기본값:

```text
loop count: 2
commit mode: none
```

## 대시보드

에이전트에게 아래처럼 요청하세요.

```text
Use `phaseharness-dashboard` to show the dashboard.
```

대시보드는 현재 active run, 단계 진행 상황, 산출물, 진단 정보, run history를 보여줍니다.

## 프로젝트 지침 연결

프로젝트에 아키텍처 문서, 코딩 규칙, 리뷰 기준이 있다면 예시 파일을 복사하세요.

```bash
cp .phaseharness/context.example.json .phaseharness/context.json
```

그다음 `.phaseharness/context.json`을 수정합니다.

- `context-gather.documents`: 계획 전 참고할 문서
- `evaluate.documents`: 검토 때 참고할 문서
- `evaluate.rules`: 추가 검토 규칙

## 명령어

```bash
phaseharness init
phaseharness add codex
phaseharness add claude
phaseharness sync
phaseharness doctor
```

## 개발

이 저장소는 pnpm으로 관리하는 npm package입니다.

```bash
pnpm install
pnpm run check
pnpm run pack:dry
```

설치되는 PhaseHarness 파일은 아래에 둡니다.

```text
templates/core/.phaseharness/
```

루트 저장소에는 실제 설치용 `.phaseharness/`를 추적하지 않습니다. `.phaseharness/state`와 `.phaseharness/runs` 같은 runtime state는 대상 프로젝트 안에서만 생성됩니다.
