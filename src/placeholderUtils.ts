import { Answer } from "./types";

export class PlaceholderUtils {
	replacePlaceholders(
		str: string,
		answers: Record<string, Answer>,
		allowArrays: boolean = false,
	): string {
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

	/**
	 * Recursively replace placeholders in an object or array
	 */
	replacePlaceholdersInObject(
		obj: any,
		answers: Record<string, Answer>,
	): any {
		if (typeof obj === "string") {
			return this.replacePlaceholders(obj, answers);
		} else if (Array.isArray(obj)) {
			return obj.map((item) =>
				this.replacePlaceholdersInObject(item, answers),
			);
		} else if (typeof obj === "object" && obj !== null) {
			const newObj: { [key: string]: any } = {};
			for (const [key, value] of Object.entries(obj)) {
				newObj[key] = this.replacePlaceholdersInObject(value, answers);
			}
			return newObj;
		}
		return obj;
	}
}
