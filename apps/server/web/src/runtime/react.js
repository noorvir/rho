// Shared runtime module: app bundles import the shell's React instance
// through this fixed-name entry so the page has exactly one React.
// React ships as CJS, so `export *` cannot enumerate its exports statically;
// the public API is re-exported explicitly instead.
import * as ReactNamespace from "react";

const React = ReactNamespace.default ?? ReactNamespace;

export default React;
export const {
	Children,
	Component,
	Fragment,
	Profiler,
	PureComponent,
	StrictMode,
	Suspense,
	cache,
	cloneElement,
	createContext,
	createElement,
	createRef,
	forwardRef,
	isValidElement,
	lazy,
	memo,
	startTransition,
	use,
	useActionState,
	useCallback,
	useContext,
	useDebugValue,
	useDeferredValue,
	useEffect,
	useId,
	useImperativeHandle,
	useInsertionEffect,
	useLayoutEffect,
	useMemo,
	useOptimistic,
	useReducer,
	useRef,
	useState,
	useSyncExternalStore,
	useTransition,
	version,
} = React;
