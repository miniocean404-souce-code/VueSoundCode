/* @flow */

import { ASSET_TYPES } from "shared/constants";
import { defineComputed, proxy } from "../instance/state";
import { extend, mergeOptions, validateComponentName } from "../util/index";

/**
 * @描述 继承大Vue组件，缓存继承的响应对象（下次可直接返回）
 * @作者 HY
 * @时间 2021-06-27 19:56
 */
export function initExtend(Vue: GlobalAPI) {
  // 每个实例构造函数，包括 Vue，都有一个唯一的 cid。这使我们能够为原型继承创建包装的“子构造函数”并缓存它们。
  Vue.cid = 0;
  let cid = 1;

  Vue.extend = function(extendOptions: Object): Function {
    //例如（render(APP)）
    extendOptions = extendOptions || {};

    // * 获取父id和父this，定义缓存构造函数，如果有就直接返回
    const Super = this;
    const SuperId = Super.cid;
    const cachedCtors = extendOptions._Ctor || (extendOptions._Ctor = {});
    if (cachedCtors[SuperId]) {
      return cachedCtors[SuperId];
    }

    // * 获取组件的name,或者用父的name、检查组件命名规范
    const name = extendOptions.name || Super.options.name;
    if (process.env.NODE_ENV !== "production" && name) {
      validateComponentName(name);
    }

    // * 定义子组件
    const Sub = function VueComponent(options) {
      this._init(options);
    };

    // * 父类原型赋给子原型，子构造函数原型赋值为子（将父的原型上的东西继承下来）、将组件的option和父的option进行合并
    Sub.prototype = Object.create(Super.prototype);
    Sub.prototype.constructor = Sub;
    Sub.cid = cid++;
    Sub.options = mergeOptions(Super.options, extendOptions); // * 将大Vue的options与子的options调用mergeOptions的合并策略进行合并
    Sub["super"] = Super; //子中定义一个父的钩子函数指向

    // * 在子对象上继续可以使用extend、mixin、use
    Sub.extend = Super.extend;
    Sub.mixin = Super.mixin;
    Sub.use = Super.use;

    // * 将component、directive、filter继承在子
    ASSET_TYPES.forEach(function(type) {
      Sub[type] = Super[type];
    });

    // * 在自己的options.components指向一个自己
    if (name) {
      Sub.options.components[name] = Sub;
    }

    // * 在扩展时保留对父选项的引用。稍后在实例化时，我们可以检查 Super 的选项是否已更新。
    Sub.superOptions = Super.options;
    Sub.extendOptions = extendOptions;
    Sub.sealedOptions = extend({}, Sub.options);

    // 对于 props 和计算属性，我们定义了代理 getter
    // 扩展时的 Vue 实例，在扩展原型上. This 这样可以避免为每个创建的实例调用Object.defineProperty。
    if (Sub.options.props) {
      initProps(Sub);
    }
    if (Sub.options.computed) {
      initComputed(Sub);
    }

    // * 缓存当前子的构造函数，只要有就添加到cachedCtors进行缓存
    cachedCtors[SuperId] = Sub;
    return Sub;
  };
}

function initProps(Comp) {
  const props = Comp.options.props;
  for (const key in props) {
    proxy(Comp.prototype, `_props`, key);
  }
}

function initComputed(Comp) {
  const computed = Comp.options.computed;
  for (const key in computed) {
    defineComputed(Comp.prototype, key, computed[key]);
  }
}
