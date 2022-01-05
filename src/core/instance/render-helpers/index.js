/* @flow */

import { toNumber, toString, looseEqual, looseIndexOf } from 'shared/util'
import { createTextVNode, createEmptyVNode } from 'core/vdom/vnode'
import { renderList } from './render-list'
import { renderSlot } from './render-slot'
import { resolveFilter } from './resolve-filter'
import { checkKeyCodes } from './check-keycodes'
import { bindObjectProps } from './bind-object-props'
import { renderStatic, markOnce } from './render-static'
import { bindObjectListeners } from './bind-object-listeners'
import { resolveScopedSlots } from './resolve-scoped-slots'
import { bindDynamicKeys, prependModifier } from './bind-dynamic-keys'

// render函数中编译后的函数
// _c 就是执行createElement 去创建 VNode
export function installRenderHelpers (target: any) {
  target._o = markOnce // 标记渲染一次
  target._n = toNumber
  target._s = toString
  target._l = renderList // 渲染列表
  target._t = renderSlot // 渲染插槽
  target._q = looseEqual
  target._i = looseIndexOf
  target._m = renderStatic // 渲染静态节点
  target._f = resolveFilter
  target._k = checkKeyCodes
  target._b = bindObjectProps
  target._v = createTextVNode // 文本VNode
  target._e = createEmptyVNode // 空VNode
  target._u = resolveScopedSlots
  target._g = bindObjectListeners
  target._d = bindDynamicKeys
  target._p = prependModifier
}
