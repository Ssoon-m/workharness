# PhaseHarness

PhaseHarness는 AI 코딩 에이전트가 큰 작업을 단계적으로 처리하도록 돕는 workflow harness입니다.

진행 순서는 아래와 같습니다.

```text
clarify -> context-gather -> plan -> generate -> evaluate
```

각 run의 상태와 산출물은 `.phaseharness/runs/<run-id>/` 아래에 저장되고, Codex 또는 Claude Stop hook을 통해 자동 workflow를 이어갈 수 있습니다.

## 지원하는 Agent

- Claude Code
- Codex CLI

> Codex CLI로 실행시 Codex가 프로젝트 hook 실행 승인을 요청할 수 있습니다. PhaseHarness 워크플로우가 정상적으로 이어지려면 Codex에서 Stop hook을 꼭 승인해야 합니다. 승인을 하지 않으면 특정 단계 실행 후 이어서 진행하지 않습니다. 자세한 내용은 [Codex hooks 공식 문서](https://developers.openai.com/codex/hooks)를 참고하세요.

## 설치

PhaseHarness를 설치할 디렉터리에서 실행하세요.

```bash
npm create phaseharness@latest
pnpm create phaseharness@latest
yarn create phaseharness@latest
```

installer는 현재 디렉터리가 git 저장소 안인지, `python3`를 사용할 수 있는지 확인합니다. 모노레포에서는 PhaseHarness가 관리할 package/app 디렉터리에서 create 명령을 실행하세요. 그다음 어떤 agent와 연결할지 물어봅니다.

```text
[x] Codex
[ ] Claude
```

프롬프트 없이 설치하려면:

```bash
npm create phaseharness@latest -- --agents codex,claude
pnpm create phaseharness@latest --agents codex,claude
yarn create phaseharness@latest --agents codex,claude
```

## Agent 통합

agent 선택 결과는 아래 파일에 저장됩니다.

```text
.phaseharness/install.json
```

선택한 agent에 필요한 hook과 skill 디렉터리가 생성됩니다.

- Codex: `.codex/config.toml`, `.codex/hooks.json`, `.codex/skills`
- Claude: `.claude/settings.json`, `.claude/skills`

`.phaseharness/skills`가 원본입니다. Codex/Claude 쪽 skill 디렉터리는 이 원본에서 생성되는 output입니다. symlink는 사용하지 않습니다. `.phaseharness/skills`를 수정한 뒤에는 `sync` 명령어를 직접 실행해야 Codex/Claude 쪽 skill에 반영됩니다.

## 명령어

| 목적               | npm                                          | pnpm                                       | 설명                                                                     |
| ------------------ | -------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------ |
| Agent 추가         | `npm run phaseharness:add-agent`             | `pnpm run phaseharness:add-agent`          | 지원하는 agent 목록을 체크박스로 선택합니다.                             |
| Agent 직접 추가    | `npm exec phaseharness -- add agent claude`  | `pnpm exec phaseharness add agent claude`  | 특정 agent를 바로 추가합니다. 현재 `codex`, `claude`를 지원합니다.       |
| Skill 동기화       | `npm run phaseharness:sync`                  | `pnpm run phaseharness:sync`               | `.phaseharness/skills` 원본을 Codex/Claude generated skill로 반영합니다. |
| 상태 확인          | `npm run phaseharness:doctor`                | `pnpm run phaseharness:doctor`             | 설치 상태와 agent skill target을 점검합니다.                             |
| 대시보드           | `npm run phaseharness:dashboard`             | `pnpm run phaseharness:dashboard`          | 기본 포트 `4673`으로 dashboard를 엽니다.                                 |
| 대시보드 포트 지정 | `npm exec phaseharness -- dashboard -p 6006` | `pnpm exec phaseharness dashboard -p 6006` | 원하는 포트로 dashboard를 엽니다.                                        |
| 업데이트           | `npx phaseharness@latest upgrade`            | `pnpm dlx phaseharness@latest upgrade`     | 최신 package payload로 `.phaseharness`를 갱신합니다.                     |

`upgrade`는 `.phaseharness/skills`를 교체하기 전에 현재 skill 원본을 `.phaseharness/backups/skills-<timestamp>/`에 백업합니다. 새 package payload에 없는 PhaseHarness 관리 파일은 제거합니다.

`sync`는 core `.phaseharness` payload를 내려받거나 교체하지 않습니다. 설치된 `.phaseharness/skills` 원본에서 선택된 agent hook과 generated skill 복사본을 덮어씁니다.

yarn을 쓰는 프로젝트에서는 같은 script 이름을 yarn으로 실행하면 됩니다.

```bash
yarn phaseharness:add-agent
yarn phaseharness:dashboard
yarn phaseharness:sync
yarn phaseharness:doctor
```

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

기본적으로 `http://127.0.0.1:4673/`을 먼저 사용하고, 4673이 사용 중이면 빈 포트로 fallback합니다.

대시보드는 현재 active run, 단계 진행 상황, 산출물, 진단 정보, run history를 보여줍니다.

## 프로젝트 지침 연결

프로젝트에 아키텍처 문서, 코딩 규칙, 리뷰 기준이 있다면 예시 파일을 복사하세요.

```bash
cp .phaseharness/context.example.json .phaseharness/context.json
```

그다음 `.phaseharness/context.json`을 수정합니다.

- `context-gather.documents`: 계획 전 참고할 문서
- `context-gather.skills`: 작업 관련 convention을 확인할 agent skill
- `evaluate.documents`: 검토 때 참고할 문서
- `evaluate.skills`: 검토 기준으로 참고할 agent skill
- `evaluate.rules`: 추가 검토 규칙
