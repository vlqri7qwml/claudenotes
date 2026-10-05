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

package agent

import (
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/siyuan-note/siyuan/kernel/util"
)

// TestModelsDevRefreshFollowsCloudService 校验 models.dev 模型目录只在开启云端服务时刷新
func TestModelsDevRefreshFollowsCloudService(t *testing.T) {
	resetModelsDevStateForTest()
	t.Cleanup(func() {
		util.SetCloudServiceEnabled(false)
		resetModelsDevStateForTest()
	})
	var requests atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		requests.Add(1)
		_, _ = writer.Write([]byte(`{}`))
	}))
	defer server.Close()
	modelsDevEndpoint = server.URL

	util.SetCloudServiceEnabled(false)
	StartModelMetadataRefresh()
	ResolveModelContextLimit("https://provider.example.com/v1", "online-model", 0)
	time.Sleep(100 * time.Millisecond)
	if 0 != requests.Load() {
		t.Fatalf("models.dev should not be requested when cloud service is disabled: %d", requests.Load())
	}

	util.SetCloudServiceEnabled(true)
	StartModelMetadataRefresh()
	for deadline := time.Now().Add(5 * time.Second); 0 == requests.Load() && time.Now().Before(deadline); {
		time.Sleep(20 * time.Millisecond)
	}
	if 1 != requests.Load() {
		t.Fatalf("models.dev should be requested once when cloud service is enabled: %d", requests.Load())
	}
}
