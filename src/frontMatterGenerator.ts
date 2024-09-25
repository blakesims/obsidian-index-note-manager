import { App, TFile } from "obsidian";
import { ConfigManager } from "./configManager";
import {
	Answer,
	NoteConfig,
	NoteType,
	NoteSubtype,
	FrontMatterField,
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
				if (allAnswers[placeholderKey]) {
					replacedValue =
						allAnswers[placeholderKey].value ||
						allAnswers[placeholderKey];
					log(
						"frontMatterDebug",
						`Replaced from allAnswers: ${replacedValue}`,
					);
				} else {
					log(
						"frontMatterDebug",
						`No value found in allAnswers for key: ${placeholderKey}`,
					);
					return null;
				}
			}
		}

		const answerObj = { value: replacedValue, type };
		const formattedAnswer = this.formatAnswer(
			answerObj,
			type,
			Array.isArray(answerObj.value),
		);
		log("frontMatterDebug", `Formatted answer for ${id}:`, formattedAnswer);

		return `${id}: ${formattedAnswer}`;
	}

	private formatAnswer(
		answerObj: { value: any; type: string },
		frontMatterType: string,
		multipleSelections: boolean,
	): string {
		log("formatAnswerDebug", "==== formatAnswer called ====");
		log(
			"formatAnswerDebug",
			"Input answerObj:",
			JSON.stringify(answerObj, null, 2),
		);
		log("formatAnswerDebug", "frontMatterType:", frontMatterType);
		log("formatAnswerDebug", "multipleSelections:", multipleSelections);

		const { value } = answerObj;

		if (multipleSelections) {
			const arrayValue = Array.isArray(value) ? value : [value];
			if (frontMatterType === "link") {
				return (
					"\n" +
					arrayValue.map((item) => `  - "[[${item}]]"`).join("\n")
				);
			} else {
				return (
					"\n" + arrayValue.map((item) => `  - "${item}"`).join("\n")
				);
			}
		} else {
			if (frontMatterType === "link") {
				return `"[[${value}]]"`;
			} else {
				return `"${value}"`;
			}
		}
	}
}
