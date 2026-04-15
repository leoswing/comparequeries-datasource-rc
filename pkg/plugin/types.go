package plugin

import "encoding/json"

// DatasourceSettings holds the configuration for the CompareQueries datasource instance.
// These are set in the ConfigEditor and persisted by Grafana.
type DatasourceSettings struct {
	GrafanaURL string `json:"grafanaUrl"`
}

// SecureSettings keys used in DecryptedSecureJSONData.
const (
	keyServiceAccountToken = "serviceAccountToken"
)

// QueryModel represents the frontend query model sent to the backend.
// It supports two modes:
//   - Dashboard panel mode: uses "query" (refId reference) — handled by frontend only
//   - Alerting/backend mode: uses "datasourceUid" + "targetQueryJSON" — handled by backend
type QueryModel struct {
	// Frontend panel flow (refId-based, not used by backend)
	Query string `json:"query"`

	// Backend/alerting flow
	DatasourceUid   string          `json:"datasourceUid"`
	DatasourceType  string          `json:"datasourceType"`
	TargetQueryJSON json.RawMessage `json:"targetQueryJSON"`

	TimeShifts []TimeShift `json:"timeShifts"`
	Process    bool        `json:"process"`
}

// TimeShift defines a single time-shift entry with alias configuration.
type TimeShift struct {
	ID        int    `json:"id"`
	Value     string `json:"value"`
	Alias     string `json:"alias"`
	AliasType string `json:"aliasType"`
	Delimiter string `json:"delimiter"`
}

// DSQueryRequest is the request body for Grafana's POST /api/ds/query.
type DSQueryRequest struct {
	Queries []json.RawMessage `json:"queries"`
	From    string            `json:"from"`
	To      string            `json:"to"`
}

// DSQueryResponse is the response from Grafana's POST /api/ds/query.
type DSQueryResponse struct {
	Results map[string]DSQueryResult `json:"results"`
}

// DSQueryResult holds the result for a single refId from /api/ds/query.
type DSQueryResult struct {
	Status int               `json:"status"`
	Frames []json.RawMessage `json:"frames"`
	Error  string            `json:"error"`
}
