// SiYuan - From thought to insight, with agents
// Copyright (c) 2020-present, b3log.org
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

package util

import (
	"path/filepath"
	"testing"
)

func TestUserConfDirUsesEnvOrClaudeNotesDefault(t *testing.T) {
	originalHomeDir := HomeDir
	t.Cleanup(func() { HomeDir = originalHomeDir })
	HomeDir = filepath.Join(t.TempDir(), "home")

	t.Setenv(EnvConfDir, "")
	if got, want := UserConfDir(), filepath.Join(HomeDir, ".config", "claudenotes"); got != want {
		t.Fatalf("UserConfDir() = %q, want %q", got, want)
	}

	custom := filepath.Join(t.TempDir(), "ClaudeNotesData", "config")
	t.Setenv(EnvConfDir, custom+string(filepath.Separator))
	if got := UserConfDir(); got != filepath.Clean(custom) {
		t.Fatalf("UserConfDir() = %q, want %q", got, custom)
	}
}

func TestDefaultWorkspaceDirUsesEnv(t *testing.T) {
	custom := filepath.Join(t.TempDir(), "ClaudeNotesData", "workspace")
	t.Setenv(EnvDefaultWorkspace, custom)
	if got := DefaultWorkspaceDir(); got != custom {
		t.Fatalf("DefaultWorkspaceDir() = %q, want %q", got, custom)
	}

	t.Setenv(EnvDefaultWorkspace, "")
	if got := DefaultWorkspaceDir(); filepath.Base(got) != ProductName {
		t.Fatalf("DefaultWorkspaceDir() = %q, want a %s directory", got, ProductName)
	}
}
