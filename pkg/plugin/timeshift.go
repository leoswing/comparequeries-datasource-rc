package plugin

import (
	"fmt"
	"regexp"
	"strconv"
	"time"
)

var timeshiftReg = regexp.MustCompile(`^(\d+)(s|m|h|d|w|M|y)$`)

// ParseTimeShift parses a time shift string like "1d", "7d", "2w", "1M"
// and returns the shifted-back duration as a negative offset.
func ParseTimeShift(shift string) (time.Duration, error) {
	matches := timeshiftReg.FindStringSubmatch(shift)
	if matches == nil {
		return 0, fmt.Errorf("invalid time shift format: %s", shift)
	}

	num, err := strconv.Atoi(matches[1])
	if err != nil {
		return 0, fmt.Errorf("invalid number in time shift: %s", shift)
	}

	unit := matches[2]

	switch unit {
	case "s":
		return -time.Duration(num) * time.Second, nil
	case "m":
		return -time.Duration(num) * time.Minute, nil
	case "h":
		return -time.Duration(num) * time.Hour, nil
	case "d":
		return -time.Duration(num) * 24 * time.Hour, nil
	case "w":
		return -time.Duration(num) * 7 * 24 * time.Hour, nil
	case "M":
		return -time.Duration(num) * 30 * 24 * time.Hour, nil
	case "y":
		return -time.Duration(num) * 365 * 24 * time.Hour, nil
	default:
		return 0, fmt.Errorf("unknown time shift unit: %s", unit)
	}
}

// ShiftTimeRange applies a time shift string to a time range, returning the shifted from/to.
// For month (M) and year (y) shifts, it uses calendar-aware arithmetic for accuracy.
func ShiftTimeRange(from, to time.Time, shift string) (time.Time, time.Time, error) {
	matches := timeshiftReg.FindStringSubmatch(shift)
	if matches == nil {
		return from, to, fmt.Errorf("invalid time shift format: %s", shift)
	}

	num, err := strconv.Atoi(matches[1])
	if err != nil {
		return from, to, fmt.Errorf("invalid number in time shift: %s", shift)
	}

	unit := matches[2]

	switch unit {
	case "M":
		return from.AddDate(0, -num, 0), to.AddDate(0, -num, 0), nil
	case "y":
		return from.AddDate(-num, 0, 0), to.AddDate(-num, 0, 0), nil
	default:
		d, err := ParseTimeShift(shift)
		if err != nil {
			return from, to, err
		}
		return from.Add(d), to.Add(d), nil
	}
}

// ShiftToMs returns the time shift as positive milliseconds, matching the frontend's parseShiftToMs.
func ShiftToMs(shift string) (int64, error) {
	matches := timeshiftReg.FindStringSubmatch(shift)
	if matches == nil {
		return 0, fmt.Errorf("invalid time shift format: %s", shift)
	}

	num, err := strconv.Atoi(matches[1])
	if err != nil {
		return 0, err
	}

	unit := matches[2]
	now := time.Now()

	switch unit {
	case "M":
		shifted := now.AddDate(0, -num, 0)
		return now.Sub(shifted).Milliseconds(), nil
	case "y":
		shifted := now.AddDate(-num, 0, 0)
		return now.Sub(shifted).Milliseconds(), nil
	default:
		d, err := ParseTimeShift(shift)
		if err != nil {
			return 0, err
		}
		// d is negative, so negate to get positive ms
		return (-d).Milliseconds(), nil
	}
}
