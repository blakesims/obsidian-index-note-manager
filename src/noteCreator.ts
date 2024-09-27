import { App, TFile, Notice } from "obsidian";
import { ConfigManager } from "./configManager";
import { QuestionHandler } from "./questionHandler";
import { FrontMatterGenerator } from "./frontMatterGenerator";
import { NoteUtils } from "./noteUtils";
import { NoteConfig, NoteType, NoteSubtype, Answer, Question } from "./types";
import { log } from "./debugUtils";
import { ModalUtils } from "./modalUtils";

export class NoteCreator {
	private app: App;
	private configManager: ConfigManager;
	private questionHandler: QuestionHandler;
	private frontMatterGenerator: FrontMatterGenerator;
	private noteUtils: NoteUtils;
	private modalUtils: ModalUtils;

	constructor(app: App, configManager: ConfigManager) {
		this.app = app;
		this.configManager = configManager;
		this.questionHandler = new QuestionHandler(app, configManager);
		this.frontMatterGenerator = new FrontMatterGenerator(
			app,
			configManager,
		);
		this.noteUtils = new NoteUtils(app);
		this.modalUtils = new ModalUtils(app);
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
			if (allAnswers === null) {
				log("generalDebug", "Note creation cancelled by user");
				new Notice("Note creation cancelled");
				return;
			}
			log(
				"answerStorageDebug",
				"Final answers:",
				JSON.stringify(allAnswers, null, 2),
			);

			const missingAnswerIds = requiredAnswerIds.filter(
				(id: string) => !allAnswers.hasOwnProperty(id),
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
		existingAnswers: Record<string, Answer>,
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
			log(
				"questionFlowDebug",
				`Creating new entry note with existing answers: ${JSON.stringify(existingAnswers)}`,
			);

			const requiredAnswerIds = this.questionHandler.getRequiredAnswerIds(
				subtypeConfig,
				noteConfig,
			);
			const missingAnswerIds = requiredAnswerIds.filter(
				(id) => !existingAnswers.hasOwnProperty(id),
			);

			log(
				"questionFlowDebug",
				`Required answer IDs: ${JSON.stringify(requiredAnswerIds)}`,
			);
			log(
				"questionFlowDebug",
				`Missing answer IDs: ${JSON.stringify(missingAnswerIds)}`,
			);

			// If there are missing answers, prompt for them
			for (const missingId of missingAnswerIds) {
				const question = noteConfig.questions.find(
					(q: Question) => q.answerId === missingId,
				);
				if (question) {
					log(
						"questionFlowDebug",
						`Asking question for missing answer: ${missingId}`,
					);
					const answer = await this.questionHandler.askQuestion(
						question,
						existingAnswers,
					);
					if (answer === null) {
						log(
							"generalDebug",
							"New entry note creation cancelled by user",
						);
						new Notice("New entry note creation cancelled");
						return;
					}
					Object.assign(existingAnswers, answer);
				}
			}

			// Ensure the new entry data is included in the answers
			existingAnswers[noteSubtype.toLowerCase()] = {
				value: newEntryName,
				type: "string",
				metadata: {
					questionType: "inputPrompt",
					indexed: true,
					level: null,
					parentAnswerId: null,
				},
			};

			const frontMatter =
				await this.frontMatterGenerator.generateFrontMatter(
					noteType,
					noteSubtype,
					existingAnswers,
				);
			log(
				"frontMatterDebug",
				"Front matter generated for new entry:",
				frontMatter,
			);

			await this.noteUtils.createNoteFromTemplate(
				subtypeConfig,
				frontMatter,
				existingAnswers,
			);
		} catch (error) {
			log("errorDebug", "Error in creating new entry note:", error);
			new Notice(
				"Error creating new entry note. Check console for details.",
			);
		}
	}

	private async askQuestions(
		subtypeConfig: NoteSubtype,
		noteConfig: NoteConfig,
	): Promise<Record<string, Answer> | null> {
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
				if (answer === null) {
					return null; // User cancelled
				}
				Object.assign(allAnswers, answer);
			}
		}
		return allAnswers;
	}

	private async selectNoteType(noteTypes: NoteType[]): Promise<NoteType> {
		const typeNames = noteTypes.map((type) => type.id);
		const selectedTypeName = await this.modalUtils.showModal(
			"Select note type",
			typeNames,
		);
		log("questionFlowDebug", `Selected note type: ${selectedTypeName}`);
		return noteTypes.find(
			(type) => type.id === selectedTypeName,
		) as NoteType;
	}

	private async selectNoteSubtype(noteType: NoteType): Promise<NoteSubtype> {
		const subtypeNames = noteType.subtypes.map((subtype) => subtype.id);
		const selectedSubtypeName = await this.modalUtils.showModal(
			"Select note subtype",
			subtypeNames,
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
}
