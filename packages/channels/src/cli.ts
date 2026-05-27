import { channelMessages, messageText } from "./message.ts";
import type { Channel, ChannelContext, ChannelOutput, MessageId, SendReceipt } from "./types.ts";

export class CliChannel implements Channel {
	readonly id = "cli";
	readonly kind = "cli";

	constructor(private readonly output: Pick<NodeJS.WritableStream, "write"> = process.stdout) {}

	async start(_context: ChannelContext): Promise<void> {}

	async stop(): Promise<void> {}

	async send(output: ChannelOutput): Promise<SendReceipt> {
		let messageId: MessageId = `cli:${Date.now()}`;
		for await (const message of channelMessages(output)) {
			messageId = message.id;
			this.output.write(`${messageText(message)}\n`);
		}

		return { ok: true, messageId, raw: null };
	}
}
