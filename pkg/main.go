package main

import (
	"os"

	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/leoswing/comparequeries-datasource-rc/pkg/plugin"
)

func main() {
	if err := datasource.Manage(
		"leoswing-comparequeries-datasource",
		plugin.NewDatasource,
		datasource.ManageOpts{},
	); err != nil {
		log.DefaultLogger.Error(err.Error())
		os.Exit(1)
	}
}
