/*
 * not type checking this file because flow doesn't play well with
 * dynamically accessing methods on Array prototype
 */

import { def } from "../util/index";

// * 获取数组原型链上的方法，并且克隆一份
const arrayProto = Array.prototype;
export const arrayMethods = Object.create(arrayProto);

const methodsToPatch = [
  "push",
  "pop",
  "shift",
  "unshift",
  "splice",
  "sort",
  "reverse"
];

/**
 * @描述 拦截变异方法并发出事件
 * @作者 HY
 * @时间 2021-07-04 15:12
 */
methodsToPatch.forEach(function(method) {
  // * 缓存原来的方法
  const original = arrayProto[method];

  // * 将原型链的每个方法定义成变异方法
  def(arrayMethods, method, function mutator(...args) {
    // * 用原生方法获得结果并返回，再将获取的参数都设置成响应式的对象，并通知修改
    const result = original.apply(this, args);
    const ob = this.__ob__;
    let inserted;
    switch (method) {
      case "push":
      case "unshift":
        inserted = args;
        break;
      case "splice":
        inserted = args.slice(2);
        break;
    }
    if (inserted) ob.observeArray(inserted);
    // notify change
    ob.dep.notify();
    return result;
  });
});
