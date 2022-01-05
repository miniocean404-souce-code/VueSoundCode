/* @flow */

import { noop, extend } from "shared/util";
import { warn as baseWarn, tip } from "core/util/debug";
import { generateCodeFrame } from "./codeframe";

type CompiledFunctionResult = {
  render: Function,
  staticRenderFns: Array<Function>
};

function createFunction(code, errors) {
  try {
    return new Function(code);
  } catch (err) {
    errors.push({ err, code });
    return noop;
  }
}

// 创建将ast编译成函数的函数
export function createCompileToFunctionFn(compile: Function): Function {
  const cache = Object.create(null);

  // 将字符串编译成函数
  return function compileToFunctions(
    template: string,
    options?: CompilerOptions,
    vm?: Component
  ): CompiledFunctionResult {
    options = extend({}, options);
    const warn = options.warn || baseWarn;
    delete options.warn;

    // 检测是否可以正常生成一个函数
    /* istanbul ignore if */
    if (process.env.NODE_ENV !== "production") {
      // detect possible CSP restriction
      try {
        new Function("return 1");
      } catch (e) {
        if (e.toString().match(/unsafe-eval|CSP/)) {
          warn(
            "It seems you are using the standalone build of Vue.js in an " +
              "environment with Content Security Policy that prohibits unsafe-eval. " +
              "The template compiler cannot work in this environment. Consider " +
              "relaxing the policy to allow unsafe-eval or pre-compiling your " +
              "templates into render functions."
          );
        }
      }
    }

    // 如果存在对应的缓存就返回
    const key = options.delimiters
      ? String(options.delimiters) + template
      : template;
    if (cache[key]) {
      return cache[key];
    }

    // compile
    // !在template模板中，挂载调用的编译
    const compiled = compile(template, options);

    // 检查编译错误提示
    if (process.env.NODE_ENV !== "production") {
      if (compiled.errors && compiled.errors.length) {
        if (options.outputSourceRange) {
          compiled.errors.forEach(e => {
            warn(
              `Error compiling template:\n\n${e.msg}\n\n` +
                generateCodeFrame(template, e.start, e.end),
              vm
            );
          });
        } else {
          warn(
            `Error compiling template:\n\n${template}\n\n` +
              compiled.errors.map(e => `- ${e}`).join("\n") +
              "\n",
            vm
          );
        }
      }
      if (compiled.tips && compiled.tips.length) {
        if (options.outputSourceRange) {
          compiled.tips.forEach(e => tip(e.msg, vm));
        } else {
          compiled.tips.forEach(msg => tip(msg, vm));
        }
      }
    }

    // 将代码转换成函数
    const res = {};
    const fnGenErrors = [];

    // 将render字符串通过new Function编译成函数
    res.render = createFunction(compiled.render, fnGenErrors);
    res.staticRenderFns = compiled.staticRenderFns.map(code => {
      return createFunction(code, fnGenErrors);
    });

    // 检查函数生成错误。只有在编译器函数本身存在错误时才会发生这种情况。主要用于代码生成开发使用
    /* istanbul ignore if */
    if (process.env.NODE_ENV !== "production") {
      if ((!compiled.errors || !compiled.errors.length) && fnGenErrors.length) {
        warn(
          `Failed to generate render function:\n\n` +
            fnGenErrors
              .map(({ err, code }) => `${err.toString()} in\n\n${code}\n`)
              .join("\n"),
          vm
        );
      }
    }

    // 将编译缓存
    return (cache[key] = res);
  };
}
