import { DataTableSurface } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export function RhoApps() {
	return (
		<DataTableSurface className="flex-1">
			<header className="flex items-center justify-between px-3 py-2">
				<div>
					<p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
						Apps
					</p>
					<h2 className="mt-1 text-sm font-semibold">App extensions</h2>
				</div>
				<Button className="h-7 px-2 text-xs" disabled variant="outline">
					Install app
				</Button>
			</header>

			<Separator />

			<div className="flex min-h-0 flex-1 items-center justify-center p-6 text-center">
				<div className="max-w-sm">
					<p className="text-sm font-medium">No app extensions loaded</p>
					<p className="mt-2 text-xs leading-5 text-muted-foreground">
						This is the web runtime surface where rho app extensions will render under
						/apps.
					</p>
				</div>
			</div>
		</DataTableSurface>
	);
}
