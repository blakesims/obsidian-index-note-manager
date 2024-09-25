import { App, TFile, Notice, Plugin } from "obsidian";
import { ConfigManager } from "./configManager";
import { QuestionHandler } from "./questionHandler";
import { FrontMatterGenerator } from "./frontMatterGenerator";
import { NoteUtils } from "./noteUtils";
import { NoteConfig, NoteType, NoteSubtype, Answer, Question } from "./types";
import { log } from "./debugUtils";
import { QuickAddUtils } from "./quickAddUtils";

export class NoteCreator {
	private app: App;
	private configManager: ConfigManager;
	private questionHandler: QuestionHandler;
	private frontMatterGenerator: FrontMatterGenerator;
	private noteUtils: NoteUtils;
	private quickAddUtils: QuickAddUtils;

	constructor(app: App, configManager: ConfigManager) {
		this.app = app;
		this.configManager = configManager;
		this.questionHandler = new QuestionHandler(app, configManager);
		this.frontMatterGenerator = new FrontMatterGenerator(
			app,
			configManager,
		);
		this.noteUtils = new NoteUtils(app);
		this.quickAddUtils = new QuickAddUtils(app);
		this.questionHandler.setNoteCreator(this);
	}

	async createNote(): Promise<void> {
		try {
			const noteConfig = this.configManager.getNoteConfig();
			log(
				"generalDebug",
				"Loaded note config:",
				JSON.stringify(noteConfig, null, 2),
			);

			const noteType = await this.selectNoteType(noteConfig.noteTypes);
			const noteSubtype = await this.selectNoteSubtype(noteType);

			const subtypeConfig = this.getSubtypeConfig(noteType, noteSubtype);
			if (!subtypeConfig) {
				new Notice("Invalid note type or subtype");
				return;
			}
			log(
				"questionFlowDebug",
				`Selected Note Type: ${noteType.id}, Subtype: ${noteSubtype.id}`,
			);
			log(
				"questionFlowDebug",
				"Selected subtype config:",
				JSON.stringify(subtypeConfig, null, 2),
			);

			const requiredAnswerIds = this.questionHandler.getRequiredAnswerIds(
				subtypeConfig,
				noteConfig,
			);
			log(
				"answerIdDebug",
				"Required answerIds:",
				JSON.stringify(requiredAnswerIds),
			);

			const allAnswers = await this.askQuestions(
				subtypeConfig,
				noteConfig,
			);
			log(
				"answerStorageDebug",
				"Final answers:",
				JSON.stringify(allAnswers, null, 2),
			);

			// Ensure all required answers are present
			const missingAnswerIds = requiredAnswerIds.filter(
				(id) => !allAnswers.hasOwnProperty(id),
			);
			if (missingAnswerIds.length > 0) {
				new Notice(
					`Missing required answers: ${missingAnswerIds.join(", ")}`,
				);
				return;
			}

			const frontMatter =
				await this.frontMatterGenerator.generateFrontMatter(
					noteType.id,
					noteSubtype.id,
					allAnswers,
				);
			log("frontMatterDebug", "Front matter generated:", frontMatter);

			const newNotePath = await this.noteUtils.createNoteFromTemplate(
				subtypeConfig,
				frontMatter,
				allAnswers,
			);

			if (newNotePath) {
				new Notice(`New note created: ${newNotePath}`);
				const newFile =
					this.app.vault.getAbstractFileByPath(newNotePath);
				if (newFile instanceof TFile) {
					await this.app.workspace.getLeaf().openFile(newFile);
				}
			} else {
				new Notice("Failed to create new note");
			}
		} catch (error) {
			log("errorDebug", "Error in note creation process:", error);
			new Notice("Error creating note. Check console for details.");
		}
	}

	async createNewEntryNote(
		newEntryName: string,
		noteType: string,
		noteSubtype: string,
		answers: Record<string, Answer>,
	): Promise<void> {
		try {
			const noteConfig = this.configManager.getNoteConfig();
			const typeConfig = noteConfig.noteTypes.find(
				(type) => type.id === noteType,
			);
			const subtypeConfig = typeConfig?.subtypes.find(
				(subtype) => subtype.id === noteSubtype,
			);

			if (!subtypeConfig) {
				throw new Error(
					`Invalid note type or subtype: ${noteType} - ${noteSubtype}`,
				);
			}

			const requiredAnswerIds = this.questionHandler.getRequiredAnswerIds(
				subtypeConfig,
				noteConfig,
			);
			const missingAnswerIds = requiredAnswerIds.filter(
				(id) => !answers.hasOwnProperty(id),
			);

			// If there are missing answers, prompt for them
			for (const missingId of missingAnswerIds) {
				const question = noteConfig.questions.find(
					(q: Question) => q.answerId === missingId,
				);
				if (question) {
					const answer = await this.questionHandler.askQuestion(
						question,
						answers,
					);
					answers[missingId] = answer;
				}
			}

			// Ensure the new entry data is included in the answers
			answers[noteSubtype.toLowerCase()] = {
				value: newEntryName,
				type: "string",
				metadata: {
					questionType: "inputPrompt",
					indexed: false,
					level: null,
					parentAnswerId: null,
				},
			};

			const frontMatter =
				await this.frontMatterGenerator.generateFrontMatter(
					noteType,
					noteSubtype,
					answers,
				);
			log(
				"frontMatterDebug",
				"Front matter generated for new entry:",
				frontMatter,
			);

			await this.noteUtils.createNoteFromTemplate(
				subtypeConfig,
				frontMatter,
				answers,
			);
		} catch (error) {
			log("errorDebug", "Error in creating new entry note:", error);
			new Notice(
				"Error creating new entry note. Check console for details.",
			);
		}
	}

	private async selectNoteType(noteTypes: NoteType[]): Promise<NoteType> {
		const typeNames = noteTypes.map((type) => type.id);
		const selectedTypeName = await this.quickAddUtils.suggester(
			typeNames,
			typeNames,
			"Select note type",
		);
		log("questionFlowDebug", `Selected note type: ${selectedTypeName}`);
		return noteTypes.find(
			(type) => type.id === selectedTypeName,
		) as NoteType;
	}

	private async selectNoteSubtype(noteType: NoteType): Promise<NoteSubtype> {
		const subtypeNames = noteType.subtypes.map((subtype) => subtype.id);
		const selectedSubtypeName = await this.quickAddUtils.suggester(
			subtypeNames,
			subtypeNames,
			"Select note subtype",
		);
		log(
			"questionFlowDebug",
			`Selected note subtype: ${selectedSubtypeName}`,
		);
		return noteType.subtypes.find(
			(subtype) => subtype.id === selectedSubtypeName,
		) as NoteSubtype;
	}

	private getSubtypeConfig(
		noteType: NoteType,
		noteSubtype: NoteSubtype,
	): NoteSubtype | null {
		const subtypeConfig =
			noteType.subtypes.find(
				(subtype) => subtype.id === noteSubtype.id,
			) || null;
		log(
			"questionFlowDebug",
			"Subtype config:",
			JSON.stringify(subtypeConfig, null, 2),
		);
		return subtypeConfig;
	}

	private async askQuestions(
		subtypeConfig: NoteSubtype,
		noteConfig: NoteConfig,
	): Promise<Record<string, Answer>> {
		const allAnswers: Record<string, Answer> = {};
		for (const questionId of subtypeConfig.questions) {
			const question = noteConfig.questions.find(
				(q: Question) => q.questionId === questionId,
			);
			if (question) {
				log(
					"questionFlowDebug",
					`Asking question: ${question.questionId}`,
				);
				const answer = await this.questionHandler.askQuestion(
					question,
					allAnswers,
				);
				allAnswers[question.answerId] = answer;
				log(
					"answerStorageDebug",
					`Stored answer for ${question.answerId}:`,
					answer,
				);
			}
		}
		return allAnswers;
	}
}
