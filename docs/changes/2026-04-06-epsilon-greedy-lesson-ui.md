# Epsilon-greedy 레슨 UI

## 상태

스냅샷

## 요약

이 기록은 RewardLab이 현재 제공하는 브라우저 레슨을 담고 있습니다.

## 변경 내용

* 레슨 UI를 위한 내장 정적 에셋을 추가했습니다.
* epsilon-greedy 다중 슬롯머신 밴딧에 집중한 단일 레슨을 추가했습니다.
* 시드 기반 의사난수 생성을 사용하는 브라우저 측 시뮬레이션을 추가했습니다.
* arms, epsilon, steps, seed 제어 입력을 추가했습니다.
* 보상, 최적 arm 선택 비율, 탐색 비율, arm 추정값, 최근 선택 기록에 대한 시각 요약을 추가했습니다.

## 근거

* `web/assets.go`
* `web/index.html`
* `web/styles.css`
* `web/app.js`
* `test/serve_integration_test.go`
* `internal/server/server_test.go`

## 참고

현재 시뮬레이션은 전부 `web/app.js`에서 실행됩니다. Go 서버는 페이지와 에셋만 제공합니다.
