# RewardLab

RewardLab은 Go 모듈 `github.com/bssm-oss/AIStudyWeb`의 현재 제품 이름입니다.

현재 이 저장소는 하나의 로컬 학습 경험만 제공합니다. 구체적으로는 epsilon-greedy 다중 슬롯머신 밴딧을 다루는 단일 레슨입니다. 애플리케이션은 로컬 HTTP 서버를 띄우는 Go CLI로 동작하며, 내장된 웹 에셋을 제공합니다. 레슨 자체는 순수 JavaScript로 브라우저에서 실행됩니다. 기본 동작은 여전히 브라우저 시뮬레이션이지만, 현재는 명시적으로 활성화했을 때만 사용할 수 있는 실험적 로컬 Ollama 가이드 모드도 포함됩니다.

## 현재 포함된 것

* 하나의 CLI 진입점: `rewardlab serve`
* `/healthz` 상태 확인 엔드포인트를 포함한 로컬 웹 서버 하나
* `/` 경로에서 제공되는 내장 레슨 UI 하나
* 브라우저에서 전부 계산되는 epsilon-greedy 밴딧 시뮬레이션 하나
* 선택적으로 활성화할 수 있는 실험적 로컬 Ollama 가이드 모드 하나
* CLI, 브라우저 오프너, 서버, 제공되는 UI를 검증하는 Go 단위/통합 테스트

## 현재 범위

RewardLab은 의도적으로 범위를 좁게 유지하고 있습니다.

* 제품 범위: 로컬 우선 학습 애플리케이션
* 레슨 범위: lesson 01 하나만 제공
* 알고리즘 범위: epsilon-greedy만 제공
* 전달 범위: Go가 제공하는 내장 정적 웹 에셋
* 영속성 범위: 없음
* 네트워크 범위: 로컬 서버만 사용

계획된 변경이라도 현재 코드베이스에 보이지 않는다면, 현재 동작이 아니라 미래 작업으로 취급해야 합니다.

## 요구 사항

현재 모듈 선언은 다음과 같습니다.

```text
module github.com/bssm-oss/AIStudyWeb
go 1.26.1
```

`go.mod`와 호환되는 Go 툴체인을 사용하세요.

## 설치 및 실행

소스에서 바로 앱을 실행하려면 다음 명령을 사용합니다.

```bash
go run ./cmd/rewardlab serve
```

유용한 플래그는 다음과 같습니다.

* `--host`, 기본값 `127.0.0.1`
* `--port`, 기본값 `8080`
* `--open`, 기본값 `true`
* `--experimental-ollama`, 기본값 `false`
* `--ollama-model`, 기본값 없음
* `--ollama-url`, 기본값 `http://127.0.0.1:11434`

예시는 다음과 같습니다.

```bash
go run ./cmd/rewardlab serve --open=false
go run ./cmd/rewardlab serve --host=127.0.0.1 --port=9090 --open=false
go run ./cmd/rewardlab serve --open=false --experimental-ollama --ollama-model=qwen2.5:3b
```

CLI 바이너리를 빌드하려면 다음 명령을 사용합니다.

```bash
go build ./cmd/rewardlab
```

정상적으로 시작되면 CLI는 아래와 비슷한 메시지를 출력합니다.

```text
RewardLab listening on http://127.0.0.1:8080
```

## 실험적 Ollama 가이드 모드

현재 RewardLab은 기본 epsilon-greedy 레슨을 유지한 채, 명시적으로 활성화했을 때만 동작하는 실험적 로컬 Ollama 가이드 모드를 제공합니다.

활성화 예시는 다음과 같습니다.

```bash
go run ./cmd/rewardlab serve --open=false --experimental-ollama --ollama-model=qwen2.5:3b
```

이 모드는 다음처럼 동작합니다.

* 기본 레슨은 그대로 epsilon-greedy를 실행합니다.
* 브라우저 UI에서 사용자가 실험적 Ollama 안내를 직접 opt-in 해야 합니다.
* RewardLab 서버는 `POST /experimental/ollama/guide` 로 현재 lesson 상태를 로컬 Ollama에 전달합니다.
* arm 선택 제안만 서버를 통해 받고, 보상 샘플링과 추정값 갱신은 계속 브라우저에서 수행합니다.
* 긴 guided run을 피하기 위해 호출 수는 제한됩니다.

이 기능은 현재 범위를 넘는 일반 목적 API나 모델 학습 파이프라인이 아닙니다. 로컬 Ollama가 실행 중이지 않거나 응답이 실패하면, UI는 오류를 보여주고 해당 실행은 기존 epsilon-greedy 경로로 되돌아갑니다.

## 테스트 명령

전체 테스트 스위트를 실행하려면 다음 명령을 사용합니다.

```bash
go test ./...
node --test web/app.test.js
```

현재 이 저장소의 테스트는 다음 위치에 있습니다.

* `internal/browser`
* `internal/cli`
* `internal/server`
* `test`

## 앱 동작 방식

런타임 흐름은 단순합니다.

1. `cmd/rewardlab/main.go`가 시그널 대응 컨텍스트를 생성합니다.
2. `internal/cli`가 `serve` 명령과 플래그를 파싱합니다.
3. `internal/server`가 HTTP 서버를 시작하고 `/healthz`, 웹 UI 라우트, 필요 시 실험적 Ollama 가이드 라우트를 노출합니다.
4. `web/assets.go`가 `index.html`, `styles.css`, `app.js`를 내장 자산으로 제공합니다.
5. `web/app.js`가 브라우저에서 epsilon-greedy 시뮬레이션을 수행하고, 사용자가 opt-in 하면 실험적 Ollama 가이드 경로를 호출하며, 레슨 UI를 렌더링합니다.

브라우저 경험은 `web/app.js`의 시드 기반 의사난수 생성기를 사용하므로 동일한 입력값에 대해 결정론적으로 동작합니다.

## 아키텍처 한눈에 보기

### CLI 계층

`internal/cli`는 명령 파싱과 시작 오케스트레이션을 담당합니다. 테스트에서 브라우저 실행과 서버 생성을 대체할 수 있도록 추상화에 의존합니다.

### 브라우저 오프너

`internal/browser`는 현재 운영체제에 맞는 기본 브라우저 실행 명령을 선택합니다.

* macOS: `open`
* Linux: `xdg-open`
* Windows: `rundll32 url.dll,FileProtocolHandler`

### HTTP 서버

`internal/server`는 서버 생성, 시작, 종료, 상태 확인, 라우트 등록을 담당합니다. 포트 `0` 또는 와일드카드 호스트로 리슨하더라도 브라우저에서 접근 가능한 정규화된 로컬 URL을 반환합니다. 실험적 Ollama 모드가 활성화되면 현재 lesson 전용의 좁은 로컬 가이드 라우트도 함께 노출합니다.

### 웹 에셋

`web` 패키지는 세 개의 파일을 내장하고 제공합니다.

* `index.html`은 레슨 레이아웃을 정의합니다.
* `styles.css`는 시각 스타일 시스템을 제공합니다.
* `app.js`는 제어 입력, 시뮬레이션, 실험적 Ollama opt-in 흐름, 요약 카드, 차트, 최근 선택 기록을 처리합니다.

### 시뮬레이션 모델

현재 레슨은 JavaScript로 k-armed bandit을 시뮬레이션합니다.

* 각 arm은 정규분포에서 샘플링한 숨겨진 true mean을 가집니다.
* 보상은 true mean에 정규 잡음을 더해 샘플링합니다.
* 정책은 `epsilon` 확률로 탐색합니다.
* 그 외에는 현재 추정값이 가장 높은 arm을 활용합니다.
* 추정값은 점진적 표본 평균으로 갱신합니다.

실험적 Ollama 가이드 모드에서는 arm 선택만 로컬 Ollama가 제안하고, 보상과 업데이트는 여전히 브라우저 JavaScript가 처리합니다.

UI는 요약 지표, arm별 true 값과 추정값 비교, 해석 카드, 최근 10회 선택 내역을 보여줍니다.

## 저장소 구조

```text
cmd/rewardlab/         CLI 진입점
internal/browser/      운영체제별 브라우저 열기
internal/cli/          명령 파싱과 앱 시작 처리
internal/server/       HTTP 서버와 라우팅
test/                  블랙박스 통합 테스트
web/                   내장 정적 레슨 에셋
docs/adr/              아키텍처 결정 문서
docs/changes/          변경 기록
AGENTS.md              AI 기여자를 위한 저장소 규칙
```

## 제약 사항

현재 코드베이스에는 몇 가지 중요한 경계가 있습니다.

* 앱은 로컬 우선입니다. 실험적 가이드 모드도 기본적으로 로컬 Ollama만 대상으로 합니다.
* 레슨은 기본적으로 브라우저 JavaScript에서 실행됩니다.
* 서버는 콘텐츠와 상태 확인을 제공하고, 실험적 가이드 모드가 켜졌을 때만 lesson 전용의 좁은 로컬 Ollama 가이드 라우트를 노출합니다.
* 현재 레슨은 하나이고 전략도 하나뿐입니다.
* 문서는 계획된 기능이 아니라 현재 동작을 설명해야 합니다.

## 워크플로 기대 사항

향후 작업에서도 저장소 운영을 엄격하게 유지해야 합니다.

* 모듈 경로와 제품 이름은 현재 값인 `github.com/bssm-oss/AIStudyWeb` 와 RewardLab을 유지합니다.
* 의미 있는 변경 이후에는 문서가 실제 코드와 계속 일치해야 합니다.
* 중요한 변경은 `docs/changes/` 아래에 새 Markdown 파일로 기록합니다.
* 아키텍처 결정이 바뀌면 ADR 집합도 함께 갱신합니다.
* README나 에이전트 가이드에 문서화되지 않은 기능을 지어내지 않습니다.

AI 및 자동화를 위한 저장소 규칙은 `AGENTS.md`를 참고하세요.

## 라이선스

RewardLab은 MIT License로 배포됩니다. 자세한 내용은 `LICENSE`를 참고하세요.
