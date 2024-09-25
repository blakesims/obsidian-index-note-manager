import { Answer, Question, NoteConfig, NoteSubtype } from "./types";

import { App } from "obsidian";

export class PlaceholderUtils {
	static replacePlaceholders(
		str: string,
		answers: Record<string, Answer>,
		allowArrays = false,
	): string {
		// Implement the placeholder replacement logic here
		return str.replace(/{{([^}]+)}}/g, (match, placeholder) => {
			const answerKey = placeholder.trim();
			const answer = answers[answerKey];

			if (answer !== undefined) {
				const value = answer.value;
				if (allowArrays && Array.isArray(value)) {
					return value.join(", ");
				} else if (typeof value === "object" && value !== null) {
					return JSON.stringify(value);
				} else {
					return String(value);
				}
			}

			// Return the original placeholder if no replacement found
			return match;
		});
	}
}

export class FrontMatterGenerator {
	static async generateFrontMatter(
		app: App,
		noteType: string,
		noteSubtype: string,
		allAnswers: Record<string, Answer>,
	): Promise<string> {
		// Implement the front matter generation logic here
		return ""; // Placeholder return value
	}
}

export class QuestionHandler {
	static async askQuestion(params: {
		question: Question;
		app: App;
		quickAddApi: any;
		noteType: string;
		noteSubtype: string;
		noteConfig: NoteConfig;
	}): Promise<Answer> {
		// Implement the question asking logic here
		return {} as Answer; // Placeholder return value
	}

	static getRequiredAnswerIds(
		selectedSubtypeConfig: NoteSubtype,
		noteConfig: NoteConfig,
	): string[] {
		// Implement the logic to get required answer IDs
		return []; // Placeholder return value
	}
}
