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
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"sync/atomic"
	"testing"

	"github.com/siyuan-note/siyuan/kernel/util"
)

// TestMain 原有测试都使用本地 httptest 服务器，按开启云端服务运行；关闭时的行为由下面的用例覆盖
func TestMain(m *testing.M) {
	util.SetCloudServiceEnabled(true)
	os.Exit(m.Run())
}

// TestCloudServiceDisabledBlocksBazaarRatingRequests 校验关闭云端服务后集市评分接口不发出请求
func TestCloudServiceDisabledBlocksBazaarRatingRequests(t *testing.T) {
	util.SetCloudServiceEnabled(false)
	t.Cleanup(func() { util.SetCloudServiceEnabled(true) })

	var requests atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		requests.Add(1)
		writer.WriteHeader(http.StatusOK)
	}))
	defer server.Close()
	oldServer := bazaarRatingCloudServer
	t.Cleanup(func() { bazaarRatingCloudServer = oldServer })
	bazaarRatingCloudServer = func() string { return server.URL }

	data := map[string]any{}
	err := requestBazaarPackageRating(context.Background(), "/apis/siyuan/bazaar/getBazaarPackageRating", map[string]any{"token": "secret"}, &data)
	if !errors.Is(err, util.ErrCloudServiceDisabled) {
		t.Fatalf("bazaar rating should be blocked: %v", err)
	}
	if 0 != requests.Load() {
		t.Fatalf("unexpected requests: %d", requests.Load())
	}
}

// TestCloudServiceDisabledCloudBlocksNetwork 校验关闭云端服务时远端同步服务的网络操作全部返回错误
func TestCloudServiceDisabledCloudBlocksNetwork(t *testing.T) {
	c := &cloudServiceDisabledCloud{}
	if _, _, err := c.GetRefsFiles(); !errors.Is(err, util.ErrCloudServiceDisabled) {
		t.Fatalf("GetRefsFiles should be blocked: %v", err)
	}
	if _, err := c.DownloadObject("refs/latest"); !errors.Is(err, util.ErrCloudServiceDisabled) {
		t.Fatalf("DownloadObject should be blocked: %v", err)
	}
	if _, err := c.UploadObject("refs/latest", true); !errors.Is(err, util.ErrCloudServiceDisabled) {
		t.Fatalf("UploadObject should be blocked: %v", err)
	}
	if _, _, err := c.GetRepos(); !errors.Is(err, util.ErrCloudServiceDisabled) {
		t.Fatalf("GetRepos should be blocked: %v", err)
	}
	if 0 != c.GetAvailableSize() {
		t.Fatal("available size should be zero")
	}
}
