/* @flow */

import type Watcher from "./watcher";
import { remove } from "../util/index";
import config from "../config";

let uid = 0;

/**
 * @描述 dep是可以观察的，可以有多个指令订阅它
 * @作者 HY
 * @时间 2021-07-04 16:00
 */
export default class Dep {
  static target: ?Watcher;
  id: number;
  subs: Array<Watcher>;

  // * 为每个dep对象定义一个id 和 subs数组（数组中为了添加对象的Watcher订阅者）
  constructor() {
    this.id = uid++;
    this.subs = [];
  }

  // * 添加每个Watcher对象到subs中
  addSub(sub: Watcher) {
    this.subs.push(sub);
  }

  // * 删除每个Watcher对象
  removeSub(sub: Watcher) {
    remove(this.subs, sub);
  }

  // * 调用Watcher添加
  depend() {
    if (Dep.target) {
      Dep.target.addDep(this);
    }
  }

  notify() {
    // stabilize the subscriber list first
    const subs = this.subs.slice();
    if (process.env.NODE_ENV !== "production" && !config.async) {
      // subs aren't sorted in scheduler if not running async
      // we need to sort them now to make sure they fire in correct
      // order
      subs.sort((a, b) => a.id - b.id);
    }
    for (let i = 0, l = subs.length; i < l; i++) {
      subs[i].update();
    }
  }
}

// The current target watcher being evaluated.
// This is globally unique because only one watcher
// can be evaluated at a time.
Dep.target = null;
const targetStack = [];

export function pushTarget(target: ?Watcher) {
  targetStack.push(target);
  Dep.target = target;
}

export function popTarget() {
  targetStack.pop();
  Dep.target = targetStack[targetStack.length - 1];
}
