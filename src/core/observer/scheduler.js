/* @flow */

import type Watcher from "./watcher";
import config from "../config";
import { callHook, activateChildComponent } from "../instance/lifecycle";

import { warn, nextTick, devtools, inBrowser, isIE } from "../util/index";

export const MAX_UPDATE_COUNT = 100;

const queue: Array<Watcher> = [];
const activatedChildren: Array<Component> = [];
let has: { [key: number]: ?true } = {};
let circular: { [key: number]: number } = {};
let waiting = false;
let flushing = false;
let index = 0;

/**
 * Reset the scheduler's state.
 */
function resetSchedulerState() {
  index = queue.length = activatedChildren.length = 0;
  has = {};
  if (process.env.NODE_ENV !== "production") {
    circular = {};
  }
  waiting = flushing = false;
}

// Async edge case #6566 requires saving the timestamp when event listeners are
// attached. However, calling performance.now() has a perf overhead especially
// if the page has thousands of event listeners. Instead, we take a timestamp
// every time the scheduler flushes and use that for all event listeners
// attached during that flush.
export let currentFlushTimestamp = 0;

// Async edge case fix requires storing an event listener's attach timestamp.
let getNow: () => number = Date.now;

// Determine what event timestamp the browser is using. Annoyingly, the
// timestamp can either be hi-res (relative to page load) or low-res
// (relative to UNIX epoch), so in order to compare time we have to use the
// same timestamp type when saving the flush timestamp.
// All IE versions use low-res event timestamps, and have problematic clock
// implementations (#9632)
if (inBrowser && !isIE) {
  const performance = window.performance;
  if (
    performance &&
    typeof performance.now === "function" &&
    getNow() > document.createEvent("Event").timeStamp
  ) {
    // if the event timestamp, although evaluated AFTER the Date.now(), is
    // smaller than it, it means the event is using a hi-res timestamp,
    // and we need to use the hi-res version for event listener timestamps as
    // well.
    getNow = () => performance.now();
  }
}

/**
 * @描述 对queue队列排序，执行beforeUpdate钩子
 * @作者 HY
 * @时间 2021-07-04 17:15
 */
function flushSchedulerQueue() {
  currentFlushTimestamp = getNow();
  flushing = true;
  let watcher, id;

  // * 在刷新之前对队列进行排序。这确保：
  // * 1. 组件从父组件更新到子组件。 （因为父组件总是在子组件之前创建）
  // * 2. 组件的用户观察器在其渲染观察器之前运行（因为用户观察器在渲染观察器之前创建）
  // * 3. 如果在父组件的观察器运行期间组件被销毁，其观察器可以被跳过。
  queue.sort((a, b) => a.id - b.id);

  // * 不要缓存长度，因为当我们运行现有的观察者时可能会推送更多的观察者
  for (index = 0; index < queue.length; index++) {
    watcher = queue[index];

    // * 如果有before就执行beforeUpdate钩子
    if (watcher.before) {
      watcher.before();
    }

    // * 将这个watcher对应的has id置空
    id = watcher.id;
    has[id] = null;

    // * 为每个watcher的用户手写的watch回调函数赋值
    watcher.run();

    // * 当执行了 watcher.run()触发了更新，可能会在其中添加相同的id，并且下次循环还会执行watcher.run() 所以会触发无线循环更新
    if (process.env.NODE_ENV !== "production" && has[id] != null) {
      // * 将相同的这个id+1计算数量，超过最大值就触发了循环更新警告
      circular[id] = (circular[id] || 0) + 1;
      if (circular[id] > MAX_UPDATE_COUNT) {
        warn(
          "You may have an infinite update loop " +
            (watcher.user
              ? `in watcher with expression "${watcher.expression}"`
              : `in a component render function.`),
          watcher.vm
        );
        break;
      }
    }
  }

  // keep copies of post queues before resetting state
  const activatedQueue = activatedChildren.slice();
  const updatedQueue = queue.slice();

  // * 将状态重置
  resetSchedulerState();

  // 调用组件更新和激活的钩子
  callActivatedHooks(activatedQueue);
  callUpdatedHooks(updatedQueue);

  // devtool hook
  /* istanbul ignore if */
  if (devtools && config.devtools) {
    devtools.emit("flush");
  }
}

function callUpdatedHooks(queue) {
  let i = queue.length;
  while (i--) {
    const watcher = queue[i];
    const vm = watcher.vm;
    if (vm._watcher === watcher && vm._isMounted && !vm._isDestroyed) {
      callHook(vm, "updated");
    }
  }
}

/**
 * Queue a kept-alive component that was activated during patch.
 * The queue will be processed after the entire tree has been patched.
 */
export function queueActivatedComponent(vm: Component) {
  // setting _inactive to false here so that a render function can
  // rely on checking whether it's in an inactive tree (e.g. router-view)
  vm._inactive = false;
  activatedChildren.push(vm);
}

function callActivatedHooks(queue) {
  for (let i = 0; i < queue.length; i++) {
    queue[i]._inactive = true;
    activateChildComponent(queue[i], true /* true */);
  }
}

/**
 * @描述 将观察者推入观察者队列。除非在刷新队列时推送，否则将跳过具有重复 ID 的作业
 * @作者 HY
 * @时间 2021-07-04 16:37
 */
export function queueWatcher(watcher: Watcher) {
  const id = watcher.id;

  // * 全局环境设置一个对象，看有没有这个id
  if (has[id] == null) {
    has[id] = true;

    // * 如果没有刷新中就添加进去
    if (!flushing) {
      queue.push(watcher);
    } else {
      // * 如果在刷新中，则根据其 id 拼接观察者，如果已经超过其 id，它将立即运行下一个
      let i = queue.length - 1;
      while (i > index && queue[i].id > watcher.id) {
        i--;
      }
      queue.splice(i + 1, 0, watcher);
    }

    // * 不需要等待就执行nextTick
    if (!waiting) {
      waiting = true;
      if (process.env.NODE_ENV !== "production" && !config.async) {
        flushSchedulerQueue();
        return;
      }

      nextTick(flushSchedulerQueue);
    }
  }
}
