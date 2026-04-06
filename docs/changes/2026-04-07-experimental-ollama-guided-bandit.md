# 실험적 Ollama 가이드 밴딧 모드

## 상태

스냅샷

## 요약

RewardLab의 현재 epsilon-greedy lesson에 선택적으로 활성화할 수 있는 실험적 로컬 Ollama 가이드 모드를 추가했습니다.

## 변경 내용

* `rewardlab serve`에 실험적 Ollama 가이드를 켜는 CLI 플래그를 추가했습니다.
* 현재 lesson 전용 `POST /experimental/ollama/guide` 브리지를 추가했습니다.
* 브라우저 UI에 명시적 opt-in 토글과 상태 메시지를 추가했습니다.
* guided run에서 arm 선택은 로컬 Ollama가 제안하고, 보상 계산과 추정값 갱신은 계속 브라우저가 수행하도록 유지했습니다.
* README, AGENTS, ADR 문서를 현재 구현에 맞게 갱신했습니다.

## 근거

* `internal/cli/cli.go`
* `internal/server/server.go`
* `internal/server/ollama.go`
* `web/assets.go`
* `web/index.html`
* `web/styles.css`
* `web/app.js`
* `internal/cli/cli_test.go`
* `internal/server/server_test.go`
* `internal/server/ollama_test.go`
* `test/serve_integration_test.go`
* `web/app.test.js`
* `README.md`
* `AGENTS.md`
* `docs/adr/0002-experimental-ollama-bridge.md`
* `go test ./...`
* `go build ./cmd/rewardlab`
* `node --test web/app.test.js`

## 참고

이 기능은 기본 lesson을 대체하지 않습니다. 현재 구현은 로컬 Ollama를 이용한 선택 정책 실험만 제공하며, 모델 학습·파인튜닝·영속 저장·일반 목적 API는 포함하지 않습니다.
