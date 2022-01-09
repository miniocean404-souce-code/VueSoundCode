/* @flow */

import config from "../config";
import VNode, { createEmptyVNode } from "./vnode";
import { createComponent } from "./create-component";
import { traverse } from "../observer/traverse";

import {
  isDef,
  isObject,
  isPrimitive,
  isTrue,
  isUndef,
  resolveAsset,
  warn
} from "../util/index";

import { normalizeChildren, simpleNormalizeChildren } from "./helpers/index";

// * 简单Vnode 复杂Vnode
const SIMPLE_NORMALIZE = 1;
const ALWAYS_NORMALIZE = 2;

// wrapper function for providing a more flexible interface 包装器功能，用于提供更灵活的界面
// without getting yelled at by flow 不会被流程大吼大叫

// 将参数一致性处理，声明统一化标准，闭包调用_createElement
export function createElement(
  context: Component,
  tag: any,
  data: any,
  children: any,
  normalizationType: any, //以什么方式进行统一化
  alwaysNormalize: boolean //是否是用户手写的render
): VNode | Array<VNode> {
  // * 参数不一致进行一致性处理（位置转换）
  if (Array.isArray(data) || isPrimitive(data)) {
    normalizationType = children;
    children = data;
    data = undefined;
  }

  if (isTrue(alwaysNormalize)) {
    normalizationType = ALWAYS_NORMALIZE;
  }
  return _createElement(context, tag, data, children, normalizationType);
}

// 对子节点进行磨平、合并,根据情况生成元素VNode或者组件VNode
export function _createElement(
  context: Component,
  tag?: string | Class<Component> | Function | Object,
  data?: VNodeData,
  children?: any,
  normalizationType?: number
): VNode | Array<VNode> {
  // 响应式数据进行警告，返回空Vnode
  if (isDef(data) && isDef((data: any).__ob__)) {
    process.env.NODE_ENV !== "production" &&
      warn(
        `Avoid using observed data object as vnode data: ${JSON.stringify(
          data
        )}\n` + "Always create fresh vnode data objects in each render!",
        context
      );
    return createEmptyVNode();
  }

  // v-bind中的对象语法 object syntax in v-bind
  if (isDef(data) && isDef(data.is)) {
    tag = data.is;
  }

  //* tag不存在创建空VNode
  if (!tag) {
    return createEmptyVNode();
  }

  // 警告非原始密钥 warn against non-primitive key
  if (
    process.env.NODE_ENV !== "production" &&
    isDef(data) &&
    isDef(data.key) &&
    !isPrimitive(data.key)
  ) {
    if (!__WEEX__ || !("@binding" in data.key)) {
      warn(
        "Avoid using non-primitive value as key, " +
          "use string/number value instead.",
        context
      );
    }
  }
  // 支持单功能子级作为默认作用域插槽 support single function children as default scoped slot
  if (Array.isArray(children) && typeof children[0] === "function") {
    data = data || {};
    data.scopedSlots = { default: children[0] };
    children.length = 0;
  }

  // 对子节点进行磨平、合并
  if (normalizationType === ALWAYS_NORMALIZE) {
    children = normalizeChildren(children);
  } else if (normalizationType === SIMPLE_NORMALIZE) {
    children = simpleNormalizeChildren(children);
  }

  let vnode, ns;
  if (typeof tag === "string") {
    let Ctor;
    // 元素为保留标签就报警告
    ns = (context.$vnode && context.$vnode.ns) || config.getTagNamespace(tag);
    // :native
    if (config.isReservedTag(tag)) {
      if (
        process.env.NODE_ENV !== "production" &&
        isDef(data) &&
        isDef(data.nativeOn)
      ) {
        warn(
          `The .native modifier for v-on is only valid on components but it was used on <${tag}>.`,
          context
        );
      }
      vnode = new VNode(
        config.parsePlatformTagName(tag),
        data,
        children,
        undefined,
        undefined,
        context
      );
    }
    //* 如果没有数据或者没有VPre & 有这个标签的的Vue对象就创建提前内部定义的组件VNode
    else if (
      (!data || !data.pre) &&
      isDef((Ctor = resolveAsset(context.$options, "components", tag)))
    ) {
      vnode = createComponent(Ctor, data, context, children, tag);
    } else {
      // 创建元素VNode
      vnode = new VNode(tag, data, children, undefined, undefined, context);
    }
  } else {
    // 如果是个组件对象就创建组件VNode(例如h(App)) .vue文件中的组件
    vnode = createComponent(tag, data, context, children);
  }

  // 返回VNode
  if (Array.isArray(vnode)) {
    return vnode;
  } else if (isDef(vnode)) {
    if (isDef(ns)) applyNS(vnode, ns);
    if (isDef(data)) registerDeepBindings(data);
    return vnode;
  } else {
    return createEmptyVNode();
  }
}

function applyNS(vnode, ns, force) {
  vnode.ns = ns;
  if (vnode.tag === "foreignObject") {
    // use default namespace inside foreignObject
    ns = undefined;
    force = true;
  }
  if (isDef(vnode.children)) {
    for (let i = 0, l = vnode.children.length; i < l; i++) {
      const child = vnode.children[i];
      if (
        isDef(child.tag) &&
        (isUndef(child.ns) || (isTrue(force) && child.tag !== "svg"))
      ) {
        applyNS(child, ns, force);
      }
    }
  }
}

// ref #5318
// necessary to ensure parent re-render when deep bindings like :style and
// :class are used on slot nodes
function registerDeepBindings(data) {
  if (isObject(data.style)) {
    traverse(data.style);
  }
  if (isObject(data.class)) {
    traverse(data.class);
  }
}
