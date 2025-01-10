import { App, TFile } from "obsidian";
import { ConfigManager } from "./configManager";
import {
	Answer,
	NoteConfig,
	NoteType,
	NoteSubtype,
	FrontMatterField,
	FrontMatterType,
} from "./types";
import { PlaceholderUtils } from "./placeholderUtils";
import { log } from "./debugUtils";

export class FrontMatterGenerator {
	private app: App;
	private configManager: ConfigManager;
	private placeholderUtils: PlaceholderUtils;

	constructor(app: App, configManager: ConfigManager) {
		this.app = app;
		this.configManager = configManager;
		this.placeholderUtils = new PlaceholderUtils();
	}

	async generateFrontMatter(
		noteType: string,
		noteSubtype: string,
		allAnswers: Record<string, Answer>,
	): Promise<string> {
		log(
			"frontMatterDebug",
			`Generating front matter for: ${noteType}, ${noteSubtype}`,
		);

		const noteConfig = this.configManager.getNoteConfig();
		const typeConfig = this.getTypeConfig(noteConfig, noteType);
		const subtypeConfig = this.getSubtypeConfig(typeConfig, noteSubtype);

		if (!subtypeConfig) {
			throw new Error(
				`Invalid note type or subtype: ${noteType} - ${noteSubtype}`,
			);
		}

		const baseFrontMatterContent =
			await this.getBaseFrontMatterContent(typeConfig);
		const subtypeFrontMatter = await this.generateSubtypeFrontMatter(
			subtypeConfig,
			allAnswers,
		);

		const frontMatter = [
			baseFrontMatterContent,
			...subtypeFrontMatter,
			"---",
		];
		const finalFrontMatter = frontMatter.join("\n");

		log("frontMatterDebug", "Final front matter:", finalFrontMatter);
		return finalFrontMatter;
	}

	private getTypeConfig(noteConfig: NoteConfig, noteType: string): NoteType {
		const typeConfig = noteConfig.noteTypes.find(
			(type) => type.id === noteType,
		);
		if (!typeConfig) {
			throw new Error(`Note type not found: ${noteType}`);
		}
		return typeConfig;
	}

	private getSubtypeConfig(
		typeConfig: NoteType,
		noteSubtype: string,
	): NoteSubtype | undefined {
		return typeConfig.subtypes.find(
			(subtype) => subtype.id === noteSubtype,
		);
	}

	private async getBaseFrontMatterContent(
		typeConfig: NoteType,
	): Promise<string> {
		if (!typeConfig.baseFrontMatterPath) {
			return "";
		}

		const baseFrontMatterFile = this.app.vault.getAbstractFileByPath(
			typeConfig.baseFrontMatterPath,
		);
		if (!(baseFrontMatterFile instanceof TFile)) {
			log(
				"errorDebug",
				`Base front matter file not found: ${typeConfig.baseFrontMatterPath}`,
			);
			return "";
		}

		try {
			return await this.app.vault.read(baseFrontMatterFile);
		} catch (error) {
			log(
				"errorDebug",
				`Error reading base front matter file: ${error.message}`,
			);
			return "";
		}
	}

	private async generateSubtypeFrontMatter(
		subtypeConfig: NoteSubtype,
		allAnswers: Record<string, Answer>,
	): Promise<string[]> {
		const subtypeFrontMatter: string[] = [];

		if (!subtypeConfig.frontMatter) {
			log("errorDebug", "No frontMatter defined in subtypeConfig");
			return subtypeFrontMatter;
		}

		for (const frontMatterField of subtypeConfig.frontMatter) {
			const formattedField = await this.formatFrontMatterField(
				frontMatterField,
				allAnswers,
			);
			if (formattedField) {
				subtypeFrontMatter.push(formattedField);
			}
		}

		return subtypeFrontMatter;
	}

	private async formatFrontMatterField(
		frontMatterField: FrontMatterField,
		allAnswers: Record<string, Answer>,
	): Promise<string | null> {
		const { id, value, type } = frontMatterField;

		log("frontMatterDebug", `Processing front matter field: ${id}`);
		log(
			"frontMatterDebug",
			`Current allAnswers:`,
			JSON.stringify(allAnswers, null, 2),
		);

		// First check if we have a direct answer that matches the field id
		const directAnswer = allAnswers[id];
		if (directAnswer) {
			const answerObj = { value: directAnswer.value, type };
			const formattedAnswer = this.formatAnswer(
				answerObj,
				type,
				Array.isArray(directAnswer.value),
			);
			return `${id}: ${formattedAnswer}`;
		}

		// If no direct answer, try placeholder replacement
		let replacedValue = this.placeholderUtils.replacePlaceholders(
			value,
			allAnswers,
		);
		log("frontMatterDebug", `Before replacement: ${value}`);
		log("frontMatterDebug", `After replacement: ${replacedValue}`);

		if (replacedValue.includes("{{") && replacedValue.includes("}}")) {
			const placeholderMatch = replacedValue.match(/{{([^}]+)}}/);
			if (placeholderMatch) {
				const placeholderKey = placeholderMatch[1].trim();
				const answer = allAnswers[placeholderKey];
				if (answer) {
					const answerObj = { value: answer.value, type };
					const formattedAnswer = this.formatAnswer(
						answerObj,
						type,
						Array.isArray(answer.value),
					);
					log("frontMatterDebug", `Formatted answer for ${id}:`, formattedAnswer);
					return `${id}: ${formattedAnswer}`;
				}
			}
			return null;
		}

		// Try to parse the replacedValue if it looks like a JSON array
		try {
			if (replacedValue.startsWith("[") && replacedValue.endsWith("]")) {
				const parsedValue = JSON.parse(replacedValue);
				if (Array.isArray(parsedValue)) {
					log("frontMatterDebug", "Parsed JSON array:", parsedValue);
					const answerObj = { value: parsedValue, type };
					const formattedAnswer = this.formatAnswer(
						answerObj,
						type,
						true,
					);
					return `${id}: ${formattedAnswer}`;
				}
			}
		} catch (e) {
			log("errorDebug", "Error parsing JSON array:", e);
		}

		const answerObj = { value: replacedValue, type };
		const formattedAnswer = this.formatAnswer(
			answerObj,
			type,
			false,
		);
		log("frontMatterDebug", `Formatted answer for ${id}:`, formattedAnswer);

		return `${id}: ${formattedAnswer}`;
	}

	private formatAnswer(
		answerObj: { value: any; type: FrontMatterType },
		frontMatterType: FrontMatterType,
		multipleSelections: boolean
	): string {
		const { value } = answerObj;

		// Handle arrays/lists specifically
		if (frontMatterType === 'list' || Array.isArray(value) || multipleSelections) {
			return this.formatListValue(value, frontMatterType);
		}

		return this.formatSingleValue(value, frontMatterType);
	}

	private formatListValue(value: any, itemType: FrontMatterType = 'text'): string {
		const arrayValue = Array.isArray(value) ? value : [value];
		return arrayValue.map(item => {
			const formattedItem = this.formatSingleValue(item, itemType);
			return `\n  - ${formattedItem}`;
		}).join('');
	}

	private formatSingleValue(value: any, type: FrontMatterType): string {
		switch (type) {
			case 'link':
				return `"[[${value}]]"`;
			case 'number':
				const num = Number(value);
				return isNaN(num) ? '0' : num.toString();
			case 'checkbox':
				return value === true || value === 'true' ? 'true' : 'false';
			case 'date':
				try {
					const date = new Date(value);
					return `"${date.toISOString().split('T')[0]}"`;
				} catch {
					return `"${value}"`;
				}
			case 'datetime':
				try {
					const date = new Date(value);
					return `"${date.toISOString().split('.')[0]}"`;  // Includes the 'T'
				} catch {
					return `"${value}"`;
				}
			case 'templater':
				// Pass through templater functions unchanged
				return value;
			case 'tag':
				return value;  // Tags should not have quotes
			default: // 'text' and fallback
				return `"${value}"`;
		}
	}
}
