package web

import (
	"bytes"
	"embed"
	"encoding/json"
	"io/fs"
	"net/http"
	"strings"
	"time"
)

//go:embed index.html styles.css app.js
var embeddedAssets embed.FS

var indexHTML = mustReadFile("index.html")

type RuntimeConfig struct {
	ExperimentalOllamaEnabled bool   `json:"experimentalOllamaEnabled"`
	OllamaModel               string `json:"ollamaModel,omitempty"`
}

// RegisterRoutes wires the current RewardLab lesson page and static assets into the provided ServeMux.
func RegisterRoutes(mux *http.ServeMux, config RuntimeConfig) {
	mux.HandleFunc("/", serveIndex(config))
	mux.HandleFunc("/favicon.ico", serveFavicon)
	mux.Handle("/assets/", http.StripPrefix("/assets/", cacheStatic(http.FileServer(http.FS(assetFS())))))
}

func serveIndex(config RuntimeConfig) http.HandlerFunc {
	page := withRuntimeConfig(indexHTML, config)

	return func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" {
			http.NotFound(w, r)
			return
		}

		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			w.Header().Set("Allow", "GET, HEAD")
			http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
			return
		}

		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		http.ServeContent(w, r, "index.html", time.Time{}, bytes.NewReader(page))
	}
}

func assetFS() fs.FS {
	return embeddedAssets
}

func mustReadFile(name string) []byte {
	content, err := embeddedAssets.ReadFile(name)
	if err != nil {
		panic(err)
	}

	return content
}

func withRuntimeConfig(page []byte, config RuntimeConfig) []byte {
	payload, err := json.Marshal(config)
	if err != nil {
		panic(err)
	}

	safePayload := strings.ReplaceAll(string(payload), "</", "<\\/")
	script := `<script>window.rewardLabConfig = ` + safePayload + `;</script>`
	return []byte(strings.Replace(string(page), "</body>", script+"</body>", 1))
}

func cacheStatic(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "public, max-age=3600")
		next.ServeHTTP(w, r)
	})
}

func serveFavicon(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		w.Header().Set("Allow", "GET, HEAD")
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
