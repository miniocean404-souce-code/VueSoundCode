/* @flow */

import { mergeOptions } from "../util/index";

/**
 * @描述 先在大Vue.options中合并全局mixin，然后初始化使用mergeOptions合并大Vue的options
 * @作者 HY
 * @时间 2021-06-27 22:29
 */
export function initMixin(Vue: GlobalAPI) {
  Vue.mixin = function(mixin: Object) {
    this.options = mergeOptions(this.options, mixin);
    return this;
  };
}
