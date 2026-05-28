import { messageText } from "./message.ts";
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
		return isMessageStream(output) ? this.sendStream(output) : this.sendMessage(output);
	}

	private async sendMessage(message: ChannelMessage): Promise<SendReceipt> {
		this.output.write(`${messageText(message)}\n`);
		return { ok: true, messageId: message.id, raw: null };
	}

	private async sendStream(messages: AsyncIterable<ChannelMessage>): Promise<SendReceipt> {
		let messageId: MessageId = `cli:${Date.now()}`;

		for await (const message of messages) {
			messageId = message.id;
			this.output.write(messageText(message));
		}

		this.output.write("\n");
		return { ok: true, messageId, raw: null };
	}
}

function isMessageStream(output: ChannelOutput): output is AsyncIterable<ChannelMessage> {
	return Symbol.asyncIterator in output;
}
