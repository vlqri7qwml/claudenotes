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

package model

import (
	"os"
	"path/filepath"

	"github.com/88250/gulu"
	"github.com/siyuan-note/logging"
	"github.com/siyuan-note/siyuan/kernel/conf"
	"github.com/siyuan-note/siyuan/kernel/util"
)

// claudeNotesDefaultsMarker 记录工作空间已应用过 ClaudeNotes 编辑器默认值，避免覆盖用户之后的修改。
const claudeNotesDefaultsMarker = "claudenotes-defaults"

// applyClaudeNotesEditorDefaultsOnce 在每个工作空间首次由新版本打开时开启代码块换行与正文居中，只执行一次。
func applyClaudeNotesEditorDefaultsOnce() {
	markerPath := filepath.Join(util.ConfDir, claudeNotesDefaultsMarker)
	if gulu.File.IsExist(markerPath) {
		return
	}
	conf.ApplyClaudeNotesEditorDefaults(Conf.Editor)
	if err := os.WriteFile(markerPath, []byte("1"), 0644); err != nil {
		logging.LogErrorf("write ClaudeNotes defaults marker [%s] failed: %s", markerPath, err)
	}
}
