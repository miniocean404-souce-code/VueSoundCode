/* @flow */

import config from "../config";
import { initUse } from "./use";
import { initMixin } from "./mixin";
import { initExtend } from "./extend";
import { initAssetRegisters } from "./assets";
import { set, del } from "../observer/index";
import { ASSET_TYPES } from "shared/constants";
import builtInComponents from "../components/index";
import { observe } from "core/observer/index";

import {
  warn,
  extend,
  nextTick,
  mergeOptions,
  defineReactive
} from "../util/index";

/**
 * @描述 初始化全局API,
 * @作者 HY
 * @时间 2021-06-27 22:24
 */
export function initGlobalAPI(Vue: GlobalAPI) {
  // * 定义config
  const configDef = {};
  configDef.get = () => config;
  if (process.env.NODE_ENV !== "production") {
    configDef.set = () => {
      warn(
        "Do not replace the Vue.config object, set individual fields instead."
      );
    };
  }
  Object.defineProperty(Vue, "config", configDef);

  // 暴露的 util 方法。注意：这些不被视为公共 API 的一部分，避免使用
  Vue.util = {
    warn,
    extend,
    mergeOptions,
    defineReactive
  };

  Vue.set = set;
  Vue.delete = del;
  Vue.nextTick = nextTick;

  // 2.6 显示观察API
  Vue.observable = <T>(obj: T): T => {
    observe(obj);
    return obj;
  };

  // * 初始化大Vue options 在options中定义声明周期
  Vue.options = Object.create(null);
  ASSET_TYPES.forEach(type => {
    Vue.options[type + "s"] = Object.create(null);
  });

  // 这用于标识“基础”构造函数，以在 Weex 的多实例场景中扩展所有普通对象组件。
  // * 基础构造函数
  Vue.options._base = Vue;

  // * 继承内部组件
  extend(Vue.options.components, builtInComponents);

  initUse(Vue);
  initMixin(Vue);
  initExtend(Vue);
  initAssetRegisters(Vue);
}
