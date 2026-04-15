package plugin

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// GrafanaClient proxies queries to the Grafana /api/ds/query endpoint.
type GrafanaClient struct {
	httpClient *http.Client
	baseURL    string
	token      string
	logger     log.Logger
}

// NewGrafanaClient creates a GrafanaClient using the provided shared http.Client.
// Sharing the http.Client across requests reuses the underlying connection pool.
func NewGrafanaClient(baseURL, token string, httpClient *http.Client) *GrafanaClient {
	return &GrafanaClient{
		httpClient: httpClient,
		baseURL:    baseURL,
		token:      token,
		logger:     log.DefaultLogger,
	}
}

// QueryDatasource executes a query against a target datasource via Grafana's /api/ds/query.
// It returns the parsed data frames from the response.
// dsType is optional: Grafana resolves the plugin type from dsUID automatically.
func (c *GrafanaClient) QueryDatasource(
	ctx context.Context,
	dsUID string,
	targetQueryJSON json.RawMessage,
	from, to time.Time,
	intervalMs int64,
	maxDataPoints int64,
) ([]*data.Frame, error) {
	refID := "A"

	query := map[string]interface{}{}
	if len(targetQueryJSON) > 0 {
		if err := json.Unmarshal(targetQueryJSON, &query); err != nil {
			return nil, fmt.Errorf("unmarshal targetQueryJSON: %w", err)
		}
	}

	query["refId"] = refID
	query["datasource"] = map[string]string{"uid": dsUID}
	if intervalMs > 0 {
		query["intervalMs"] = intervalMs
	}
	if maxDataPoints > 0 {
		query["maxDataPoints"] = maxDataPoints
	}

	queryBytes, err := json.Marshal(query)
	if err != nil {
		return nil, fmt.Errorf("marshal query: %w", err)
	}

	reqBody := DSQueryRequest{
		Queries: []json.RawMessage{queryBytes},
		From:    strconv.FormatInt(from.UnixMilli(), 10),
		To:      strconv.FormatInt(to.UnixMilli(), 10),
	}

	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("marshal request body: %w", err)
	}

	url := fmt.Sprintf("%s/api/ds/query", c.baseURL)
	c.logger.Debug("Proxying query to Grafana", "url", url, "dsUID", dsUID, "from", from, "to", to)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if c.token != "" {
		req.Header.Set("Authorization", "Bearer "+c.token)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("execute request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("grafana API returned status %d: %s", resp.StatusCode, string(respBody))
	}

	return c.parseFramesFromResponse(respBody, refID)
}

// parseFramesFromResponse extracts data.Frame objects from the /api/ds/query JSON response.
func (c *GrafanaClient) parseFramesFromResponse(body []byte, refID string) ([]*data.Frame, error) {
	var dsResp DSQueryResponse
	if err := json.Unmarshal(body, &dsResp); err != nil {
		return nil, fmt.Errorf("unmarshal response: %w", err)
	}

	result, ok := dsResp.Results[refID]
	if !ok {
		return nil, fmt.Errorf("no result found for refId %s", refID)
	}
	if result.Error != "" {
		return nil, fmt.Errorf("query error: %s", result.Error)
	}

	var frames []*data.Frame
	for i, raw := range result.Frames {
		frame := &data.Frame{}
		if err := json.Unmarshal(raw, frame); err != nil {
			c.logger.Warn("Failed to unmarshal frame, trying fallback", "index", i, "error", err)
			parsedFrame, fallbackErr := parseFrameManual(raw, c.logger)
			if fallbackErr != nil {
				return nil, fmt.Errorf("unmarshal frame %d: %w (fallback: %v)", i, err, fallbackErr)
			}
			frame = parsedFrame
		}
		frames = append(frames, frame)
	}

	return frames, nil
}

// parseFrameManual is a fallback parser for frames that the SDK can't unmarshal directly.
func parseFrameManual(raw json.RawMessage, logger log.Logger) (*data.Frame, error) {
	var wrapper struct {
		Schema struct {
			Name   string `json:"name"`
			Fields []struct {
				Name     string            `json:"name"`
				Type     string            `json:"type"`
				Labels   map[string]string `json:"labels"`
				Config   json.RawMessage   `json:"config"`
				TypeInfo json.RawMessage   `json:"typeInfo"`
			} `json:"fields"`
		} `json:"schema"`
		Data struct {
			Values []json.RawMessage `json:"values"`
		} `json:"data"`
	}

	if err := json.Unmarshal(raw, &wrapper); err != nil {
		return nil, fmt.Errorf("parse frame wrapper: %w", err)
	}

	frame := data.NewFrame(wrapper.Schema.Name)

	for i, fieldDef := range wrapper.Schema.Fields {
		if i >= len(wrapper.Data.Values) {
			break
		}

		switch fieldDef.Type {
		case "time":
			var timestamps []float64
			if err := json.Unmarshal(wrapper.Data.Values[i], &timestamps); err != nil {
				return nil, fmt.Errorf("parse time values: %w", err)
			}
			times := make([]time.Time, len(timestamps))
			for j, ts := range timestamps {
				times[j] = time.UnixMilli(int64(ts))
			}
			field := data.NewField(fieldDef.Name, fieldDef.Labels, times)
			frame.Fields = append(frame.Fields, field)

		case "number":
			values, err := parseNullableSlice[float64](wrapper.Data.Values[i])
			if err != nil {
				return nil, fmt.Errorf("parse number values: %w", err)
			}
			field := data.NewField(fieldDef.Name, fieldDef.Labels, values)
			applyFieldConfig(field, fieldDef.Config)
			frame.Fields = append(frame.Fields, field)

		case "string":
			values, err := parseNullableSlice[string](wrapper.Data.Values[i])
			if err != nil {
				return nil, fmt.Errorf("parse string values: %w", err)
			}
			field := data.NewField(fieldDef.Name, fieldDef.Labels, values)
			applyFieldConfig(field, fieldDef.Config)
			frame.Fields = append(frame.Fields, field)

		default:
			logger.Warn("Unknown frame field type, skipping field",
				"fieldName", fieldDef.Name, "fieldType", fieldDef.Type)
		}
	}

	return frame, nil
}

// parseNullableSlice deserialises a JSON array into a []*T slice.
// It first tries nullable form ([]*T); if that fails it falls back to plain []T
// and converts to pointers, matching Grafana's data frame wire format.
func parseNullableSlice[T any](raw json.RawMessage) ([]*T, error) {
	var nullable []*T
	if err := json.Unmarshal(raw, &nullable); err == nil {
		return nullable, nil
	}
	var plain []T
	if err := json.Unmarshal(raw, &plain); err != nil {
		return nil, err
	}
	result := make([]*T, len(plain))
	for i := range plain {
		v := plain[i]
		result[i] = &v
	}
	return result, nil
}

func applyFieldConfig(field *data.Field, configRaw json.RawMessage) {
	if len(configRaw) == 0 {
		return
	}
	var cfg struct {
		DisplayName       string `json:"displayName"`
		DisplayNameFromDS string `json:"displayNameFromDS"`
	}
	if err := json.Unmarshal(configRaw, &cfg); err != nil {
		return
	}
	if field.Config == nil {
		field.Config = &data.FieldConfig{}
	}
	if cfg.DisplayName != "" {
		field.Config.DisplayName = cfg.DisplayName
	}
	if cfg.DisplayNameFromDS != "" {
		field.Config.DisplayNameFromDS = cfg.DisplayNameFromDS
	}
}
