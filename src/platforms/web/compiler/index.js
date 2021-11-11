/* @flow */

import { baseOptions } from "./options";
import { createCompiler } from "compiler/index";

// * 创建编译器，将编译器中生成的函数解构出来
const { compile, compileToFunctions } = createCompiler(baseOptions);

export { compile, compileToFunctions };
