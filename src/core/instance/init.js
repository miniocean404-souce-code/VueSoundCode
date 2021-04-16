/* @flow */
import config from '../config'
import {initProxy} from './proxy'
import {initState} from './state'
import {initRender} from './render'
import {initEvents} from './events'
import {mark, measure} from '../util/perf'
import {callHook, initLifecycle} from './lifecycle'
import {initInjections, initProvide} from './inject'
import {extend, formatComponentName, mergeOptions} from '../util/index'

let uid = 0

export function initMixin(Vue: Class<Component>) {

  //!初始化(new Vue 以及 组件的初始化)
  //!1、合并选项
  //!2、初始化声明周期、事件、render函数、beforeCreate钩子、inject，Provide函数、state
  //!3、$mount挂载
  Vue.prototype._init = function (options?: Object) {
    const vm: Component = this
    // todo 每一个Vue有一个唯一的UID
    vm._uid = uid++

    let startTag, endTag
    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      startTag = `vue-perf-start:${vm._uid}`
      endTag = `vue-perf-end:${vm._uid}`
      mark(startTag)
    }

    // 避免被观察到的标志
    vm._isVue = true


    // todo 如果是组件就合并组件否则就讲new Vue的选项进行合并
    if (options && options._isComponent) {
      // 优化内部组件实例化，因为动态选项合并非常慢，并且没有内部组件选项需要特殊处理。
      // todo 初始化内部组件
      initInternalComponent(vm, options)
    } else {
      vm.$options = mergeOptions(resolveConstructorOptions(vm.constructor), options || {}, vm)
    }

    // 产生代理
    if (process.env.NODE_ENV !== 'production') {
      initProxy(vm)
    } else {
      vm._renderProxy = vm
    }

    // expose real self
    // todo 初始化声明周期、事件、render函数、beforeCreate钩子、inject，Provide函数、state
    vm._self = vm  //* 循环挂载
    initLifecycle(vm)
    initEvents(vm)
    initRender(vm)
    callHook(vm, 'beforeCreate')
    initInjections(vm) // resolve injections before data/props
    initState(vm)
    initProvide(vm) // resolve provide after data/props
    callHook(vm, 'created')

    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      vm._name = formatComponentName(vm, false)
      mark(endTag)
      measure(`vue ${vm._name} init`, startTag, endTag)
    }

    // todo 如果有el就通过el进行挂载
    if (vm.$options.el) {
      vm.$mount(vm.$options.el)
    }
  }
}

// !初始化内部组件
// !1、克隆一份option给当前Vue实例、父组件给parent、父Vnode实例给_parentVnode
// !2、父Vnode的组件选项给当前的Vue实例
// !3、当前render存在就赋值给当前的Vue
export function initInternalComponent(vm: Component, options: InternalComponentOptions) {
  const opts = vm.$options = Object.create(vm.constructor.options)
  // doing this because it's faster than dynamic enumeration. 这样做是因为它比动态枚举要快。
  const parentVnode = options._parentVnode
  opts.parent = options.parent
  opts._parentVnode = parentVnode

  //todo 赋值父的数据给构造函数opts
  const vnodeComponentOptions = parentVnode.componentOptions
  opts.propsData = vnodeComponentOptions.propsData
  opts._parentListeners = vnodeComponentOptions.listeners
  opts._renderChildren = vnodeComponentOptions.children
  opts._componentTag = vnodeComponentOptions.tag

  if (options.render) {
    opts.render = options.render
    opts.staticRenderFns = options.staticRenderFns
  }
}

// ? 解析构造函数选项
export function resolveConstructorOptions(Ctor: Class<Component>) {
  let options = Ctor.options
  if (Ctor.super) {
    const superOptions = resolveConstructorOptions(Ctor.super)
    const cachedSuperOptions = Ctor.superOptions
    if (superOptions !== cachedSuperOptions) {
      // super option changed,
      // need to resolve new options.
      Ctor.superOptions = superOptions
      // check if there are any late-modified/attached options (#4976)
      const modifiedOptions = resolveModifiedOptions(Ctor)
      // update base extend options
      if (modifiedOptions) {
        extend(Ctor.extendOptions, modifiedOptions)
      }
      options = Ctor.options = mergeOptions(superOptions, Ctor.extendOptions)
      if (options.name) {
        options.components[options.name] = Ctor
      }
    }
  }
  return options
}

// ? 解决修改的选项
function resolveModifiedOptions(Ctor: Class<Component>): ?Object {
  let modified
  const latest = Ctor.options
  const sealed = Ctor.sealedOptions
  for (const key in latest) {
    if (latest[key] !== sealed[key]) {
      if (!modified) modified = {}
      modified[key] = latest[key]
    }
  }
  return modified
}
