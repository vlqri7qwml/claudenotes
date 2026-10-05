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
	"errors"
	"os"
	"path/filepath"
	"sync/atomic"

	"github.com/88250/gulu"
)

const (
	// ProductName 为 ClaudeNotes 的产品名，用于用户级配置目录与默认工作空间目录名
	ProductName = "ClaudeNotes"

	// EnvConfDir 由桌面外壳设置，指向安装目录下的 ClaudeNotesData/config
	EnvConfDir = "CLAUDENOTES_CONF_DIR"
	// EnvDefaultWorkspace 由桌面外壳设置，指向安装目录下的 ClaudeNotesData/workspace
	EnvDefaultWorkspace = "CLAUDENOTES_DEFAULT_WORKSPACE"
)

// UserConfDir 返回用户级配置目录，存放 workspace.json、port.json、日志等。
// 桌面端由外壳通过环境变量指定到安装目录；未指定时使用 ~/.config/claudenotes，与官方思源的 ~/.config/siyuan 互不干扰。
func UserConfDir() string {
	if dir := os.Getenv(EnvConfDir); "" != dir {
		return filepath.Clean(dir)
	}
	return filepath.Join(HomeDir, ".config", "claudenotes")
}

// DefaultWorkspaceDir 返回首次启动时使用的工作空间目录。
func DefaultWorkspaceDir() string {
	if dir := os.Getenv(EnvDefaultWorkspace); "" != dir {
		return filepath.Clean(dir)
	}
	if gulu.OS.IsWindows() {
		if userProfile := os.Getenv("USERPROFILE"); "" != userProfile {
			return filepath.Join(userProfile, ProductName)
		}
	} else if gulu.OS.IsDarwin() {
		return filepath.Join(HomeDir, "Library", "Application Support", ProductName)
	}
	return filepath.Join(HomeDir, ProductName)
}

// CloudServiceDisabledServer 是云端服务关闭时各云端地址的替代值：本机 discard 端口，请求会立即失败而不会出网。
const CloudServiceDisabledServer = "http://127.0.0.1:9"

// ErrCloudServiceDisabled 表示云端服务已关闭。
var ErrCloudServiceDisabled = errors.New("cloud service is disabled")

var cloudServiceEnabled atomic.Bool

// SetCloudServiceEnabled 设置是否开启思源官方云端服务（账号、云端同步、集市、更新、公告、云端收集箱等），由配置
// system.cloudService 驱动。ClaudeNotes 默认关闭。
func SetCloudServiceEnabled(enabled bool) {
	cloudServiceEnabled.Store(enabled)
}

// IsCloudServiceEnabled 返回是否开启了思源官方云端服务。
func IsCloudServiceEnabled() bool {
	return cloudServiceEnabled.Load()
}
