/* @flow */

import config from "core/config";
import { cached, warn } from "core/util/index";
import { mark, measure } from "core/util/perf"; //perf：性能 measure：措施
import { query } from "./util/index";

import Vue from "./runtime/index";

import { compileToFunctions } from "./compiler/index";
import {
  shouldDecodeNewlines,
  shouldDecodeNewlinesForHref
} from "./util/compat";

/**
 * @描述 根据挂载ID进行查找，将DOM的innerHTML返回
 * @作者 HY
 * @时间 2021-06-27 16:26
 */
const idToTemplate = cached(id => {
  const el = query(id);
  return el && el.innerHTML;
});

// * 缓存runtime.index的$mount
const mount = Vue.prototype.$mount;

/**
 * @描述 用于组件编译相关挂载，（是为了将函数编译为模板，然后调用mountComponent进行渲染挂载）
 * @作者 HY
 * @时间 2021-06-27 16:18
 */
Vue.prototype.$mount = function(
  el?: string | Element,
  hydrating?: boolean
): Component {
  // * 声明
  const options = this.$options;

  // * 调用原生dom进行查找el
  el = el && query(el);

  // * 如果是body或者dom元素及弹出警告
  if (el === document.body || el === document.documentElement) {
    process.env.NODE_ENV !== "production" &&
      warn(
        `Do not mount Vue to <html> or <body> - mount to normal elements instead.`
      );
    return this;
  }

  // * 如果没有手写render函数，查看template，没有template就使用el
  // ! 组件时候通过loader编译存在render函数，不走这里
  if (!options.render) {
    let template = options.template;

    if (template) {
      // * 通过template的ID进行查找，获取内部DOM，如果没有内部元素就警告
      if (typeof template === "string") {
        if (template.charAt(0) === "#") {
          template = idToTemplate(template);

          if (process.env.NODE_ENV !== "production" && !template) {
            warn(
              `Template element not found or is empty: ${options.template}`,
              this
            );
          }
        }
        // 1	一个 元素 节点，例如 <p> 和 <div>。
        // 3	Element 或者 Attr 中实际的  文字
        // 8	一个 Comment 节点。
        // 9	一个 Document 节点。
      }
      // * 通过template的nodeType进行查找，获取内部DOM
      else if (template.nodeType) {
        template = template.innerHTML;
      }
      // * 不是字符串，不是一个dom元素就警告
      else {
        if (process.env.NODE_ENV !== "production") {
          warn("invalid template option:" + template, this);
        }
        return this;
      }
    }
    // * 如果是el写了，获取html作为节点作为template
    else if (el) {
      template = getOuterHTML(el);
    }

    // ! 编译相关，将template编译成render函数，并赋值给options
    if (template) {
      // * 标记节点
      if (process.env.NODE_ENV !== "production" && config.performance && mark) {
        mark("compile");
      }

      const { render, staticRenderFns } = compileToFunctions(
        template,
        {
          outputSourceRange: process.env.NODE_ENV !== "production",
          shouldDecodeNewlines,
          shouldDecodeNewlinesForHref,
          delimiters: options.delimiters,
          comments: options.comments
        },
        this
      );
      options.render = render;
      options.staticRenderFns = staticRenderFns;

      if (process.env.NODE_ENV !== "production" && config.performance && mark) {
        mark("compile end");
        measure(`vue ${this._name} compile`, "compile", "compile end");
      }
    }
  }

  // * 利用缓存的mount进行挂载
  return mount.call(this, el, hydrating);
};

/**
 * Get outerHTML of elements, taking care
 * of SVG elements in IE as well.
 */
function getOuterHTML(el: Element): string {
  if (el.outerHTML) {
    return el.outerHTML;
  } else {
    // * 创建div将元素el深度克隆后挂载div上
    const container = document.createElement("div");
    container.appendChild(el.cloneNode(true)); //克隆后代节点
    return container.innerHTML;
  }
}

Vue.compile = compileToFunctions;

export default Vue;
