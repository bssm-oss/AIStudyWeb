# CLI와 서버 기준선

## 상태

스냅샷

## 요약

이 기록은 로컬 시작과 HTTP 제공을 위한 현재 RewardLab 기준선을 담고 있습니다.

## 변경 내용

* `cmd/rewardlab/main.go`에 Go CLI 진입점을 추가했습니다.
* `internal/cli`에 `rewardlab serve` 명령 처리를 추가했습니다.
* `--host`, `--port`, `--open`을 사용하는 설정 가능한 로컬 서버 시작 기능을 추가했습니다.
* 컨텍스트 취소와 시그널 기반 우아한 종료 동작을 추가했습니다.
* `internal/server`에 `/healthz` 엔드포인트를 추가했습니다.
* `internal/browser`에 운영체제별 브라우저 열기 기능을 추가했습니다.

## 근거

* `cmd/rewardlab/main.go`
* `internal/cli/cli.go`
* `internal/browser/browser.go`
* `internal/server/server.go`
* `internal/cli/cli_test.go`
* `internal/browser/browser_test.go`
* `internal/server/server_test.go`

## 참고

이 런타임은 로컬 전용입니다. 현재 서버는 시뮬레이션 API나 영속 저장 기능을 노출하지 않습니다.
