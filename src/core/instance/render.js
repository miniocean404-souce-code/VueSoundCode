/* @flow */

import {
  defineReactive,
  emptyObject,
  handleError,
  nextTick,
  warn
} from "../util/index";

import { createElement } from "../vdom/create-element";
import { installRenderHelpers } from "./render-helpers/index";

import { resolveSlots } from "./render-helpers/resolve-slots";
import { normalizeScopedSlots } from "../vdom/helpers/normalize-scoped-slots";

import VNode, { createEmptyVNode } from "../vdom/vnode";

import { isUpdatingChildComponent } from "./lifecycle";

/**
 * @描述 初始化render函数所需要的变量及$createElement
 * @作者 HY
 * @时间 2021-06-27 17:00
 */
export function initRender(vm: Component) {
  vm._vnode = null;
  vm._staticTrees = null;
  const options = vm.$options;
  const parentVnode = (vm.$vnode = options._parentVnode); // 父树中的占位符节点 the placeholder node in parent tree
  // * 如果parentVnode存在就把parentVnode.context赋给变量，否则就把parentVnode赋给变量
  const renderContext = parentVnode && parentVnode.context; //内容
  const parentData = parentVnode && parentVnode.data;

  vm.$slots = resolveSlots(options._renderChildren, renderContext);
  vm.$scopedSlots = emptyObject;

  // * 手写render渲染
  vm._c = (a, b, c, d) => createElement(vm, a, b, c, d, false);
  // * 组件渲染
  vm.$createElement = (a, b, c, d) => createElement(vm, a, b, c, d, true);

  // * 定义响应式$attrs、$listeners
  if (process.env.NODE_ENV !== "production") {
    defineReactive(
      vm,
      "$attrs",
      (parentData && parentData.attrs) || emptyObject,
      () => {
        !isUpdatingChildComponent && warn(`$attrs is readonly.`, vm);
      },
      true
    );
    defineReactive(
      vm,
      "$listeners",
      options._parentListeners || emptyObject,
      () => {
        !isUpdatingChildComponent && warn(`$listeners is readonly.`, vm);
      },
      true
    );
  } else {
    defineReactive(
      vm,
      "$attrs",
      (parentData && parentData.attrs) || emptyObject,
      null,
      true
    );
    defineReactive(
      vm,
      "$listeners",
      options._parentListeners || emptyObject,
      null,
      true
    );
  }
}

export let currentRenderingInstance: Component | null = null;

/**
 * @描述 执行挂载$nextTick、_render
 * @作者 HY
 * @时间 2021-06-27 16:48
 */
export function renderMixin(Vue: Class<Component>) {
  // install runtime convenience helpers
  installRenderHelpers(Vue.prototype);

  /**
   * @描述 挂载$nextTick
   * @作者 HY
   * @时间 2021-06-27 17:02
   */
  Vue.prototype.$nextTick = function(fn: Function) {
    return nextTick(fn, this);
  };

  // 当前VM执行render函数传入$createElement生成新的VNode
  Vue.prototype._render = function(): VNode {
    // * 声明
    const vm: Component = this;
    let vnode;
    const { render, _parentVnode } = vm.$options; // _parentVNode 占位符VNode（例如h(App)）
    if (_parentVnode) {
      vm.$scopedSlots = normalizeScopedSlots(
        _parentVnode.data.scopedSlots,
        vm.$slots,
        vm.$scopedSlots
      );
    }
    // 组件VNode
    vm.$vnode = _parentVnode; //占位符vnode（例如h(App)）

    // 调用编译或者手写的render函数执行$createElement渲染当前界面的VNode
    // 渲染出错就渲染错误界面，如果渲染错误界面出错就包警告，将渲染VNode返回给VNode
    try {
      currentRenderingInstance = vm;
      vnode = render.call(vm._renderProxy, vm.$createElement);
    } catch (e) {
      handleError(e, vm, `render`);
      if (process.env.NODE_ENV !== "production" && vm.$options.renderError) {
        try {
          vnode = vm.$options.renderError.call(
            vm._renderProxy,
            vm.$createElement,
            e
          );
        } catch (e) {
          handleError(e, vm, `renderError`);
          vnode = vm._vnode;
        }
      } else {
        vnode = vm._vnode;
      }
    } finally {
      currentRenderingInstance = null;
    }

    // * 返回Vnode
    if (Array.isArray(vnode) && vnode.length === 1) {
      vnode = vnode[0];
    }

    // * 如果渲染的vnode不在Vnode原型上函数出错，则返回空的vnode
    if (!(vnode instanceof VNode)) {
      if (process.env.NODE_ENV !== "production" && Array.isArray(vnode)) {
        warn(
          // 从渲染函数返回的多个根节点。渲染功能应该返回单个根节点。
          "Multiple root nodes returned from render function. Render function " +
            "should return a single root node.",
          vm
        );
      }
      // * 则返回空的vnode
      vnode = createEmptyVNode();
    }

    //* 将渲染VNode的parent设置占位符VNode
    vnode.parent = _parentVnode;
    return vnode;
  };
}

// 仅供测试
export function setCurrentRenderingInstance(vm: Component) {
  currentRenderingInstance = vm;
}
