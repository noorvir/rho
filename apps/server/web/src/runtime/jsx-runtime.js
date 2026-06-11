import * as JsxRuntimeNamespace from "react/jsx-runtime";

const JsxRuntime = JsxRuntimeNamespace.default ?? JsxRuntimeNamespace;

export const { Fragment, jsx, jsxs } = JsxRuntime;
