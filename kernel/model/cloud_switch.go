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
	"github.com/siyuan-note/dejavu/cloud"
	"github.com/siyuan-note/dejavu/entity"
	"github.com/siyuan-note/siyuan/kernel/conf"
	"github.com/siyuan-note/siyuan/kernel/util"
)

// SetCloudService 开启或关闭思源官方云端服务并持久化。
func SetCloudService(enabled bool) {
	Conf.m.Lock()
	Conf.System.CloudService = enabled
	Conf.m.Unlock()
	Conf.Save()
	util.SetCloudServiceEnabled(enabled)
	if enabled {
		go util.RefreshRhyResultJob()
	}
}

// cloudServiceDisabledMsg 返回云端服务关闭时的提示文案。
func cloudServiceDisabledMsg() string {
	return Conf.Language(410)
}

// isRemoteSyncProvider 判断当前同步服务是否需要访问网络，本地文件夹不受云端服务开关影响。
func isRemoteSyncProvider() bool {
	return conf.ProviderLocal != Conf.Sync.Provider
}

// cloudServiceDisabledCloud 在云端服务关闭时包装远端同步服务：保留配置读取，所有网络操作直接返回错误。
type cloudServiceDisabledCloud struct {
	cloud.Cloud
}

func (c *cloudServiceDisabledCloud) CreateRepo(string) error { return util.ErrCloudServiceDisabled }
func (c *cloudServiceDisabledCloud) RemoveRepo(string) error { return util.ErrCloudServiceDisabled }
func (c *cloudServiceDisabledCloud) GetRepos() ([]*cloud.Repo, int64, error) {
	return nil, 0, util.ErrCloudServiceDisabled
}
func (c *cloudServiceDisabledCloud) UploadObject(string, bool) (int64, error) {
	return 0, util.ErrCloudServiceDisabled
}
func (c *cloudServiceDisabledCloud) UploadBytes(string, []byte, bool) (int64, error) {
	return 0, util.ErrCloudServiceDisabled
}
func (c *cloudServiceDisabledCloud) DownloadObject(string) ([]byte, error) {
	return nil, util.ErrCloudServiceDisabled
}
func (c *cloudServiceDisabledCloud) RemoveObject(string) error { return util.ErrCloudServiceDisabled }
func (c *cloudServiceDisabledCloud) GetTags() ([]*cloud.Ref, error) {
	return nil, util.ErrCloudServiceDisabled
}
func (c *cloudServiceDisabledCloud) GetIndexes(int) ([]*entity.Index, int, int, error) {
	return nil, 0, 0, util.ErrCloudServiceDisabled
}
func (c *cloudServiceDisabledCloud) GetRefsFiles() ([]string, []*cloud.Ref, error) {
	return nil, nil, util.ErrCloudServiceDisabled
}
func (c *cloudServiceDisabledCloud) GetChunks([]string) ([]string, error) {
	return nil, util.ErrCloudServiceDisabled
}
func (c *cloudServiceDisabledCloud) GetStat() (*cloud.Stat, error) {
	return nil, util.ErrCloudServiceDisabled
}
func (c *cloudServiceDisabledCloud) GetAvailableSize() int64   { return 0 }
func (c *cloudServiceDisabledCloud) AddTraffic(*cloud.Traffic) {}
func (c *cloudServiceDisabledCloud) ListObjects(string) (map[string]*entity.ObjectInfo, error) {
	return nil, util.ErrCloudServiceDisabled
}
func (c *cloudServiceDisabledCloud) GetIndex(string) (*entity.Index, error) {
	return nil, util.ErrCloudServiceDisabled
}
