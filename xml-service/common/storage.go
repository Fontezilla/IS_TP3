package common

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

var httpClient = &http.Client{
	Timeout: 30 * time.Second,
}

func UploadToSupabase(path string, fileContent io.Reader, contentType string) error {
	supabaseURL := os.Getenv("SUPABASE_URL")
	supabaseKey := os.Getenv("SUPABASE_KEY")
	supabaseBucket := os.Getenv("SUPABASE_BUCKET")

	if supabaseURL == "" || supabaseKey == "" || supabaseBucket == "" {
		return fmt.Errorf("variaveis SUPABASE_URL, SUPABASE_KEY ou SUPABASE_BUCKET nao definidas")
	}

	url := fmt.Sprintf("%s/storage/v1/object/%s/%s", supabaseURL, supabaseBucket, path)

	req, err := http.NewRequest("POST", url, fileContent)
	if err != nil {
		return fmt.Errorf("erro criar request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+supabaseKey)
	req.Header.Set("Content-Type", contentType)

	resp, err := httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("erro network: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("erro Supabase (%d): %s", resp.StatusCode, string(body))
	}

	return nil
}

func DownloadFile(path string) ([]byte, error) {
	supabaseURL := os.Getenv("SUPABASE_URL")
	supabaseKey := os.Getenv("SUPABASE_KEY")
	supabaseBucket := os.Getenv("SUPABASE_BUCKET")

	if supabaseURL == "" || supabaseKey == "" || supabaseBucket == "" {
		return nil, fmt.Errorf("variaveis SUPABASE_URL, SUPABASE_KEY ou SUPABASE_BUCKET nao definidas")
	}

	url := fmt.Sprintf("%s/storage/v1/object/%s/%s", supabaseURL, supabaseBucket, path)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("erro criar request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+supabaseKey)

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("erro network: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("erro download (%d): %s", resp.StatusCode, string(body))
	}

	return io.ReadAll(resp.Body)
}

func DeleteJobFiles(jobID string) error {
	supabaseURL := os.Getenv("SUPABASE_URL")
	supabaseKey := os.Getenv("SUPABASE_KEY")
	supabaseBucket := os.Getenv("SUPABASE_BUCKET")

	if supabaseURL == "" || supabaseKey == "" || supabaseBucket == "" {
		return fmt.Errorf("variaveis SUPABASE nao definidas")
	}

	files := []string{
		jobID + "/data.csv",
		jobID + "/mapper.json",
		jobID + "/schema.xsd",
		jobID + "/result.xml",
	}

	url := fmt.Sprintf("%s/storage/v1/object/%s", supabaseURL, supabaseBucket)

	body, _ := json.Marshal(map[string][]string{"prefixes": files})

	req, err := http.NewRequest("DELETE", url, bytes.NewBuffer(body))
	if err != nil {
		return fmt.Errorf("erro criar request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+supabaseKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("erro network: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		return nil
	}

	respBody, _ := io.ReadAll(resp.Body)
	return fmt.Errorf("erro delete (%d): %s", resp.StatusCode, string(respBody))
}
