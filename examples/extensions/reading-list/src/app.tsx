import { rhoApp, useRhoApp } from "@rho/apps-sdk/react";
import { Book } from "./routes/book.tsx";
import { Books } from "./routes/index.tsx";

function ReadingListApp() {
	const rho = useRhoApp();
	const bookId = bookRouteId(rho.app.routePath);

	if (rho.app.routePath === "/") {
		return <Books />;
	}
	if (bookId !== undefined) {
		return <Book id={bookId} />;
	}
	return <main>Route not found: {rho.app.routePath}</main>;
}

function bookRouteId(routePath: string): number | undefined {
	const match = /^\/book\/(\d+)$/.exec(routePath);
	if (!match) {
		return undefined;
	}
	return Number(match[1]);
}

export default rhoApp(ReadingListApp);
