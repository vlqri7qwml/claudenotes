import {fetchPost} from "./fetch";
import {showMessage} from "../dialog/message";

/** 在根元素上标记云端服务状态，样式据此隐藏同步按钮、订阅标识、在线集市等云端入口。 */
export const applyCloudServiceState = () => {
    document.documentElement.setAttribute("data-cloud-service",
        window.siyuan.config?.system?.cloudService ? "on" : "off");
};

/** 开启或关闭思源官方云端服务，关闭后内核不再访问任何官方服务器。 */
export const setCloudService = (enabled: boolean) => {
    return new Promise<void>((resolve) => {
        fetchPost("/api/system/setCloudService", {enabled}, () => {
            window.siyuan.config.system.cloudService = enabled;
            applyCloudServiceState();
            showMessage(enabled ? window.siyuan.languages.cloudServiceTurnedOn :
                window.siyuan.languages.cloudServiceTurnedOff);
            resolve();
        });
    });
};
