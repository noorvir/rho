"use client";

import {
	IconBolt,
	IconChevronDown,
	IconCircle,
	IconCircleDashed,
	IconCloud,
	IconCode,
	IconDeviceLaptop,
	IconHistory,
	IconPaperclip,
	IconPlus,
	IconProgress,
	IconRobot,
	IconSend,
	IconUser,
	IconWand,
	IconWorld,
} from "@tabler/icons-react";
import type { FormEvent } from "react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface ChatProps {
	value: string;
	onChange: (value: string) => void;
	onSubmit: () => void;
	disabled?: boolean;
	placeholder?: string;
}

export function Chat({
	value,
	onChange,
	onSubmit,
	disabled = false,
	placeholder = "Ask anything",
}: ChatProps) {
	const [selectedModel, setSelectedModel] = useState("Local");
	const [selectedAgent, setSelectedAgent] = useState("Agent");
	const [selectedPerformance, setSelectedPerformance] = useState("High");
	const [autoMode, setAutoMode] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const isSubmitDisabled = disabled || !value.trim();

	function handleSubmit(event: FormEvent) {
		event.preventDefault();
		if (!isSubmitDisabled) {
			onSubmit();
		}
	}

	return (
		<div className="w-full">
			<form
				className="overflow-hidden rounded-2xl border border-border bg-background"
				onSubmit={handleSubmit}
			>
				<input className="sr-only" multiple onChange={() => {}} ref={fileInputRef} type="file" />

				<div className="grow px-3 pt-3 pb-2">
					<Textarea
						className="max-h-[25vh] min-h-10 w-full resize-none border-0 border-none bg-transparent! p-0 text-sm text-foreground shadow-none outline-none placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
						onChange={(event) => onChange(event.target.value)}
						onInput={(event) => {
							const target = event.target as HTMLTextAreaElement;
							target.style.height = "auto";
							target.style.height = `${target.scrollHeight}px`;
						}}
						onKeyDown={(event) => {
							if (event.key === "Enter" && !event.shiftKey) {
								handleSubmit(event);
							}
						}}
						placeholder={placeholder}
						rows={1}
						value={value}
					/>
				</div>

				<div className="mb-2 flex items-center justify-between px-2">
					<div className="flex items-center gap-1">
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									className="h-7 w-7 rounded-full border border-border p-0 hover:bg-accent"
									size="sm"
									type="button"
									variant="ghost"
								>
									<IconPlus className="size-3" />
								</Button>
							</DropdownMenuTrigger>

							<DropdownMenuContent align="start" className="max-w-xs rounded-2xl p-1.5">
								<DropdownMenuGroup className="space-y-1">
									<DropdownMenuItem
										className="rounded-[calc(1rem-6px)] text-xs"
										onClick={() => fileInputRef.current?.click()}
									>
										<IconPaperclip className="opacity-60" size={16} />
										Attach Files
									</DropdownMenuItem>
									<DropdownMenuItem className="rounded-[calc(1rem-6px)] text-xs" onClick={() => {}}>
										<IconCode className="opacity-60" size={16} />
										Code Interpreter
									</DropdownMenuItem>
									<DropdownMenuItem className="rounded-[calc(1rem-6px)] text-xs" onClick={() => {}}>
										<IconWorld className="opacity-60" size={16} />
										Web Search
									</DropdownMenuItem>
									<DropdownMenuItem className="rounded-[calc(1rem-6px)] text-xs" onClick={() => {}}>
										<IconHistory className="opacity-60" size={16} />
										Chat History
									</DropdownMenuItem>
								</DropdownMenuGroup>
							</DropdownMenuContent>
						</DropdownMenu>

						<Button
							className={cn("h-7 rounded-full border border-border px-2 hover:bg-accent", {
								"border-primary/30 bg-primary/10 text-primary": autoMode,
								"text-muted-foreground": !autoMode,
							})}
							onClick={() => setAutoMode(!autoMode)}
							size="sm"
							type="button"
							variant="ghost"
						>
							<IconWand className="size-3" />
							<span className="text-xs">Auto</span>
						</Button>
					</div>

					<Button
						className="size-7 rounded-full bg-primary p-0 disabled:cursor-not-allowed disabled:opacity-50"
						disabled={isSubmitDisabled}
						type="submit"
					>
						<IconSend className="size-3 fill-primary" />
					</Button>
				</div>
			</form>

			<div className="flex items-center gap-0 pt-2">
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							className="h-6 rounded-full border border-transparent px-2 text-xs text-muted-foreground hover:bg-accent"
							size="sm"
							variant="ghost"
						>
							<IconDeviceLaptop className="size-3" />
							<span>{selectedModel}</span>
							<IconChevronDown className="size-3" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						align="start"
						className="max-w-xs rounded-2xl border-border bg-popover p-1.5"
					>
						<DropdownMenuGroup className="space-y-1">
							<DropdownMenuItem
								className="rounded-[calc(1rem-6px)] text-xs"
								onClick={() => setSelectedModel("Local")}
							>
								<IconDeviceLaptop className="opacity-60" size={16} />
								Local
							</DropdownMenuItem>
							<DropdownMenuItem
								className="rounded-[calc(1rem-6px)] text-xs"
								onClick={() => setSelectedModel("Cloud")}
							>
								<IconCloud className="opacity-60" size={16} />
								Cloud
							</DropdownMenuItem>
						</DropdownMenuGroup>
					</DropdownMenuContent>
				</DropdownMenu>

				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							className="h-6 rounded-full border border-transparent px-2 text-xs text-muted-foreground hover:bg-accent"
							size="sm"
							variant="ghost"
						>
							<IconUser className="size-3" />
							<span>{selectedAgent}</span>
							<IconChevronDown className="size-3" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						align="start"
						className="max-w-xs rounded-2xl border-border bg-popover p-1.5"
					>
						<DropdownMenuGroup className="space-y-1">
							<DropdownMenuItem
								className="rounded-[calc(1rem-6px)] text-xs"
								onClick={() => setSelectedAgent("Agent")}
							>
								<IconUser className="opacity-60" size={16} />
								Agent
							</DropdownMenuItem>
							<DropdownMenuItem
								className="rounded-[calc(1rem-6px)] text-xs"
								onClick={() => setSelectedAgent("Assistant")}
							>
								<IconRobot className="opacity-60" size={16} />
								Assistant
							</DropdownMenuItem>
						</DropdownMenuGroup>
					</DropdownMenuContent>
				</DropdownMenu>

				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							className="h-6 rounded-full border border-transparent px-2 text-xs text-muted-foreground hover:bg-accent"
							size="sm"
							variant="ghost"
						>
							<IconBolt className="size-3" />
							<span>{selectedPerformance}</span>
							<IconChevronDown className="size-3" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						align="start"
						className="max-w-xs rounded-2xl border-border bg-popover p-1.5"
					>
						<DropdownMenuGroup className="space-y-1">
							<DropdownMenuItem
								className="rounded-[calc(1rem-6px)] text-xs"
								onClick={() => setSelectedPerformance("High")}
							>
								<IconCircle className="opacity-60" size={16} />
								High
							</DropdownMenuItem>
							<DropdownMenuItem
								className="rounded-[calc(1rem-6px)] text-xs"
								onClick={() => setSelectedPerformance("Medium")}
							>
								<IconProgress className="opacity-60" size={16} />
								Medium
							</DropdownMenuItem>
							<DropdownMenuItem
								className="rounded-[calc(1rem-6px)] text-xs"
								onClick={() => setSelectedPerformance("Low")}
							>
								<IconCircleDashed className="opacity-60" size={16} />
								Low
							</DropdownMenuItem>
						</DropdownMenuGroup>
					</DropdownMenuContent>
				</DropdownMenu>

				<div className="flex-1" />
			</div>
		</div>
	);
}
