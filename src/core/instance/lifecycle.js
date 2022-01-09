/* @flow */

import config from "../config";
import Watcher from "../observer/watcher";
import { mark, measure } from "../util/perf";
import { createEmptyVNode } from "../vdom/vnode";
import { updateComponentListeners } from "./events";
import { resolveSlots } from "./render-helpers/resolve-slots";
import { toggleObserving } from "../observer/index";
import { popTarget, pushTarget } from "../observer/dep";

import {
  emptyObject,
  invokeWithErrorHandling,
  noop,
  remove,
  validateProp,
  warn
} from "../util/index";
import keepAlive from "../components/keep-alive";

export let activeInstance: any = null;
export let isUpdatingChildComponent: boolean = false;

/**
 * @描述 设置当前vm实例，返回一个回到之前vm的一个函数
 * @作者 HY
 * @时间 2021-06-27 17:50
 */
export function setActiveInstance(vm: Component) {
  const prevActiveInstance = activeInstance;
  activeInstance = vm;
  return () => {
    activeInstance = prevActiveInstance;
  };
}

/**
 * @描述 递归组件形成父子结构、初始化vue实例
 * @作者 HY
 * @时间 2021-06-27 15:07
 */
export function initLifecycle(vm: Component) {
  //* 声明
  const options = vm.$options;
  let parent = options.parent; //* 在core\vdom\create-component中定义的create-component导入了_update函数全局定义的当前的活跃的实例 activeInstance

  // * 形成父子结构：父实例存在并且子没有abstract
  // * 如果父实例还有父并且有abstract就获取他的父实例，将子实例放入其$children中
  // ，并且在$children中push进当前的初始化的组件实例，
  if (parent && !options.abstract) {
    while (parent.$options.abstract && parent.$parent) {
      parent = parent.$parent;
    }
    parent.$children.push(vm);
  }

  //* 初始化Vue实例上的属性
  vm.$parent = parent;
  vm.$root = parent ? parent.$root : vm; //没有父就是当前就是根，有父就取根的大Vue
  vm.$children = [];
  vm.$refs = {};
  vm._watcher = null;
  vm._inactive = null;
  vm._directInactive = false;
  vm._isMounted = false;
  vm._isDestroyed = false;
  vm._isBeingDestroyed = false;
}

// 挂载_update函数、$forceUpdate函数、$destroy函数
export function lifecycleMixin(Vue: Class<Component>) {

  // 将render函数执行后生成的VNode将其放入patch中进行执行更新操作
  Vue.prototype._update = function(vnode: VNode, hydrating?: boolean) {
    const vm: Component = this;
    const prevEl = vm.$el;
    const prevVnode = vm._vnode;

    // 设置当前的实例（子组件的父实例），在子组件进行渲染时候可以设置其parent（子组件渲染时候就是子组件，就可以设置其孙子组件的父实例为子组件实例）以便建立父子关系
    const restoreActiveInstance = setActiveInstance(vm);
    vm._vnode = vnode; // _vnode：render函数生成的渲染VNode

    // 如果渲染过就更新，否则就直接渲染，path在之前根据当前的平台以及DOM方法用createPatchFunction进行合并
    if (!prevVnode) {
      vm.$el = vm.__patch__(vm.$el, vnode, hydrating, false /* removeOnly */);
    } else {
      // updates
      vm.$el = vm.__patch__(prevVnode, vnode);
    }

    // 回到之前的实例
    restoreActiveInstance();

    // 之前的置空，当前的$el设置__vue__为当前实例
    if (prevEl) {
      prevEl.__vue__ = null;
    }
    if (vm.$el) {
      vm.$el.__vue__ = vm;
    }

    if (vm.$vnode && vm.$parent && vm.$vnode === vm.$parent._vnode) {
      vm.$parent.$el = vm.$el;
    }
  };

  Vue.prototype.$forceUpdate = function() {
    const vm: Component = this;
    if (vm._watcher) {
      vm._watcher.update();
    }
  };

  Vue.prototype.$destroy = function() {
    const vm: Component = this;
    if (vm._isBeingDestroyed) {
      return;
    }

    // * 调用beforeDestroy钩子函数
    callHook(vm, "beforeDestroy");
    vm._isBeingDestroyed = true; //正在销毁

    // 从父中移除我 remove self from parent
    const parent = vm.$parent;
    if (parent && !parent._isBeingDestroyed && !vm.$options.abstract) {
      remove(parent.$children, vm);
    }
    // 移除观察者 teardown watchers
    if (vm._watcher) {
      vm._watcher.teardown();
    }
    let i = vm._watchers.length;
    while (i--) {
      vm._watchers[i].teardown();
    }

    // remove reference from data ob
    // frozen object may not have observer.
    if (vm._data.__ob__) {
      vm._data.__ob__.vmCount--;
    }
    // call the last hook...
    vm._isDestroyed = true; //已经被销毁
    // 在当前渲染的树上调用销毁钩子 invoke destroy hooks on current rendered tree
    vm.__patch__(vm._vnode, null);
    // fire destroyed hook
    callHook(vm, "destroyed");
    // turn off all instance listeners.
    vm.$off();
    // remove __vue__ reference
    if (vm.$el) {
      vm.$el.__vue__ = null;
    }
    // release circular reference (#6759)
    if (vm.$vnode) {
      vm.$vnode.parent = null;
    }
  };
}

// $mount函数挂载
export function mountComponent(
  vm: Component,
  el: ?Element,
  hydrating?: boolean
): Component {
  vm.$el = el;

  if (!vm.$options.render) {
    // * 没有写render或者没有生成render函数，就给他一个空Vnode
    vm.$options.render = createEmptyVNode;

    // * 没有render函数 但是有template、template没有#号、或者el存在的元素并且报警告说这个模板不可用
    if (process.env.NODE_ENV !== "production") {
      if (
        (vm.$options.template && vm.$options.template.charAt(0) !== "#") ||
        vm.$options.el ||
        el
      ) {
        warn(
          // 您正在使用 Vue 的仅运行时构建，模板不可用，要么将模板预编译为渲染函数，要么使用包含编译器的构建
          "You are using the runtime-only build of Vue where the template " +
            "compiler is not available. Either pre-compile the templates into " +
            "render functions, or use the compiler-included build.",
          vm
        );
      } else {
        warn(
          // '无法安装组件：模板或渲染功能未定义。'
          "Failed to mount component: template or render function not defined.",
          vm
        );
      }
    }
  }

  // * 进行beforeMount周期
  callHook(vm, "beforeMount");

  // * 性能优化统计函数
  let updateComponent;
  if (process.env.NODE_ENV !== "production" && config.performance && mark) {
    updateComponent = () => {
      const name = vm._name;
      const id = vm._uid;
      const startTag = `vue-perf-start:${id}`;
      const endTag = `vue-perf-end:${id}`;

      mark(startTag);
      const vnode = vm._render();
      mark(endTag);
      measure(`vue ${name} render`, startTag, endTag);

      mark(startTag);
      vm._update(vnode, hydrating);
      mark(endTag);
      measure(`vue ${name} patch`, startTag, endTag);
    };
  } else {
    // * 定义updateComponent函数，执行声明周期挂载的_update和_render函数
    updateComponent = () => {
      vm._update(vm._render(), hydrating);
    };
  }

  // 我们将其设置为监视程序构造函数中的vm._watcher，因为监视程序的初始修补程序可能会调用forceUpdate（例如，在子组件的已挂接钩子内部），它依赖于已定义的vm._watcher
  // new Watcher函数，调用 updateComponent 函数,渲染完成进行数据更新
  new Watcher(
    vm,
    updateComponent,
    noop,
    {
      // * 挂载过并且没有被销毁就执行beforeUpdate钩子
      before() {
        if (vm._isMounted && !vm._isDestroyed) {
          callHook(vm, "beforeUpdate");
        }
      }
    },
    true /* isRenderWatcher */
  );
  hydrating = false;

  // manually mounted instance, call mounted on self
  // mounted is called for render-created child components in its inserted hook
  // * 如果$vnode为空，将_isMounted状态设置为True,执行mounted钩子，将当前挂载的实例返回调用者
  if (vm.$vnode == null) {
    vm._isMounted = true;
    callHook(vm, "mounted");
  }
  return vm;
}

export function updateChildComponent(
  vm: Component,
  propsData: ?Object,
  listeners: ?Object,
  parentVnode: MountedComponentVNode,
  renderChildren: ?Array<VNode>
) {
  if (process.env.NODE_ENV !== "production") {
    isUpdatingChildComponent = true;
  }

  // determine whether component has slot children
  // we need to do this before overwriting $options._renderChildren.

  // check if there are dynamic scopedSlots (hand-written or compiled but with
  // dynamic slot names). Static scoped slots compiled from template has the
  // "$stable" marker.
  const newScopedSlots = parentVnode.data.scopedSlots;
  const oldScopedSlots = vm.$scopedSlots;
  const hasDynamicScopedSlot = !!(
    (newScopedSlots && !newScopedSlots.$stable) ||
    (oldScopedSlots !== emptyObject && !oldScopedSlots.$stable) ||
    (newScopedSlots && vm.$scopedSlots.$key !== newScopedSlots.$key)
  );

  // Any static slot children from the parent may have changed during parent's
  // update. Dynamic scoped slots may also have changed. In such cases, a forced
  // update is necessary to ensure correctness.
  const needsForceUpdate = !!(
    renderChildren || // has new static slots
    vm.$options._renderChildren || // has old static slots
    hasDynamicScopedSlot
  );

  vm.$options._parentVnode = parentVnode;
  vm.$vnode = parentVnode; // update vm's placeholder node without re-render

  if (vm._vnode) {
    // update child tree's parent
    vm._vnode.parent = parentVnode;
  }
  vm.$options._renderChildren = renderChildren;

  // update $attrs and $listeners hash
  // these are also reactive so they may trigger child update if the child
  // used them during render
  vm.$attrs = parentVnode.data.attrs || emptyObject;
  vm.$listeners = listeners || emptyObject;

  // update props
  if (propsData && vm.$options.props) {
    toggleObserving(false);
    const props = vm._props;
    const propKeys = vm.$options._propKeys || [];
    for (let i = 0; i < propKeys.length; i++) {
      const key = propKeys[i];
      const propOptions: any = vm.$options.props; // wtf flow?
      props[key] = validateProp(key, propOptions, propsData, vm);
    }
    toggleObserving(true);
    // keep a copy of raw propsData
    vm.$options.propsData = propsData;
  }

  // update listeners
  listeners = listeners || emptyObject;
  const oldListeners = vm.$options._parentListeners;
  vm.$options._parentListeners = listeners;
  updateComponentListeners(vm, listeners, oldListeners);

  // resolve slots + force update if has children
  if (needsForceUpdate) {
    vm.$slots = resolveSlots(renderChildren, parentVnode.context);
    vm.$forceUpdate();
  }

  if (process.env.NODE_ENV !== "production") {
    isUpdatingChildComponent = false;
  }
}

// 是否在未激活的树中
function isInInactiveTree(vm) {
  while (vm && (vm = vm.$parent)) {
    if (vm._inactive) return true;
  }
  return false;
}

// keepAlive激活钩子，是否是失活状态_inactive置为false 递归执行子组件的activated钩子
// direct用来指定当前是否已经挂载 第一次挂载会执行 activated钩子
export function activateChildComponent(vm: Component, direct?: boolean) {
  if (direct) {
    vm._directInactive = false;
    if (isInInactiveTree(vm)) {
      return;
    }
  } else if (vm._directInactive) {
    return;
  }
  if (vm._inactive || vm._inactive === null) {
    vm._inactive = false;
    for (let i = 0; i < vm.$children.length; i++) {
      activateChildComponent(vm.$children[i]);
    }
    callHook(vm, "activated");
  }
}

// keepAlive失活钩子，是否是失活状态_inactive置为true 递归执行子组件的deactivated钩子
// direct用来指定当前是否已经挂载 没有挂载不需要执行失活钩子
export function deactivateChildComponent(vm: Component, direct?: boolean) {
  if (direct) {
    vm._directInactive = true;
    if (isInInactiveTree(vm)) {
      return;
    }
  }

  if (!vm._inactive) {
    vm._inactive = true;
    for (let i = 0; i < vm.$children.length; i++) {
      deactivateChildComponent(vm.$children[i]);
    }
    callHook(vm, "deactivated");
  }
}

// 根据传过来的生命周期字符串 遍历执行 声明周期钩子
export function callHook(vm: Component, hook: string) {
  // #7573 disable dep collection when invoking lifecycle hooks
  pushTarget();
  const handlers = vm.$options[hook];
  const info = `${hook} hook`;
  if (handlers) {
    for (let i = 0, j = handlers.length; i < j; i++) {
      invokeWithErrorHandling(handlers[i], vm, null, vm, info);
    }
  }
  if (vm._hasHookEvent) {
    vm.$emit("hook:" + hook);
  }
  popTarget();
}
