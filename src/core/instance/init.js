/* @flow */
import config from "../config";
import { initProxy } from "./proxy";
import { initState } from "./state";
import { initRender } from "./render";
import { initEvents } from "./events";
import { mark, measure } from "../util/perf";
import { callHook, initLifecycle } from "./lifecycle";
import { initInjections, initProvide } from "./inject";
import { extend, formatComponentName, mergeOptions } from "../util/index";

let uid = 0;

/**
 * @描述 集中初始化各个钩子，合并配置
 * @作者 HY
 * @时间 2021-06-27 14:20
 */
export function initMixin(Vue: Class<Component>) {
  Vue.prototype._init = function(options?: Object) {
    //* 定义Vm
    //* 挂载_uid，每次初始化都让id++
    //* _isVue避免被观察到的标志
    const vm: Component = this;
    vm._uid = uid++;
    vm._isVue = true;

    // 性能优化钩子
    let startTag, endTag;
    if (process.env.NODE_ENV !== "production" && config.performance && mark) {
      startTag = `vue-perf-start:${vm._uid}`;
      endTag = `vue-perf-end:${vm._uid}`;
      mark(startTag);
    }

    // * 是组件，初始化组件、
    // * 不是 普通节点合并options
    if (options && options._isComponent) {
      initInternalComponent(vm, options);
    } else {
      vm.$options = mergeOptions(
        resolveConstructorOptions(vm.constructor), //大vue的option
        options || {}, //new Vue 的options
        vm
      );
    }

    // * 支持Proxy就使用代理否则vm._renderProxy = vm
    if (process.env.NODE_ENV !== "production") {
      initProxy(vm);
    } else {
      vm._renderProxy = vm;
    }

    vm._self = vm; //* 循环挂载

    // * 初始化声明周期、事件、render函数
    initLifecycle(vm);
    initEvents(vm);
    initRender(vm);
    callHook(vm, "beforeCreate");

    //* 初始化注入提供钩子、初始化数据
    initInjections(vm);
    initState(vm);
    initProvide(vm);
    callHook(vm, "created");

    if (process.env.NODE_ENV !== "production" && config.performance && mark) {
      vm._name = formatComponentName(vm, false);
      mark(endTag);
      measure(`vue ${vm._name} init`, startTag, endTag);
    }

    //* 如果有el就通过el进行挂载
    if (vm.$options.el) {
      vm.$mount(vm.$options.el);
    }
  };
}

// 初始化内部组件，在当前组件中合并父占位符VNode的一些属性（这种合并是因为它比动态枚举要快
export function initInternalComponent(
  vm: Component,
  options: InternalComponentOptions
) {
  //* 声明 占位符vnode，子的在extend中合并好的options
  const parentVnode = options._parentVnode;
  const opts = (vm.$options = Object.create(vm.constructor.options));

  opts._parentVnode = parentVnode; // vm.$options中挂载父Vue实例和父VNode
  opts.parent = options.parent; // 子组件的父vue实例

  //* 将占位符VNode(父组件)的组件选项赋值给当前子Vm实例
  const vnodeComponentOptions = parentVnode.componentOptions;
  opts.propsData = vnodeComponentOptions.propsData;
  opts._parentListeners = vnodeComponentOptions.listeners;
  opts._renderChildren = vnodeComponentOptions.children;
  opts._componentTag = vnodeComponentOptions.tag;

  // 这时候还没有编译render函数，查看用户是否自己手写了render函数
  if (options.render) {
    opts.render = options.render;
    opts.staticRenderFns = options.staticRenderFns;
  }
}

// 解析构造函数中的option，并返回
export function resolveConstructorOptions(Ctor: Class<Component>) {
  let options = Ctor.options;
  if (Ctor.super) {
    const superOptions = resolveConstructorOptions(Ctor.super);
    const cachedSuperOptions = Ctor.superOptions;
    if (superOptions !== cachedSuperOptions) {
      // super option changed,
      // need to resolve new options.
      Ctor.superOptions = superOptions;
      // check if there are any late-modified/attached options (#4976)
      const modifiedOptions = resolveModifiedOptions(Ctor);
      // update base extend options
      if (modifiedOptions) {
        extend(Ctor.extendOptions, modifiedOptions);
      }
      options = Ctor.options = mergeOptions(superOptions, Ctor.extendOptions);
      if (options.name) {
        options.components[options.name] = Ctor;
      }
    }
  }
  return options;
}

//解决修改的选项
function resolveModifiedOptions(Ctor: Class<Component>): ?Object {
  let modified;
  const latest = Ctor.options;
  const sealed = Ctor.sealedOptions;
  for (const key in latest) {
    if (latest[key] !== sealed[key]) {
      if (!modified) modified = {};
      modified[key] = latest[key];
    }
  }
  return modified;
}
