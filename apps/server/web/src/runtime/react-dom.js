import * as ReactDOMNamespace from "react-dom";

const ReactDOM = ReactDOMNamespace.default ?? ReactDOMNamespace;

export default ReactDOM;
export const {
	createPortal,
	flushSync,
	preconnect,
	prefetchDNS,
	preinit,
	preinitModule,
	preload,
	preloadModule,
	requestFormReset,
	unstable_batchedUpdates,
	useFormState,
	useFormStatus,
	version,
} = ReactDOM;
