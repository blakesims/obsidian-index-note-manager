import { Answer } from "./types";
import { log } from "./debugUtils";

export class AnswerManager {
	private answers: Record<string, Answer> = {};

	initAnswers(): void {
		this.answers = {};
		log("generalDebug", "Answers initialized successfully.");
	}

	setAnswers(newAnswers: Record<string, Answer>): void {
		this.answers = newAnswers;
		log("answerStorageDebug", "Answers set successfully.");
	}

	getAllAnswers(): Record<string, Answer> {
		log("answerStorageDebug", "Retrieving all answers.");
		return this.answers;
	}

	hasAnswer(answerId: string): boolean {
		const exists = answerId in this.answers;
		log(
			"answerStorageDebug",
			`Checking existence of answerId ${answerId}: ${exists}`,
		);
		return exists;
	}

	getAnswer(answerId: string): Answer | undefined {
		log(
			"answerStorageDebug",
			`Retrieving answer for answerId ${answerId}.`,
		);
		return this.answers[answerId];
	}

	storeAnswer(answerId: string, answer: Answer): void {
		this.answers[answerId] = answer;
		log("answerStorageDebug", `Answer stored for ${answerId}:`, answer);
	}

	clearAnswers(): void {
		this.answers = {};
		log("generalDebug", "All answers cleared.");
	}
}
