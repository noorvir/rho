interface QuestionInput {
	question(prompt: string): Promise<string>;
}

export async function question(input: QuestionInput, prompt: string): Promise<string | undefined> {
	try {
		return await input.question(prompt);
	} catch (error) {
		if (error instanceof Error && error.name === "AbortError") {
			return undefined;
		}
		return undefined;
	}
}
