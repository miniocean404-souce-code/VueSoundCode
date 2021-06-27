/* @flow */

import Vue from "core/index";
import config from "core/config";
import { extend, noop } from "shared/util";
import { mountComponent } from "core/instance/lifecycle";
import { devtools, inBrowser } from "core/util/index";

import {
  getTagNamespace,
  isReservedAttr,
  isReservedTag,
  isUnknownElement,
  mustUseProp,
  query
} from "web/util/index";

import { patch } from "./patch";
import platformDirectives from "./directives/index";
import platformComponents from "./components/index";

// 安装特定于平台的工具
Vue.config.mustUseProp = mustUseProp;
Vue.config.isReservedTag = isReservedTag;
Vue.config.isReservedAttr = isReservedAttr;
Vue.config.getTagNamespace = getTagNamespace;
Vue.config.isUnknownElement = isUnknownElement;

// 安装平台运行时指令和组件
extend(Vue.options.directives, platformDirectives);
extend(Vue.options.components, platformComponents);

/**
 * @描述 平台挂载patch方法
 * @作者 HY
 * @时间 2021-06-27 16:33
 */
Vue.prototype.__patch__ = inBrowser ? patch : noop;

/**
 * @描述 公共的mount方法，为编译版本编译好的模板挂载，only版本直接挂载（是为了将函数编译为模板，然后调用mountComponent进行渲染挂载）
 * @作者 HY
 * @时间 2021-06-27 16:33
 */
Vue.prototype.$mount = function(
  el?: string | Element,
  hydrating?: boolean
): Component {
  el = el && inBrowser ? query(el) : undefined;
  return mountComponent(this, el, hydrating);
};

/**
 * @描述 devtools 全局钩子
 * @作者 HY
 * @时间 2021-06-27 16:32
 */
if (inBrowser) {
  setTimeout(() => {
    // * 检查vue开发工具
    if (config.devtools) {
      if (devtools) {
        devtools.emit("init", Vue);
      } else if (
        process.env.NODE_ENV !== "production" &&
        process.env.NODE_ENV !== "test"
      ) {
        console[console.info ? "info" : "log"](
          "Download the Vue Devtools extension for a better development experience:\n" +
            "https://github.com/vuejs/vue-devtools"
        );
      }
    }

    if (
      process.env.NODE_ENV !== "production" &&
      process.env.NODE_ENV !== "test" &&
      config.productionTip !== false &&
      typeof console !== "undefined"
    ) {
      console[console.info ? "info" : "log"](
        `You are running Vue in development mode.\n` +
          `Make sure to turn on production mode when deploying for production.\n` +
          `See more tips at https://vuejs.org/guide/deployment.html`
      );
    }
  }, 0);
}

export default Vue;
