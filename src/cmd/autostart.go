package cmd

import (
	"os"
	"path/filepath"
	"runtime"

	"github.com/spotifier/cli/src/utils"
)

const autostartFileName = "spotifier-autostart.cmd"

// getStartupFolder returns the current user's per-user Windows Startup
// folder, where anything placed is launched automatically at logon.
func getStartupFolder() (string, error) {
	appData := os.Getenv("APPDATA")
	if len(appData) == 0 {
		return "", os.ErrNotExist
	}
	return filepath.Join(appData, "Microsoft", "Windows", "Start Menu", "Programs", "Startup"), nil
}

// EnableAutostart registers "spotifier auto" to run at every Windows logon,
// so a fresh Spotify install/update is re-patched automatically instead of
// requiring the user to rerun the command by hand after every restart.
func EnableAutostart() {
	if runtime.GOOS != "windows" {
		utils.PrintError("Autostart is only supported on Windows.")
		return
	}

	exePath, err := os.Executable()
	if err != nil {
		utils.Fatal(err)
		return
	}
	if link, err := filepath.EvalSymlinks(exePath); err == nil {
		exePath = link
	}

	startupFolder, err := getStartupFolder()
	if err != nil {
		utils.PrintError(`Cannot resolve Windows Startup folder ("%APPDATA%" is not set).`)
		return
	}

	if err := os.MkdirAll(startupFolder, 0755); err != nil {
		utils.Fatal(err)
		return
	}

	script := "@echo off\r\nstart \"\" \"" + exePath + "\" auto\r\n"
	scriptPath := filepath.Join(startupFolder, autostartFileName)

	if err := os.WriteFile(scriptPath, []byte(script), 0644); err != nil {
		utils.Fatal(err)
		return
	}

	utils.PrintSuccess("Enabled autostart. Spotify will be re-patched automatically every login.")
}

// AutostartStatus reports whether the logon entry created by
// EnableAutostart is currently present.
func AutostartStatus() {
	if runtime.GOOS != "windows" {
		utils.PrintError("Autostart is only supported on Windows.")
		return
	}

	startupFolder, err := getStartupFolder()
	if err != nil {
		utils.PrintError(`Cannot resolve Windows Startup folder ("%APPDATA%" is not set).`)
		return
	}

	scriptPath := filepath.Join(startupFolder, autostartFileName)
	if _, err := os.Stat(scriptPath); err == nil {
		utils.PrintSuccess("Autostart is enabled.")
	} else {
		utils.PrintWarning("Autostart is disabled.")
	}
}

// DisableAutostart removes the logon entry created by EnableAutostart.
func DisableAutostart() {
	if runtime.GOOS != "windows" {
		utils.PrintError("Autostart is only supported on Windows.")
		return
	}

	startupFolder, err := getStartupFolder()
	if err != nil {
		utils.PrintError(`Cannot resolve Windows Startup folder ("%APPDATA%" is not set).`)
		return
	}

	scriptPath := filepath.Join(startupFolder, autostartFileName)
	if err := os.Remove(scriptPath); err != nil {
		if os.IsNotExist(err) {
			utils.PrintWarning("Autostart was not enabled.")
			return
		}
		utils.Fatal(err)
		return
	}

	utils.PrintSuccess("Disabled autostart.")
}
