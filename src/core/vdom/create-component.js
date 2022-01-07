/* @flow */

import VNode from "./vnode";
import { resolveConstructorOptions } from "core/instance/init";
import { queueActivatedComponent } from "core/observer/scheduler";
import { createFunctionalComponent } from "./create-functional-component";

import { isDef, isObject, isTrue, isUndef, warn } from "../util/index";

import {
  createAsyncPlaceholder,
  extractPropsFromVNodeData,
  resolveAsyncComponent
} from "./helpers/index";

import {
  activateChildComponent,
  activeInstance,
  callHook,
  deactivateChildComponent,
  updateChildComponent
} from "../instance/lifecycle";

import {
  isRecyclableComponent,
  renderRecyclableComponentTemplate
} from "weex/runtime/recycle-list/render-component-template";

// inline hooks to be invoked on component VNodes during patch

// 继承大Vue及其option，安装组件钩子，创建组件占位符VNode
export function createComponent(
  Ctor: Class<Component> | Function | Object | void,
  data: ?VNodeData,
  context: Component,
  children: ?Array<VNode>,
  tag?: string
): VNode | Array<VNode> | void {
  if (isUndef(Ctor)) {
    return;
  }

  // 取到大构造函数Vue，并继承构造函数(在core\global-api\index.js中)
  const baseCtor = context.$options._base;
  if (isObject(Ctor)) {
    Ctor = baseCtor.extend(Ctor);
  }
  // 如果继承之后不是组件构造函数就报警告：无效的组件
  if (typeof Ctor !== "function") {
    if (process.env.NODE_ENV !== "production") {
      warn(`Invalid Component definition: ${String(Ctor)}`, context);
    }
    return;
  }

  let asyncFactory;
  if (isUndef(Ctor.cid)) {
    asyncFactory = Ctor;
    // 解析成异步组件构造函数
    Ctor = resolveAsyncComponent(asyncFactory, baseCtor);
    if (Ctor === undefined) {
      // 为异步组件返回一个占位符节点，该节点呈现为注释节点，但保留该节点的所有原始信息。该信息将用于异步服务器渲染和水化
      return createAsyncPlaceholder(asyncFactory, data, context, children, tag);
    }
  }

  data = data || {};

  // 解析构造函数选项，继承mixin等选项的继承
  resolveConstructorOptions(Ctor);
  // 将组件v-model 数据转换为 props 和 events transform component v-model data into props & events
  if (isDef(data.model)) {
    transformModel(Ctor.options, data);
  }
  // 提取 props
  const propsData = extractPropsFromVNodeData(data, Ctor, tag);

  // 创建函数性组件
  if (isTrue(Ctor.options.functional)) {
    return createFunctionalComponent(Ctor, propsData, data, context, children);
  }

  // 自定义事件 -- 提取侦听器，因为这些侦听器需要被视为子组件侦听器，而不是DOM侦听器  extract listeners, since these needs to be treated as
  // child component listeners instead of DOM listeners
  const listeners = data.on;
  // 用.native修饰符替换为侦听器，以便在父组件补丁期间对其进行处理 replace with listeners with .native modifier
  // so it gets processed during parent component patch.
  data.on = data.nativeOn;

  if (isTrue(Ctor.options.abstract)) {
    // 抽象组件除了保留prop，监听器和插槽之外，不保留其他任何东西
    // work around flow
    const slot = data.slot;
    data = {};
    if (slot) {
      data.slot = slot;
    }
  }

  //*  将组件钩子安装到组件节点上
  installComponentHooks(data);

  // * 创建一个组件占位符vnode
  const name = Ctor.options.name || tag;
  const vnode = new VNode(
    `vue-component-${Ctor.cid}${name ? `-${name}` : ""}`,
    data,
    undefined,
    undefined,
    undefined,
    context,
    { Ctor, propsData, listeners, tag, children },
    asyncFactory
  );

  // Weex specific: invoke recycle-list optimized @render function for
  // extracting cell-slot template.
  // https://github.com/Hanks10100/weex-native-directive/tree/master/component
  /* istanbul ignore if */
  if (__WEEX__ && isRecyclableComponent(vnode)) {
    return renderRecyclableComponentTemplate(vnode);
  }

  return vnode;
}

/**
 * @描述 返回当前占位符vnode的构造函数，执行init
 * @作者 HY
 * @时间 2021-06-27 20:14
 */
export function createComponentInstanceForVnode(
  // we know it's MountedComponentVNode but flow doesn't
  vnode: any,
  // activeInstance in lifecycle state
  parent: any
): Component {
  // * 缓存当前组件和当前组件的挂载的真实DOM 比如App组件和#app
  const options: InternalComponentOptions = {
    _isComponent: true,
    _parentVnode: vnode, //占位符（组件）VNode
    parent // 其父实例 当前激活的实例
  };
  // 检查内联模板渲染功能 check inline-template render functions
  const inlineTemplate = vnode.data.inlineTemplate;
  if (isDef(inlineTemplate)) {
    options.render = inlineTemplate.render;
    options.staticRenderFns = inlineTemplate.staticRenderFns;
  }

  // * 对当前实例化的子组件对象 调用sub函数中的_init进行初始化，并且初始化的this指向当前组件的构造函数对象 当前：App 子：App内部组件
  return new vnode.componentOptions.Ctor(options);
}

/**
 * @描述 组件专用钩子
 * @作者 HY
 * @时间 2021-06-27 19:48
 */
const componentVNodeHooks = {
  init(vnode: VNodeWithData, hydrating: boolean): ?boolean {
    // ! keep-alive逻辑
    if (
      vnode.componentInstance &&
      !vnode.componentInstance._isDestroyed &&
      vnode.data.keepAlive
    ) {
      // kept-alive components, treat as a patch
      const mountedNode: any = vnode; // work around flow
      componentVNodeHooks.prepatch(mountedNode, mountedNode);
    } else {
      // * 把当前的vnode和正在活跃的实例传入 比如 App组件和#app 元素 返回给Vnode的componentInstance
      // * 初始化当前子组件的实例对象（new 时候创建了一个对象）给child,最后进行挂载
      const child = (vnode.componentInstance = createComponentInstanceForVnode(
        vnode,
        activeInstance
      ));

      // * 组件真正挂载(因为组件没有el)
      child.$mount(hydrating ? vnode.elm : undefined, hydrating);
    }
  },

  prepatch(oldVnode: MountedComponentVNode, vnode: MountedComponentVNode) {
    const options = vnode.componentOptions;
    const child = (vnode.componentInstance = oldVnode.componentInstance);
    updateChildComponent(
      child,
      options.propsData, // updated props
      options.listeners, // updated listeners
      vnode, // new parent vnode
      options.children // new children
    );
  },

  insert(vnode: MountedComponentVNode) {
    const { context, componentInstance } = vnode;
    if (!componentInstance._isMounted) {
      componentInstance._isMounted = true;
      callHook(componentInstance, "mounted");
    }
    if (vnode.data.keepAlive) {
      if (context._isMounted) {
        // vue-router#1212
        // During updates, a kept-alive component's child components may
        // change, so directly walking the tree here may call activated hooks
        // on incorrect children. Instead we push them into a queue which will
        // be processed after the whole patch process ended.
        queueActivatedComponent(componentInstance);
      } else {
        activateChildComponent(componentInstance, true /* direct */);
      }
    }
  },

  destroy(vnode: MountedComponentVNode) {
    const { componentInstance } = vnode;
    if (!componentInstance._isDestroyed) {
      if (!vnode.data.keepAlive) {
        componentInstance.$destroy();
      } else {
        deactivateChildComponent(componentInstance, true /* direct */);
      }
    }
  }
};

// !获取组件钩子的数组
const hooksToMerge = Object.keys(componentVNodeHooks);

// 将钩子合并到data中，返回合并后的函数，调用时候回顺序执行，并且定义_merged
function installComponentHooks(data: VNodeData) {
  const hooks = data.hook || (data.hook = {});
  for (let i = 0; i < hooksToMerge.length; i++) {
    const key = hooksToMerge[i];
    const existing = hooks[key];
    const toMerge = componentVNodeHooks[key];
    // * 如果不相等，并且不存在 就将data.hook = {} 中挂载钩子
    if (existing !== toMerge && !(existing && existing._merged)) {
      hooks[key] = existing ? mergeHook(toMerge, existing) : toMerge;
    }
  }
}

function mergeHook(f1: any, f2: any): Function {
  const merged = (a, b) => {
    // flow complains about extra args which is why we use any
    f1(a, b);
    f2(a, b);
  };
  merged._merged = true;
  return merged;
}

// 将组件 v-model 信息（值和回调）分别转换为 prop 和事件处理程序
function transformModel(options, data: any) {
  const prop = (options.model && options.model.prop) || "value";
  const event = (options.model && options.model.event) || "input";
  (data.attrs || (data.attrs = {}))[prop] = data.model.value;
  const on = data.on || (data.on = {});
  const existing = on[event];
  const callback = data.model.callback;
  if (isDef(existing)) {
    if (
      Array.isArray(existing)
        ? existing.indexOf(callback) === -1
        : existing !== callback
    ) {
      on[event] = [callback].concat(existing);
    }
  } else {
    on[event] = callback;
  }
}
