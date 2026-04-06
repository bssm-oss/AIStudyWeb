package server

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const DefaultOllamaURL = "http://127.0.0.1:11434"

const ollamaGuidePrompt = `You are guiding a multi-armed bandit experiment.
Choose exactly one arm index to pull next.
Prefer balancing exploration of under-sampled promising arms with exploitation of strong current estimates.
Respond using only JSON matching the provided schema.`

type ollamaGuideHandler struct {
	client   *http.Client
	endpoint string
	model    string
}

type ollamaGuideRequest struct {
	Step       int                `json:"step"`
	TotalSteps int                `json:"totalSteps"`
	Arms       []ollamaGuideArm   `json:"arms"`
	History    []ollamaGuideEvent `json:"history,omitempty"`
}

type ollamaGuideArm struct {
	Index     int     `json:"index"`
	Pulls     int     `json:"pulls"`
	Estimate  float64 `json:"estimate"`
	RewardSum float64 `json:"rewardSum"`
}

type ollamaGuideEvent struct {
	Step      int     `json:"step"`
	ArmIndex  int     `json:"armIndex"`
	Reward    float64 `json:"reward"`
	Exploring bool    `json:"exploring"`
}

type ollamaGuideResponse struct {
	ArmIndex int    `json:"armIndex"`
	Reason   string `json:"reason,omitempty"`
}

type ollamaGenerateRequest struct {
	Model   string         `json:"model"`
	Prompt  string         `json:"prompt"`
	Format  map[string]any `json:"format,omitempty"`
	Stream  bool           `json:"stream"`
	Options map[string]any `json:"options,omitempty"`
}

type ollamaGenerateResponse struct {
	Response string `json:"response"`
	Done     bool   `json:"done"`
}

func newOllamaGuideHandler(cfg Config) http.Handler {
	endpoint := strings.TrimRight(cfg.OllamaURL, "/") + "/api/generate"
	return &ollamaGuideHandler{
		client:   &http.Client{Timeout: 30 * time.Second},
		endpoint: endpoint,
		model:    cfg.OllamaModel,
	}
}

func (h *ollamaGuideHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.Header().Set("Allow", http.MethodPost)
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}

	defer r.Body.Close()

	var req ollamaGuideRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid json request")
		return
	}

	if err := validateOllamaGuideRequest(req); err != nil {
		writeJSONError(w, http.StatusBadRequest, err.Error())
		return
	}

	choice, err := h.guide(r, req)
	if err != nil {
		writeJSONError(w, http.StatusBadGateway, err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	json.NewEncoder(w).Encode(choice)
}

func validateOllamaGuideRequest(req ollamaGuideRequest) error {
	if req.Step < 1 {
		return fmt.Errorf("step must be at least 1")
	}

	if req.TotalSteps < req.Step {
		return fmt.Errorf("totalSteps must be at least step")
	}

	if len(req.Arms) < 2 {
		return fmt.Errorf("at least 2 arms are required")
	}

	for index, arm := range req.Arms {
		if arm.Index != index {
			return fmt.Errorf("arm indices must be sequential and zero-based")
		}

		if arm.Pulls < 0 {
			return fmt.Errorf("arm pulls must be non-negative")
		}
	}

	return nil
}

func (h *ollamaGuideHandler) guide(r *http.Request, state ollamaGuideRequest) (ollamaGuideResponse, error) {
	promptPayload, err := json.MarshalIndent(state, "", "  ")
	if err != nil {
		return ollamaGuideResponse{}, fmt.Errorf("marshal guide payload: %w", err)
	}

	requestBody := ollamaGenerateRequest{
		Model:  h.model,
		Prompt: fmt.Sprintf("%s\n\nBandit state:\n%s", ollamaGuidePrompt, promptPayload),
		Format: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"armIndex": map[string]any{"type": "integer", "minimum": 0, "maximum": len(state.Arms) - 1},
				"reason":   map[string]any{"type": "string"},
			},
			"required": []string{"armIndex", "reason"},
		},
		Stream: false,
		Options: map[string]any{
			"temperature": 0,
		},
	}

	body, err := json.Marshal(requestBody)
	if err != nil {
		return ollamaGuideResponse{}, fmt.Errorf("marshal ollama request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(r.Context(), http.MethodPost, h.endpoint, bytes.NewReader(body))
	if err != nil {
		return ollamaGuideResponse{}, fmt.Errorf("build ollama request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := h.client.Do(httpReq)
	if err != nil {
		return ollamaGuideResponse{}, fmt.Errorf("call ollama: %w", err)
	}
	defer resp.Body.Close()

	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return ollamaGuideResponse{}, fmt.Errorf("read ollama response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return ollamaGuideResponse{}, fmt.Errorf("ollama returned %d: %s", resp.StatusCode, strings.TrimSpace(string(responseBody)))
	}

	var ollamaResp ollamaGenerateResponse
	if err := json.Unmarshal(responseBody, &ollamaResp); err != nil {
		return ollamaGuideResponse{}, fmt.Errorf("decode ollama envelope: %w", err)
	}

	var choice ollamaGuideResponse
	if err := json.Unmarshal([]byte(ollamaResp.Response), &choice); err != nil {
		return ollamaGuideResponse{}, fmt.Errorf("decode ollama choice: %w", err)
	}

	if choice.ArmIndex < 0 || choice.ArmIndex >= len(state.Arms) {
		return ollamaGuideResponse{}, fmt.Errorf("ollama chose invalid arm index %d", choice.ArmIndex)
	}

	return choice, nil
}

func writeJSONError(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": message})
}

func validateOllamaURL(rawURL string) error {
	if rawURL == "" {
		return fmt.Errorf("ollama url must not be empty")
	}

	parsed, err := url.Parse(rawURL)
	if err != nil {
		return fmt.Errorf("parse ollama url: %w", err)
	}

	if parsed.Scheme == "" || parsed.Host == "" {
		return fmt.Errorf("ollama url must include scheme and host")
	}

	if parsed.Scheme != "http" {
		return fmt.Errorf("ollama url must use http")
	}

	hostname := parsed.Hostname()
	if hostname != "localhost" {
		ip := net.ParseIP(hostname)
		if ip == nil || !ip.IsLoopback() {
			return fmt.Errorf("ollama url must use a local loopback host")
		}
	}

	return nil
}
