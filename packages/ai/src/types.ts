export interface AgentInput {
	text: string;
	timestamp: Date;
}

export interface AgentReply {
	text: string;
	raw?: unknown;
}

export interface Agent {
	reply(input: AgentInput): Promise<AgentReply>;
}
