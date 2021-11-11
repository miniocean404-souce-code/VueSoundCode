/* @flow */

import type { SimpleSet } from "../util/index";
import {
  _Set as Set,
  handleError,
  isObject,
  noop,
  parsePath,
  remove,
  warn
} from "../util/index";

import { traverse } from "./traverse";
import { queueWatcher } from "./scheduler";
import Dep, { popTarget, pushTarget } from "./dep";

let uid = 0;

/**
 * A watcher parses an expression, collects dependencies,
 * and fires callback when the expression value changes.
 * This is used for both the $watch() api and directives.
 */
// !订阅者模式
export default class Watcher {
  vm: Component;
  expression: string;
  cb: Function;
  id: number;
  deep: boolean;
  user: boolean;
  lazy: boolean;
  sync: boolean;
  dirty: boolean;
  active: boolean;
  deps: Array<Dep>;
  newDeps: Array<Dep>;
  depIds: SimpleSet;
  newDepIds: SimpleSet;
  before: ?Function;
  getter: Function;
  value: any;

  constructor(
    vm: Component,
    expOrFn: string | Function,
    cb: Function,
    options?: ?Object,
    isRenderWatcher?: boolean
  ) {
    this.vm = vm;

    // * 渲染watcher就缓存this
    if (isRenderWatcher) {
      vm._watcher = this;
    }
    // * 在所有的watcher中添加this
    vm._watchers.push(this);

    // * 获取传递的选项，没传递就全部置为false
    // options
    if (options) {
      this.deep = !!options.deep;
      this.user = !!options.user;
      this.lazy = !!options.lazy;
      this.sync = !!options.sync;
      this.before = options.before;
    } else {
      this.deep = this.user = this.lazy = this.sync = false;
    }

    this.cb = cb;
    this.id = ++uid; // uid for batching
    this.active = true;
    this.dirty = this.lazy; // for lazy watchers 初始化computed dirty为true
    this.deps = []; //旧的watch队列
    this.newDeps = []; //新的watch队列
    this.depIds = new Set(); //旧的不重复的watch id
    this.newDepIds = new Set(); //新的不重复的watch id
    this.expression =
      process.env.NODE_ENV !== "production" //传递的getter函数解析字符串
        ? expOrFn.toString()
        : "";

    // * 将函数updateComponent赋值给 getter
    if (typeof expOrFn === "function") {
      this.getter = expOrFn;
    } else {
      // * 将表达式解析传递给getter，解析失败就置空、报错
      this.getter = parsePath(expOrFn);
      if (!this.getter) {
        this.getter = noop;
        process.env.NODE_ENV !== "production" &&
          warn(
            `Failed watching path: "${expOrFn}" ` +
              "Watcher only accepts simple dot-delimited paths. " +
              "For full control, use a function instead.",
            vm
          );
      }
    }

    // * 获取value，如果是computed就是undefined ， 否则就执行get
    this.value = this.lazy ? undefined : this.get();
  }

  /**
   * @描述 压栈，获取updateComponent的值触发setter函数，并返回
   * @作者 HY
   * @时间 2021-07-04 17:10
   */
  get() {
    pushTarget(this);
    let value;
    const vm = this.vm;
    try {
      // * 实际上是调用 updateComponent 方法,因为updateComponent 赋值给了 getter
      value = this.getter.call(vm, vm);
    } catch (e) {
      if (this.user) {
        handleError(e, vm, `getter for watcher "${this.expression}"`);
      } else {
        throw e;
      }
    } finally {
      // "touch" every property so they are all tracked as
      // dependencies for deep watching
      if (this.deep) {
        // * 执行getter
        traverse(value);
      }
      popTarget();
      this.cleanupDeps();
    }
    return value;
  }

  /**
   * @描述 添加依赖项
   * @作者 HY
   * @时间 2021-07-04 16:31
   */
  addDep(dep: Dep) {
    const id = dep.id;
    if (!this.newDepIds.has(id)) {
      // * 如果不存在就添加到这个set id集合中，添加到newDeps对象中
      this.newDepIds.add(id);
      this.newDeps.push(dep);
      if (!this.depIds.has(id)) {
        // * depIds没有这个id就push进dep数组中
        dep.addSub(this);
      }
    }
  }

  /**
   * Subscriber interface.
   * Will be called when a dependency changes.
   */
  update() {
    /* istanbul ignore else */
    if (this.lazy) {
      this.dirty = true;
    } else if (this.sync) {
      this.run();
    } else {
      // *
      queueWatcher(this);
    }
  }

  /**
   * Clean up for dependency collection.
   */
  cleanupDeps() {
    let i = this.deps.length;
    while (i--) {
      const dep = this.deps[i];
      if (!this.newDepIds.has(dep.id)) {
        dep.removeSub(this);
      }
    }
    let tmp = this.depIds;
    this.depIds = this.newDepIds;
    this.newDepIds = tmp;
    this.newDepIds.clear();
    tmp = this.deps;
    this.deps = this.newDeps;
    this.newDeps = tmp;
    this.newDeps.length = 0;
  }

  /**
   * @描述 调用run让返回watch的值
   * @作者 HY
   * @时间 2021-07-04 16:47
   */
  run() {
    if (this.active) {
      // * 通过updateComponent获取更新的value
      const value = this.get();
      if (
        value !== this.value ||
        // * 即使值相同，深度观察者和 Object/Arrays 上的观察者也应该触发，因为该值可能已经发生了变化。
        isObject(value) ||
        this.deep
      ) {
        const oldValue = this.value;
        this.value = value;

        // * user是用户手写的watch标志
        if (this.user) {
          try {
            this.cb.call(this.vm, value, oldValue);
          } catch (e) {
            handleError(
              e,
              this.vm,
              `callback for watcher "${this.expression}"`
            );
          }
        } else {
          this.cb.call(this.vm, value, oldValue);
        }
      }
    }
  }

  /**
   * Evaluate the value of the watcher.
   * This only gets called for lazy watchers.
   */
  evaluate() {
    this.value = this.get();
    this.dirty = false;
  }

  /**
   * Depend on all deps collected by this watcher.
   */
  depend() {
    let i = this.deps.length;
    while (i--) {
      this.deps[i].depend();
    }
  }

  /**
   * Remove self from all dependencies' subscriber list.
   */
  teardown() {
    if (this.active) {
      // remove self from vm's watcher list
      // this is a somewhat expensive operation so we skip it
      // if the vm is being destroyed.
      if (!this.vm._isBeingDestroyed) {
        remove(this.vm._watchers, this);
      }
      let i = this.deps.length;
      while (i--) {
        this.deps[i].removeSub(this);
      }
      this.active = false;
    }
  }
}
