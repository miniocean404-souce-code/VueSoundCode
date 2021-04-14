/* @flow */

import config from "core/config";
import {cached, warn} from "core/util/index";
import {mark, measure} from "core/util/perf"; //perf：性能 measure：措施
import {query} from "./util/index";

import Vue from "./runtime/index";

import {compileToFunctions} from "./compiler/index";
import {shouldDecodeNewlines, shouldDecodeNewlinesForHref,} from "./util/compat";

// todo 根据挂载ID进行查找
const idToTemplate = cached((id) => {
  const el = query(id);
  return el && el.innerHTML;
});

// todo 缓存runtime.index的$mount
const mount = Vue.prototype.$mount;

// !挂载
// !1、调用原生dom进行查找el
// !2、如果是body或者dom元素及弹出警告
// !3、如果没有render函数，分解template或者el转换成template函数 3.1 如果是el写了，获取html作为节点作为template
// !4、最后调用公共的$mount方法进行挂载
Vue.prototype.$mount = function (
  el?: string | Element,
  hydrating?: boolean
): Component {

  // todo 调用原生dom进行查找el
  el = el && query(el);

  /* istanbul ignore if */
  // todo 如果是body或者dom元素及弹出警告
  if (el === document.body || el === document.documentElement) {
    process.env.NODE_ENV !== "production" &&
    warn(
      // todo 不要挂载vue到html or body 中，而是用正确的元素替换
      `Do not mount Vue to <html> or <body> - mount to normal elements instead.`
    );
    return this;
  }

  //todo  将option缓存变量中
  const options = this.$options;

  //解析template或者el并转换为渲染功能
  // todo 如果没有render函数，分解template或者el转换成template函数
  if (!options.render) {
    let template = options.template;
    if (template) {

      if (typeof template === "string") {
        if (template.charAt(0) === "#") {
          // todo 通过获取的ID
          template = idToTemplate(template);

          // todo  警告
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
      } else if (template.nodeType) {
        template = template.innerHTML;
      } else {
        if (process.env.NODE_ENV !== "production") {
          warn("invalid template option:" + template, this);
        }
        return this;
      }
    }
    // todo 如果是el写了，获取html作为节点作为template
    else if (el) {
      template = getOuterHTML(el);
    }

    // ! 编译相关
    if (template) {
      // todo 标记节点
      if (process.env.NODE_ENV !== "production" && config.performance && mark) {
        mark("compile");
      }

      const {render, staticRenderFns} = compileToFunctions(
        template,
        {
          outputSourceRange: process.env.NODE_ENV !== "production",
          shouldDecodeNewlines,
          shouldDecodeNewlinesForHref,
          delimiters: options.delimiters,
          comments: options.comments,
        },
        this
      );
      options.render = render;
      options.staticRenderFns = staticRenderFns;

      /* istanbul ignore if */
      if (process.env.NODE_ENV !== "production" && config.performance && mark) {
        mark("compile end");
        measure(`vue ${this._name} compile`, "compile", "compile end");
      }
    }
  }
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
    // todo 创建div将元素el深度克隆后挂载div上
    const container = document.createElement("div");
    container.appendChild(el.cloneNode(true)); //克隆后代节点
    return container.innerHTML;
  }
}

Vue.compile = compileToFunctions;

export default Vue;
