import { Answer } from "./types";
import { log } from "./debugUtils";

export class PlaceholderUtils {
	replacePlaceholders(
		str: string,
		answers: Record<string, Answer>,
		allowArrays: boolean = false,
	): string {
		if (!str || !answers) return str;

		log("generalDebug", "Starting replacePlaceholders with:", {
			str,
			allowArrays,
		});

		return str.replace(/{{([^}]+)}}/g, (match, placeholder) => {
			const answerKey = placeholder.trim();
			const answer = answers[answerKey];

			log("generalDebug", `Processing placeholder: ${answerKey}`, {
				answer: JSON.stringify(answer, null, 2),
			});

			if (answer !== undefined) {
				const value = answer.value;
				log("generalDebug", `Raw value type: ${typeof value}, isArray: ${Array.isArray(value)}`, {
					value: JSON.stringify(value, null, 2),
				});

				if (allowArrays && Array.isArray(value)) {
					const result = value.join(", ");
					log("generalDebug", "Array joined result:", result);
					return result;
				} else if (Array.isArray(value)) {
					// If it's an array but allowArrays is false, preserve array structure
					log("generalDebug", "Preserving array structure");
					return JSON.stringify(value);
				} else if (typeof value === "object" && value !== null) {
					const result = JSON.stringify(value);
					log("generalDebug", "Stringified object:", result);
					return result;
				} else {
					const result = String(value);
					log("generalDebug", "String value:", result);
					return result;
				}
			}

			log("generalDebug", "No replacement found, returning original:", match);
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
