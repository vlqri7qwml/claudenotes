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

package bazaar

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

// TestMain 集市的原有测试都使用本地 httptest 服务器，按开启云端服务运行；关闭时的行为由 TestCloudServiceDisabledBlocksBazaarRequests 覆盖
func TestMain(m *testing.M) {
	util.SetCloudServiceEnabled(true)
	os.Exit(m.Run())
}

// TestCloudServiceDisabledBlocksBazaarRequests 校验关闭云端服务后集市索引、评分、下载均不发出请求
func TestCloudServiceDisabledBlocksBazaarRequests(t *testing.T) {
	util.SetCloudServiceEnabled(false)
	t.Cleanup(func() { util.SetCloudServiceEnabled(true) })

	var requests atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		requests.Add(1)
		writer.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	resetBazaarIndexTestState(t)
	bazaarIndexStatServer = server.URL
	oldRatingServer := bazaarRatingStatServer
	oldDownloadServer := bazaarDownloadCloudServer
	t.Cleanup(func() {
		bazaarRatingStatServer = oldRatingServer
		bazaarDownloadCloudServer = oldDownloadServer
	})
	bazaarRatingStatServer = server.URL
	bazaarDownloadCloudServer = func() string { return server.URL }

	if _, err := fetchBazaarIndexPath(context.Background(), bazaarIndexPath); !errors.Is(err, util.ErrCloudServiceDisabled) {
		t.Fatalf("bazaar index should be blocked: %v", err)
	}
	if _, err := fetchBazaarRatingRegion(context.Background(), 0); !errors.Is(err, util.ErrCloudServiceDisabled) {
		t.Fatalf("bazaar rating should be blocked: %v", err)
	}
	if _, err := downloadBazaarFile("https://github.com/owner/repo@0123456789abcdef/README.md", false); !errors.Is(err, util.ErrCloudServiceDisabled) {
		t.Fatalf("bazaar download should be blocked: %v", err)
	}
	if isBazaarOnline0() {
		t.Fatal("bazaar should be offline when cloud service is disabled")
	}
	if 0 != requests.Load() {
		t.Fatalf("unexpected requests: %d", requests.Load())
	}
}
