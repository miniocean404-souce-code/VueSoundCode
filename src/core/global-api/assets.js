/* @flow */

import { ASSET_TYPES } from "shared/constants";
import { isPlainObject, validateComponentName } from "../util/index";

// !'component','directive','filter' 全局注册
export function initAssetRegisters(Vue: GlobalAPI) {
  /**
   * Create asset registration methods.
   */
  ASSET_TYPES.forEach(type => {
    Vue[type] = function(
      id: string, //注册组件名字
      definition: Function | Object //注册组件的函数或者对象
    ): Function | Object | void {
      // * 如果不存在就从大Vue中查找并返回
      if (!definition) {
        return this.options[type + "s"][id];
      } else {
        /* istanbul ignore if */
        // * 检查组件命名
        if (process.env.NODE_ENV !== "production" && type === "component") {
          validateComponentName(id);
        }
        // * 是对象就走组件注册 可以在组件对象或者函数中定义组件名字，也可以在其外部定义名字
        if (type === "component" && isPlainObject(definition)) {
          definition.name = definition.name || id;
          definition = this.options._base.extend(definition);
        }

        if (type === "directive" && typeof definition === "function") {
          definition = { bind: definition, update: definition };
        }

        // 在大Vue中定义这个组件
        this.options[type + "s"][id] = definition;
        return definition;
      }
    };
  });
}
