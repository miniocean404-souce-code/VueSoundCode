/* @flow */
/* globals MutationObserver */

import { noop } from "shared/util";
import { handleError } from "./error";
import { isIE, isIOS, isNative } from "./env";

export let isUsingMicroTask = false;

const callbacks = [];
let pending = false;

function flushCallbacks() {
  pending = false;
  const copies = callbacks.slice(0);
  callbacks.length = 0;
  for (let i = 0; i < copies.length; i++) {
    copies[i]();
  }
}

// Here we have async deferring wrappers using microtasks.
// In 2.5 we used (macro) tasks (in combination with microtasks).
// However, it has subtle problems when state is changed right before repaint
// (e.g. #6813, out-in transitions).
// Also, using (macro) tasks in event handler would cause some weird behaviors
// that cannot be circumvented (e.g. #7109, #7153, #7546, #7834, #8109).
// So we now use microtasks everywhere, again.
// A major drawback of this tradeoff is that there are some scenarios
// where microtasks have too high a priority and fire in between supposedly
// sequential events (e.g. #4521, #6690, which have workarounds)
// or even between bubbling of the same event (#6566).
let timerFunc;

// The nextTick behavior leverages the microtask queue, which can be accessed
// via either native Promise.then or MutationObserver.
// MutationObserver has wider support, however it is seriously bugged in
// UIWebView in iOS >= 9.3.3 when triggered in touch event handlers. It
// completely stops working after triggering a few times... so, if native
// Promise is available, we will use it:
/* istanbul ignore next, $flow-disable-line */
if (typeof Promise !== "undefined" && isNative(Promise)) {
  const p = Promise.resolve();
  timerFunc = () => {
    // * 还原callbacks、pending状态，并且执行callbacks每个回调函数
    p.then(flushCallbacks);
    // 在有问题的 UIWebViews 中，
    // Promise.then 并没有完全中断，但它可能会陷入一种奇怪的状态，
    // 即回调被推入微任务队列但队列没有被刷新，
    // 直到浏览器需要做一些其他工作，例如处理计时器。
    // 因此，我们可以通过添加一个空计时器来“强制”刷新微任务队列
    // * ios强制刷新微任务队列
    if (isIOS) setTimeout(noop);
  };
  isUsingMicroTask = true;
} else if (
  !isIE &&
  typeof MutationObserver !== "undefined" &&
  (isNative(MutationObserver) ||
    // PhantomJS and iOS 7.x
    MutationObserver.toString() === "[object MutationObserverConstructor]")
) {
  // Use MutationObserver where native Promise is not available,
  // e.g. PhantomJS, iOS7, Android 4.4
  // (#6466 MutationObserver is unreliable in IE11)
  let counter = 1;
  const observer = new MutationObserver(flushCallbacks);
  const textNode = document.createTextNode(String(counter));
  observer.observe(textNode, {
    characterData: true
  });
  timerFunc = () => {
    counter = (counter + 1) % 2;
    textNode.data = String(counter);
  };
  isUsingMicroTask = true;
} else if (typeof setImmediate !== "undefined" && isNative(setImmediate)) {
  // Fallback to setImmediate.
  // Technically it leverages the (macro) task queue,
  // but it is still a better choice than setTimeout.
  timerFunc = () => {
    // * 如果支持setImmediate使用setImmediate刷新队列并执行
    setImmediate(flushCallbacks);
  };
} else {
  // * 如果支持setTimeout使用setTimeout刷新队列并执行
  timerFunc = () => {
    setTimeout(flushCallbacks, 0);
  };
}

/**
 * @描述
 * @作者 HY
 * @时间 2021-07-04 17:29
 */
export function nextTick(cb?: Function, ctx?: Object) {
  let _resolve;
  // * 在全局callbacks数组中添加回调函数，如果是cb就储存cb,否则使用Promise
  callbacks.push(() => {
    if (cb) {
      try {
        cb.call(ctx);
      } catch (e) {
        handleError(e, ctx, "nextTick");
      }
    } else if (_resolve) {
      _resolve(ctx);
    }
  });

  // * 不是代办状态就根据当前环境能使用的方法赋值给timerFunc，并且让其初始化队列，并执行队列中的回调函数
  if (!pending) {
    pending = true;
    timerFunc();
  }

  // * 没有回调函数就将res函数赋值给局部变量_resolve，让他去解决
  if (!cb && typeof Promise !== "undefined") {
    return new Promise(resolve => {
      _resolve = resolve;
    });
  }
}
