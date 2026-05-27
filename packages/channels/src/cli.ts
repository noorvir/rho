import { messageText } from "./index.ts";
import type {
	Channel,
	ChannelContext,
	ChannelMessage,
	ChannelOutput,
	MessageId,
	SendReceipt,
} from "./types.ts";

export class CliChannel implements Channel {
	readonly id = "cli";
	readonly kind = "cli";

	constructor(private readonly output: Pick<NodeJS.WritableStream, "write"> = process.stdout) {}

	async start(_context: ChannelContext): Promise<void> {}

	async stop(): Promise<void> {}

	async send(output: ChannelOutput): Promise<SendReceipt> {
		let messageId: MessageId = `cli:${Date.now()}`;
		for await (const message of messagesFrom(output)) {
			messageId = message.id;
			this.output.write(`${messageText(message)}\n`);
		}

		return { ok: true, messageId, raw: null };
	}
}

async function* messagesFrom(output: ChannelOutput): AsyncIterable<ChannelMessage> {
	if (Symbol.asyncIterator in output) {
		yield* output;
		return;
	}

	yield output;
}
