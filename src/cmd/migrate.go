package cmd

import (
	"os"
	"os/exec"
	"path/filepath"
	"runtime"

	"github.com/spotifier/cli/src/utils"
)

// getLegacyFolder mirrors utils.GetSpotifierFolder/GetStateFolder's OS-specific
// default path logic, but for spicetify instead of spotifier, so an existing
// spicetify install can be located without ever creating it if absent.
func getLegacyFolder(envVar string) string {
	if result, ok := os.LookupEnv(envVar); ok && len(result) > 0 {
		return result
	}

	switch runtime.GOOS {
	case "windows":
		return filepath.Join(os.Getenv("APPDATA"), "spicetify")
	case "linux":
		parent, ok := os.LookupEnv("XDG_CONFIG_HOME")
		if !ok || len(parent) == 0 {
			parent = filepath.Join(os.Getenv("HOME"), ".config")
		}
		return filepath.Join(parent, "spicetify")
	case "darwin":
		return filepath.Join(os.Getenv("HOME"), ".config", "spicetify")
	default:
		return ""
	}
}

func getLegacyStateFolder() string {
	if result, ok := os.LookupEnv("SPICETIFY_STATE"); ok && len(result) > 0 {
		return result
	}

	switch runtime.GOOS {
	case "windows":
		return filepath.Join(os.Getenv("APPDATA"), "spicetify")
	case "linux":
		parent, ok := os.LookupEnv("XDG_STATE_HOME")
		if !ok || len(parent) == 0 {
			parent = filepath.Join(os.Getenv("HOME"), ".local", "state")
		}
		return filepath.Join(parent, "spicetify")
	case "darwin":
		return filepath.Join(os.Getenv("HOME"), ".local", "state", "spicetify")
	default:
		return ""
	}
}

// Migrate finds an existing spicetify installation, restores Spotify to
// vanilla using spicetify's own backup, then carries the user's themes,
// extensions, custom apps, and settings over into spotifier.
func Migrate() {
	legacyConfigFolder := getLegacyFolder("SPICETIFY_CONFIG")
	legacyStateFolder := getLegacyStateFolder()

	oldConfigPath := filepath.Join(legacyConfigFolder, "config-xpui.ini")
	if _, err := os.Stat(oldConfigPath); err != nil {
		utils.PrintError("No existing spicetify installation found at " + legacyConfigFolder)
		return
	}

	utils.PrintInfo("Found existing spicetify installation at " + legacyConfigFolder)
	utils.PrintInfo("Restoring Spotify to vanilla using spicetify's own backup...")

	exePath, err := os.Executable()
	if err != nil {
		utils.Fatal(err)
		return
	}
	if link, err := filepath.EvalSymlinks(exePath); err == nil {
		exePath = link
	}

	restoreCmd := exec.Command(exePath, "restore")
	restoreCmd.Env = append(os.Environ(),
		"SPOTIFIER_CONFIG="+legacyConfigFolder,
		"SPOTIFIER_STATE="+legacyStateFolder)
	restoreCmd.Stdout = os.Stdout
	restoreCmd.Stderr = os.Stderr
	// Non-fatal: spicetify may never have been applied, in which case
	// restore exits non-zero after printing why. Either way, migration
	// of user content below is what actually matters.
	restoreCmd.Run()

	oldCfg := utils.ParseConfig(oldConfigPath)
	for _, sectionName := range []string{"Setting", "Preprocesses", "AdditionalOptions", "Patch"} {
		oldSection := oldCfg.GetSection(sectionName)
		newSection := cfg.GetSection(sectionName)
		for _, key := range oldSection.Keys() {
			if sectionName == "Setting" && (key.Name() == "spotify_path" || key.Name() == "prefs_path") {
				continue
			}
			newSection.Key(key.Name()).SetValue(key.Value())
		}
	}
	if err := cfg.Write(); err != nil {
		utils.PrintWarning("Failed to save config: " + err.Error())
	}

	for _, sub := range []string{"Themes", "Extensions", "CustomApps"} {
		oldSub := filepath.Join(legacyConfigFolder, sub)
		if _, err := os.Stat(oldSub); err != nil {
			continue
		}
		if err := utils.Copy(oldSub, filepath.Join(spotifierFolder, sub), true, nil); err != nil {
			utils.PrintWarning("Failed to copy " + sub + ": " + err.Error())
		}
	}

	utils.PrintSuccess("Migrated your spicetify setup to spotifier.")
	utils.PrintInfo(`Run "spotifier apply" to finish switching over.`)
}
