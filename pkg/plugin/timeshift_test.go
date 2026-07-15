package plugin

import (
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

func TestParseTimeShift(t *testing.T) {
	tests := []struct {
		input   string
		wantErr bool
	}{
		{"1s", false},
		{"30m", false},
		{"1h", false},
		{"7d", false},
		{"2w", false},
		{"1M", false},
		{"1y", false},
		{"abc", true},
		{"", true},
		{"1x", true},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			_, err := ParseTimeShift(tt.input)
			if (err != nil) != tt.wantErr {
				t.Errorf("ParseTimeShift(%q) error = %v, wantErr %v", tt.input, err, tt.wantErr)
			}
		})
	}
}

func TestParseTimeShiftValues(t *testing.T) {
	d, err := ParseTimeShift("1h")
	if err != nil {
		t.Fatal(err)
	}
	if d != -time.Hour {
		t.Errorf("expected -1h, got %v", d)
	}

	d, err = ParseTimeShift("7d")
	if err != nil {
		t.Fatal(err)
	}
	if d != -7*24*time.Hour {
		t.Errorf("expected -168h, got %v", d)
	}
}

func TestShiftTimeRange(t *testing.T) {
	now := time.Now()
	from := now.Add(-time.Hour)
	to := now

	shiftedFrom, shiftedTo, err := ShiftTimeRange(from, to, "1d")
	if err != nil {
		t.Fatal(err)
	}

	expectedFrom := from.Add(-24 * time.Hour)
	expectedTo := to.Add(-24 * time.Hour)

	if !shiftedFrom.Equal(expectedFrom) {
		t.Errorf("shiftedFrom: expected %v, got %v", expectedFrom, shiftedFrom)
	}
	if !shiftedTo.Equal(expectedTo) {
		t.Errorf("shiftedTo: expected %v, got %v", expectedTo, shiftedTo)
	}
}

func TestShiftTimeRangeMonth(t *testing.T) {
	from := time.Date(2026, 3, 15, 10, 0, 0, 0, time.UTC)
	to := time.Date(2026, 3, 15, 11, 0, 0, 0, time.UTC)

	shiftedFrom, shiftedTo, err := ShiftTimeRange(from, to, "1M")
	if err != nil {
		t.Fatal(err)
	}

	if shiftedFrom.Month() != time.February || shiftedFrom.Day() != 15 {
		t.Errorf("expected Feb 15, got %v", shiftedFrom)
	}
	if shiftedTo.Month() != time.February || shiftedTo.Day() != 15 {
		t.Errorf("expected Feb 15, got %v", shiftedTo)
	}
}

func TestShiftToMs(t *testing.T) {
	ms, err := ShiftToMs("1d")
	if err != nil {
		t.Fatal(err)
	}
	expected := int64(24 * 60 * 60 * 1000)
	if ms != expected {
		t.Errorf("expected %d, got %d", expected, ms)
	}
}

func TestGeneralAlias(t *testing.T) {
	tests := []struct {
		original  string
		alias     string
		aliasType string
		delimiter string
		expected  string
	}{
		{"cpu", "1d", "suffix", "_", "cpu_1d"},
		{"cpu", "1d", "prefix", "_", "1d_cpu"},
		{"cpu", "yesterday", "absolute", "_", "yesterday"},
		{"cpu", "1d", "suffix", "-", "cpu-1d"},
	}

	for _, tt := range tests {
		result := generalAlias(tt.original, tt.alias, tt.aliasType, tt.delimiter)
		if result != tt.expected {
			t.Errorf("generalAlias(%q, %q, %q, %q) = %q, want %q",
				tt.original, tt.alias, tt.aliasType, tt.delimiter, result, tt.expected)
		}
	}
}

func TestApplyAliasKeepsFrameNameSeparateFromFieldName(t *testing.T) {
	frame := data.NewFrame(
		"test",
		data.NewField("Time", nil, []time.Time{time.Now()}),
		data.NewField("Value", nil, []float64{1}),
	)

	(&Datasource{}).applyAlias(frame, "3d", "suffix", "test_de")

	if frame.Name != "test" {
		t.Errorf("frame name = %q, want %q", frame.Name, "test")
	}
	if frame.Fields[0].Name != "Time" {
		t.Errorf("time field name = %q, want %q", frame.Fields[0].Name, "Time")
	}
	if frame.Fields[1].Name != "Valuetest_de3d" {
		t.Errorf("value field name = %q, want %q", frame.Fields[1].Name, "Valuetest_de3d")
	}
	if got := frame.Fields[1].Config.DisplayNameFromDS; got != "testtest_de3d" {
		t.Errorf("display name from datasource = %q, want %q", got, "testtest_de3d")
	}
	if got := frame.Fields[1].Labels["timeshift"]; got != "3d" {
		t.Errorf("timeshift label = %q, want %q", got, "3d")
	}
}

func TestApplyAliasKeepsWideFrameDisplayNamesDistinct(t *testing.T) {
	frame := data.NewFrame(
		"orders",
		data.NewField("Time", nil, []time.Time{time.Now()}),
		data.NewField("success", nil, []float64{1}),
		data.NewField("failure", nil, []float64{2}),
	)
	(&Datasource{}).applyAlias(frame, "1d", "suffix", "_")

	if got := frame.Fields[1].Name; got != "success_1d" {
		t.Errorf("success field name = %q, want %q", got, "success_1d")
	}
	if got := frame.Fields[2].Name; got != "failure_1d" {
		t.Errorf("failure field name = %q, want %q", got, "failure_1d")
	}
	if got := frame.Fields[1].Config.DisplayNameFromDS; got != "success_1d" {
		t.Errorf("success display name from datasource = %q, want %q", got, "success_1d")
	}
	if got := frame.Fields[2].Config.DisplayNameFromDS; got != "failure_1d" {
		t.Errorf("failure display name from datasource = %q, want %q", got, "failure_1d")
	}
}

func TestApplyAliasKeepsMixedFrameDisplayNamesDistinct(t *testing.T) {
	frame := data.NewFrame(
		"orders",
		data.NewField("Time", nil, []time.Time{time.Now()}),
		data.NewField("status", nil, []string{"success"}),
		data.NewField("count", nil, []float64{1}),
	)

	(&Datasource{}).applyAlias(frame, "1d", "suffix", "_")

	if got := frame.Fields[1].Config.DisplayNameFromDS; got != "status_1d" {
		t.Errorf("dimension display name from datasource = %q, want %q", got, "status_1d")
	}
	if got := frame.Fields[2].Config.DisplayNameFromDS; got != "count_1d" {
		t.Errorf("value display name from datasource = %q, want %q", got, "count_1d")
	}
}
