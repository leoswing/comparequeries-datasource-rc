//go:build mage

package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
)

const (
	pluginID   = "leoswing-comparequeries-datasource"
	binaryBase = "gpx_comparequeries_datasource"
	entrypoint = "./pkg"
)

// Build compiles the backend plugin for the current platform.
func Build() error {
	return buildFor(runtime.GOOS, runtime.GOARCH)
}

// BuildAll compiles the backend plugin for all supported platforms.
func BuildAll() error {
	targets := []struct{ os, arch string }{
		{"linux", "amd64"},
		{"linux", "arm64"},
		{"darwin", "amd64"},
		{"darwin", "arm64"},
		{"windows", "amd64"},
	}
	for _, t := range targets {
		fmt.Printf("Building %s/%s...\n", t.os, t.arch)
		if err := buildFor(t.os, t.arch); err != nil {
			return fmt.Errorf("build %s/%s: %w", t.os, t.arch, err)
		}
	}
	return nil
}

// BuildLinux compiles for linux/amd64 (for Docker development).
func BuildLinux() error {
	return buildFor("linux", "amd64")
}

func buildFor(targetOS, targetArch string) error {
	ext := ""
	if targetOS == "windows" {
		ext = ".exe"
	}

	outputName := fmt.Sprintf("%s_%s_%s%s", binaryBase, targetOS, targetArch, ext)
	outputPath := filepath.Join("dist", outputName)

	if err := os.MkdirAll("dist", 0755); err != nil {
		return err
	}

	ldflags := "-w -s"
	env := append(os.Environ(),
		"GOOS="+targetOS,
		"GOARCH="+targetArch,
		"CGO_ENABLED=0",
	)

	args := []string{
		"build",
		"-o", outputPath,
		"-ldflags", ldflags,
		entrypoint,
	}

	fmt.Printf("  go %s\n", strings.Join(args, " "))

	cmd := exec.Command("go", args...)
	cmd.Env = env
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

// Clean removes all build artifacts.
func Clean() error {
	patterns := []string{
		"dist/" + binaryBase + "_*",
	}
	for _, p := range patterns {
		matches, _ := filepath.Glob(p)
		for _, m := range matches {
			fmt.Printf("Removing %s\n", m)
			os.Remove(m)
		}
	}
	return nil
}
