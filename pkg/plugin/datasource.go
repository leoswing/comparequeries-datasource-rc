package plugin

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

var _ backend.QueryDataHandler = (*Datasource)(nil)
var _ backend.CheckHealthHandler = (*Datasource)(nil)
var _ instancemgmt.Instance = (*Datasource)(nil)

type Datasource struct {
	settings   DatasourceSettings
	token      string
	logger     log.Logger
	httpClient *http.Client
}

func NewDatasource(_ context.Context, dis backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
	var settings DatasourceSettings
	if err := json.Unmarshal(dis.JSONData, &settings); err != nil {
		return nil, fmt.Errorf("unmarshal settings: %w", err)
	}

	token := dis.DecryptedSecureJSONData[keyServiceAccountToken]

	// Fallback: use the Grafana app URL if no explicit URL configured
	if settings.GrafanaURL == "" {
		settings.GrafanaURL = strings.TrimRight(dis.URL, "/")
	}

	httpClient, err := httpclient.NewProvider().New(httpclient.Options{
		Timeouts: &httpclient.TimeoutOptions{
			Timeout: 30 * time.Second,
		},
	})
	if err != nil {
		return nil, fmt.Errorf("create HTTP client: %w", err)
	}

	return &Datasource{
		settings:   settings,
		token:      token,
		logger:     log.DefaultLogger,
		httpClient: httpClient,
	}, nil
}

func (d *Datasource) Dispose() {}

// QueryData handles backend query requests, used by Grafana Alerting.
// For each query, it proxies to the target datasource with time-shifted ranges
// and applies alias/process transformations to the results.
func (d *Datasource) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	response := backend.NewQueryDataResponse()

	grafanaURL := d.resolveGrafanaURL(req.PluginContext)
	client := NewGrafanaClient(grafanaURL, d.token, d.httpClient)

	for _, q := range req.Queries {
		res := d.handleQuery(ctx, client, q)
		response.Responses[q.RefID] = res
	}

	return response, nil
}

func (d *Datasource) resolveGrafanaURL(pCtx backend.PluginContext) string {
	if d.settings.GrafanaURL != "" {
		return strings.TrimRight(d.settings.GrafanaURL, "/")
	}
	if pCtx.GrafanaConfig != nil {
		if appURL, err := pCtx.GrafanaConfig.AppURL(); err == nil && appURL != "" {
			return strings.TrimRight(appURL, "/")
		}
	}
	return "http://localhost:3000"
}

func (d *Datasource) handleQuery(ctx context.Context, client *GrafanaClient, q backend.DataQuery) backend.DataResponse {
	var qm QueryModel
	if err := json.Unmarshal(q.JSON, &qm); err != nil {
		return backend.ErrDataResponse(backend.StatusBadRequest, fmt.Sprintf("unmarshal query: %v", err))
	}

	if qm.DatasourceUid == "" {
		return backend.ErrDataResponse(backend.StatusBadRequest,
			"datasourceUid is required for backend queries (alerting). "+
				"Please configure the target datasource in the query editor.")
	}

	if len(qm.TimeShifts) == 0 {
		return backend.ErrDataResponse(backend.StatusBadRequest, "at least one time shift is required")
	}

	// Treat targetQueryJSON as an opaque target-datasource payload. CompareQueries cannot
	// distinguish unresolved dashboard variables from datasource-specific macros, so the
	// target datasource remains responsible for interpolation and validation.
	var allFrames data.Frames

	for _, ts := range qm.TimeShifts {
		// Empty value means "no time shift" — query the current time window as-is.
		// Skipping would leave allFrames nil and cause the alerting expr engine to
		// report responseType=error even when the plugin returns status=ok.
		frames, err := d.executeShiftedQuery(ctx, client, q, qm, ts)
		if err != nil {
			d.logger.Error("Failed to execute shifted query",
				"timeShift", ts.Value, "error", err)
			return backend.ErrDataResponse(backend.StatusInternal,
				fmt.Sprintf("shifted query (shift=%s): %v", ts.Value, err))
		}

		allFrames = append(allFrames, frames...)
	}

	if len(allFrames) == 0 {
		return backend.ErrDataResponse(backend.StatusBadRequest,
			"no data returned from target datasource — check Target Datasource UID and Target Query JSON")
	}

	return backend.DataResponse{Frames: allFrames}
}

func (d *Datasource) executeShiftedQuery(
	ctx context.Context,
	client *GrafanaClient,
	q backend.DataQuery,
	qm QueryModel,
	ts TimeShift,
) ([]*data.Frame, error) {
	var queryFrom, queryTo = q.TimeRange.From, q.TimeRange.To

	if ts.Value != "" {
		shiftedFrom, shiftedTo, err := ShiftTimeRange(q.TimeRange.From, q.TimeRange.To, ts.Value)
		if err != nil {
			return nil, fmt.Errorf("parse time shift %q: %w", ts.Value, err)
		}
		queryFrom, queryTo = shiftedFrom, shiftedTo
	}

	d.logger.Debug("Executing shifted query",
		"datasourceUid", qm.DatasourceUid,
		"shift", ts.Value,
		"originalFrom", q.TimeRange.From,
		"originalTo", q.TimeRange.To,
		"queryFrom", queryFrom,
		"queryTo", queryTo,
	)

	frames, err := client.QueryDatasource(
		ctx,
		qm.DatasourceUid,
		qm.TargetQueryJSON,
		queryFrom,
		queryTo,
		q.Interval.Milliseconds(),
		q.MaxDataPoints,
	)
	if err != nil {
		return nil, err
	}

	for _, frame := range frames {
		d.filterFrameByRange(frame, queryFrom, queryTo)
	}

	alias := ts.Alias
	if alias == "" {
		alias = ts.Value
	}
	aliasType := ts.AliasType
	if aliasType == "" {
		aliasType = "suffix"
	}
	delimiter := ts.Delimiter
	if delimiter == "" {
		delimiter = "_"
	}

	for _, frame := range frames {
		d.applyAlias(frame, alias, aliasType, delimiter)

		if qm.Process && ts.Value != "" {
			if err := d.shiftTimestampsBack(frame, ts.Value); err != nil {
				d.logger.Warn("Failed to shift timestamps back", "error", err)
			}
		}
	}

	return frames, nil
}

func (d *Datasource) filterFrameByRange(frame *data.Frame, from, to time.Time) {
	if frame == nil {
		return
	}

	fromMs := from.UnixMilli()
	toMs := to.UnixMilli()
	if toMs < fromMs {
		return
	}

	timeIdx := -1
	for i, field := range frame.Fields {
		if field == nil {
			continue
		}
		if field.Type() == data.FieldTypeTime || field.Type() == data.FieldTypeNullableTime {
			timeIdx = i
			break
		}
	}
	if timeIdx < 0 {
		return
	}

	rowLen, err := frame.RowLen()
	if err != nil {
		d.logger.Warn("Failed to get frame row length for range filtering", "error", err)
		return
	}

	for i := rowLen - 1; i >= 0; i-- {
		v := frame.At(timeIdx, i)
		if v == nil {
			frame.DeleteRow(i)
			continue
		}

		var ts time.Time
		switch t := v.(type) {
		case time.Time:
			ts = t
		case *time.Time:
			if t == nil {
				frame.DeleteRow(i)
				continue
			}
			ts = *t
		default:
			frame.DeleteRow(i)
			continue
		}

		ms := ts.UnixMilli()
		if ms < fromMs || ms > toMs {
			frame.DeleteRow(i)
		}
	}
}

// applyAlias aliases field-level names while keeping frame.Name unchanged.
// DisplayNameFromDS prevents Grafana from appending frame and timeshift labels again.
// The "timeshift" label lets Grafana Alerting distinguish series during union.
func (d *Datasource) applyAlias(frame *data.Frame, alias, aliasType, delimiter string) {
	singleField := singleSeriesField(frame)

	for _, field := range frame.Fields {
		if field.Type() == data.FieldTypeTime || field.Type() == data.FieldTypeNullableTime {
			continue
		}

		field.Name = generalAlias(field.Name, alias, aliasType, delimiter)

		if field.Config == nil {
			field.Config = &data.FieldConfig{}
		}
		if field.Config.DisplayName != "" {
			field.Config.DisplayName = generalAlias(field.Config.DisplayName, alias, aliasType, delimiter)
		}
		if field.Config.DisplayNameFromDS != "" {
			field.Config.DisplayNameFromDS = generalAlias(field.Config.DisplayNameFromDS, alias, aliasType, delimiter)
		} else if field == singleField && frame.Name != "" {
			field.Config.DisplayNameFromDS = generalAlias(frame.Name, alias, aliasType, delimiter)
		} else {
			field.Config.DisplayNameFromDS = field.Name
		}

		// Inject timeshift label so Grafana Alerting union can distinguish series from
		// different time shifts. Without this all frames have empty labels {} and get dropped.
		if field.Labels == nil {
			field.Labels = data.Labels{}
		}
		field.Labels["timeshift"] = alias
	}
}

func singleSeriesField(frame *data.Frame) *data.Field {
	var result *data.Field
	for _, field := range frame.Fields {
		if field.Type() == data.FieldTypeTime || field.Type() == data.FieldTypeNullableTime {
			continue
		}
		if result != nil {
			return nil
		}
		result = field
	}
	return result
}

func generalAlias(original, alias, aliasType, delimiter string) string {
	switch aliasType {
	case "prefix":
		return alias + delimiter + original
	case "absolute":
		return alias
	case "suffix":
		return original + delimiter + alias
	default:
		return original + delimiter + alias
	}
}

// shiftTimestampsBack offsets the time field values forward by the shift amount,
// so that the shifted data aligns with the current time range on the graph.
// This mirrors the frontend's "process" toggle behavior.
func (d *Datasource) shiftTimestampsBack(frame *data.Frame, shiftValue string) error {
	shiftMs, err := ShiftToMs(shiftValue)
	if err != nil {
		return err
	}
	shiftDuration := time.Duration(shiftMs) * time.Millisecond

	for _, field := range frame.Fields {
		switch field.Type() {
		case data.FieldTypeTime:
			for i := 0; i < field.Len(); i++ {
				t := field.At(i).(time.Time)
				field.Set(i, t.Add(shiftDuration))
			}
		case data.FieldTypeNullableTime:
			for i := 0; i < field.Len(); i++ {
				v := field.At(i).(*time.Time)
				if v != nil {
					shifted := v.Add(shiftDuration)
					field.Set(i, &shifted)
				}
			}
		}
	}

	return nil
}

// CheckHealth validates the datasource configuration.
func (d *Datasource) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	grafanaURL := d.resolveGrafanaURL(req.PluginContext)

	if grafanaURL == "" || grafanaURL == "http://localhost:3000" {
		if d.settings.GrafanaURL == "" {
			return &backend.CheckHealthResult{
				Status:  backend.HealthStatusOk,
				Message: "CompareQueries plugin is loaded. Note: Grafana URL is not configured — alerting features will use localhost:3000 as default.",
			}, nil
		}
	}

	if d.token == "" {
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusOk,
			Message: fmt.Sprintf("CompareQueries plugin is loaded (Grafana: %s). Warning: no service account token configured — alerting proxy queries may fail with 401.", grafanaURL),
		}, nil
	}

	client := NewGrafanaClient(grafanaURL, d.token, d.httpClient)
	healthURL := grafanaURL + "/api/health"
	healthReq, err := http.NewRequestWithContext(ctx, http.MethodGet, healthURL, nil)
	if err != nil {
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusError,
			Message: fmt.Sprintf("Cannot create Grafana health request for %s: %v", grafanaURL, err),
		}, nil
	}
	if client.token != "" {
		healthReq.Header.Set("Authorization", "Bearer "+client.token)
	}

	resp, err := client.httpClient.Do(healthReq)
	if err != nil {
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusError,
			Message: fmt.Sprintf("Cannot reach Grafana at %s: %v", grafanaURL, err),
		}, nil
	}
	defer resp.Body.Close()

	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusError,
			Message: fmt.Sprintf("Grafana health check at %s returned status %d.", grafanaURL, resp.StatusCode),
		}, nil
	}

	return &backend.CheckHealthResult{
		Status:  backend.HealthStatusOk,
		Message: fmt.Sprintf("CompareQueries plugin is working. Grafana API reachable at %s.", grafanaURL),
	}, nil
}
