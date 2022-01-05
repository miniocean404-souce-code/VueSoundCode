/* @flow */

import { extend } from "shared/util";
import { detectErrors } from "./error-detector";
import { createCompileToFunctionFn } from "./to-function";

// 通过不同平台不同编译的函数 （传入编译核心三步的函数），在这里创建一个编译器函数createCompiler，并返回
export function createCompilerCreator(baseCompile: Function): Function {
  // 根据不同的编译选项进行生成编译函数，并返回compile、createCompileToFunctionFn
  return function createCompiler(baseOptions: CompilerOptions) {
    function compile(
      template: string,
      options?: CompilerOptions
    ): CompiledResult {
      const finalOptions = Object.create(baseOptions);
      const errors = [];
      const tips = [];

      let warn = (msg, range, tip) => {
        (tip ? tips : errors).push(msg);
      };

      // 扩展拼接options
      if (options) {
        if (
          process.env.NODE_ENV !== "production" &&
          options.outputSourceRange
        ) {
          // $flow-disable-line
          const leadingSpaceLength = template.match(/^\s*/)[0].length;

          warn = (msg, range, tip) => {
            const data: WarningMessage = { msg };
            if (range) {
              if (range.start != null) {
                data.start = range.start + leadingSpaceLength;
              }
              if (range.end != null) {
                data.end = range.end + leadingSpaceLength;
              }
            }
            (tip ? tips : errors).push(data);
          };
        }
        // 合并自定义的模块
        if (options.modules) {
          finalOptions.modules = (baseOptions.modules || []).concat(
            options.modules
          );
        }
        // 合并自定义指令
        if (options.directives) {
          finalOptions.directives = extend(
            Object.create(baseOptions.directives || null),
            options.directives
          );
        }
        // 复制其他属性
        for (const key in options) {
          if (key !== "modules" && key !== "directives") {
            finalOptions[key] = options[key];
          }
        }
      }

      finalOptions.warn = warn;

      // 通过传入的不同平台不同编译的函数并将其返回 （真正核心编译函数，）
      const compiled = baseCompile(template.trim(), finalOptions);

      if (process.env.NODE_ENV !== "production") {
        detectErrors(compiled.ast, warn);
      }

      compiled.errors = errors;
      compiled.tips = tips;
      return compiled;
    }

    return {
      compile,
      compileToFunctions: createCompileToFunctionFn(compile)
    };
  };
}
