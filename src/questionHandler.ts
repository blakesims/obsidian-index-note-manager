import { App } from "obsidian";
import { ConfigManager } from "./configManager";
import { NoteCreator } from "./noteCreator";
import { Question, Answer, NoteConfig, NoteSubtype, IndexEntry } from "./types";
import { PlaceholderUtils } from "./placeholderUtils";
import { log } from "./debugUtils";
import { QuickAddUtils } from "./quickAddUtils";

export class QuestionHandler {
	private app: App;
	private configManager: ConfigManager;
	private placeholderUtils: PlaceholderUtils;
	private noteCreator: NoteCreator;
	private quickAddUtils: QuickAddUtils;

	constructor(app: App, configManager: ConfigManager) {
		this.app = app;
		this.configManager = configManager;
		this.placeholderUtils = new PlaceholderUtils();
		this.quickAddUtils = new QuickAddUtils(app);
		this.noteCreator = null as any; // This will be set later
	}

	private createAnswerObject(
		value: any,
		metadata: {
			questionType: string;
			indexed: boolean;
			level: number | null;
			parentAnswerId: string | null;
		},
	): Answer {
		return {
			value: value,
			type: Array.isArray(value) ? "array" : typeof value,
			metadata: {
				questionType: metadata.questionType,
				indexed: metadata.indexed,
				level: metadata.level,
				parentAnswerId: metadata.parentAnswerId,
			},
		};
	}
	setNoteCreator(noteCreator: NoteCreator) {
		this.noteCreator = noteCreator;
	}
	async askQuestion(
		question: Question,
		existingAnswers: Record<string, Answer> = {},
	): Promise<Record<string, Answer>> {
		log("questionFlowDebug", `Asking question: ${question.questionId}`);
		try {
			switch (question.type.toLowerCase()) {
				case "inputprompt":
					return {
						[question.answerId]:
							await this.handleInputPrompt(question),
					};
				case "tpsuggester":
					return {
						[question.answerId]: await this.handleTpsuggester(
							question,
							existingAnswers,
						),
					};
				case "nestedtpsuggester":
					return await this.handleNestedTpsuggester(
						question,
						existingAnswers,
					);
				default:
					throw new Error(`Invalid question type: ${question.type}`);
			}
		} catch (error) {
			log("errorDebug", `Error asking question: ${error.message}`);
			throw error;
		}
	}

	public getRequiredAnswerIds(
		subtypeConfig: NoteSubtype,
		noteConfig: NoteConfig,
	): string[] {
		log(
			"generalDebug",
			"getRequiredAnswerIds called with:",
			JSON.stringify(subtypeConfig, null, 2),
			JSON.stringify(noteConfig, null, 2),
		);

		const requiredAnswerIds: string[] = [];

		if (subtypeConfig.questions && subtypeConfig.questions.length > 0) {
			for (const questionId of subtypeConfig.questions) {
				log("generalDebug", `Processing question ID: ${questionId}`);
				const question = noteConfig.questions.find(
					(q) => q.questionId === questionId,
				);

				if (question) {
					log(
						"generalDebug",
						`Found question:`,
						JSON.stringify(question, null, 2),
					);

					if (
						question.type === "nestedTpsuggester" &&
						Array.isArray(question.nest)
					) {
						log(
							"nestedTpsuggesterDebug",
							"Processing nested TPSuggester question",
						);
						question.nest.forEach((nestedQ) => {
							const nestedAnswerId = nestedQ.answerId;
							if (nestedAnswerId) {
								requiredAnswerIds.push(nestedAnswerId);
								log(
									"nestedTpsuggesterDebug",
									`Added nested answer ID: ${nestedAnswerId}`,
								);
							}
						});
					} else {
						const answerId = question.answerId || questionId;
						requiredAnswerIds.push(answerId);
						log("generalDebug", `Added answer ID: ${answerId}`);
					}
				} else {
					log(
						"generalDebug",
						`Question not found for ID: ${questionId}`,
					);
				}
			}
		} else {
			log(
				"generalDebug",
				"No questions found in selected subtype config",
			);
		}

		log(
			"generalDebug",
			`Required answer IDs: ${JSON.stringify(requiredAnswerIds)}`,
		);
		return requiredAnswerIds;
	}

	private async handleInputPrompt(question: Question): Promise<Answer> {
		const answer = await this.quickAddUtils.inputPrompt(question.prompt);
		log(
			"generalDebug",
			`Input prompt answer for ${question.answerId}: ${answer}`,
		);
		return this.createAnswerObject(answer, { questionType: "inputPrompt" });
	}

	private async handleTpsuggester(
		question: Question,
		existingAnswers: Record<string, Answer>,
		nestingLevel = 0,
		parentAnswerId: string | null = null,
	): Promise<Answer> {
		const {
			answerId,
			prompt,
			indexName,
			allowManualEntry,
			multipleSelections,
			createNewEntry,
			newEntryNoteType = "defaultNoteType",
			newEntryNoteSubtype = "defaultNoteSubtype",
		} = question;

		// Check if we already have an answer for this question
		if (existingAnswers[answerId]) {
			log(
				"questionFlowDebug",
				`Using existing answer for ${answerId}: ${JSON.stringify(existingAnswers[answerId])}`,
			);
			return existingAnswers[answerId];
		}

		const replacedPrompt = this.placeholderUtils.replacePlaceholders(
			prompt,
			existingAnswers,
		);
		log(
			"questionFlowDebug",
			`Replaced prompt for ${question.questionId}: ${replacedPrompt}`,
		);

		log(
			"questionFlowDebug",
			`Handling tpsuggester for question: ${question.questionId}, answerId: ${answerId}, nestingLevel: ${nestingLevel}, parentAnswerId: ${parentAnswerId}`,
		);
		let choices: string[] = [];
		let indexData: Record<string, IndexEntry> = {};

		if (indexName) {
			log(
				"questionFlowDebug",
				`Fetching index entries for ${indexName}, parent: ${parentAnswerId}`,
			);
			indexData = await this.getIndexEntries(indexName, parentAnswerId);
			log(
				"questionFlowDebug",
				"Received indexData:",
				JSON.stringify(indexData, null, 2),
			);

			if (!indexData || typeof indexData !== "object") {
				log(
					"questionFlowDebug",
					`Invalid or empty index: ${indexName}`,
				);
				indexData = {};
			}

			choices = Object.keys(indexData);
			log("questionFlowDebug", "Choices after filtering:", choices);
		} else if (question.choices) {
			choices = question.choices;
		}

		const optionsWithNewEntry = [
			...choices,
			...(allowManualEntry ? ["New Entry"] : []),
			...(multipleSelections ? ["Done"] : []),
		];

		const selectedOptions: string[] = [];
		let continueSelecting = true;

		while (continueSelecting) {
			const answer = await this.quickAddUtils.suggester(
				optionsWithNewEntry,
				optionsWithNewEntry,
				replacedPrompt,
			);
			log("questionFlowDebug", `Tpsuggester answer: ${answer}`);

			if (
				answer === "Done" ||
				(!multipleSelections && answer !== "New Entry")
			) {
				continueSelecting = false;
				if (answer !== "Done") {
					selectedOptions.push(answer);
				}
			} else if (answer === "New Entry") {
				const newOption = await this.quickAddUtils.inputPrompt(prompt);
				if (newOption) {
					selectedOptions.push(newOption);
					if (!multipleSelections) {
						continueSelecting = false;
					}
					if (indexName) {
						await this.updateIndexEntries(indexName, {
							[newOption]: {
								metadata: {
									level: nestingLevel,
									parents: parentAnswerId
										? [parentAnswerId]
										: [],
								},
							},
						});
						log(
							"questionFlowDebug",
							`New entry saved to index: ${newOption}`,
						);

						if (createNewEntry) {
							log(
								"questionFlowDebug",
								`Triggering new note creation for: ${newOption}`,
							);
							// Create a new answer object for the new entry
							const newEntryAnswer = this.createAnswerObject(
								newOption,
								{
									questionType: "tpsuggester",
									indexed: true,
									level: nestingLevel,
									parentAnswerId: parentAnswerId,
								},
							);
							// Add the new entry answer to the existing answers
							existingAnswers[answerId] = newEntryAnswer;
							await this.noteCreator.createNewEntryNote(
								newOption,
								newEntryNoteType,
								newEntryNoteSubtype,
								existingAnswers,
							);
						}
					}
				}
			} else {
				selectedOptions.push(answer);
				if (!multipleSelections) {
					continueSelecting = false;
				}
			}
		}

		const finalAnswer = multipleSelections
			? selectedOptions
			: selectedOptions[0];
		log("questionFlowDebug", `Final answer for ${answerId}:`, finalAnswer);

		const answerObject = this.createAnswerObject(finalAnswer, {
			questionType: "tpsuggester",
			indexed: !!indexName,
			level: nestingLevel,
			parentAnswerId: parentAnswerId,
		});

		// Store the answer in existingAnswers
		existingAnswers[answerId] = answerObject;

		return answerObject;
	}

	private async handleNestedTpsuggester(
		question: Question,
		existingAnswers: Record<string, Answer>,
	): Promise<Record<string, Answer>> {
		const { indexName: topLevelIndexName, nest } = question;
		const nestedAnswers: Record<string, Answer> = {};

		let currentIndexName = topLevelIndexName;
		let parentAnswer: Answer | null = null;

		for (let level = 0; level < nest.length; level++) {
			const nestedQuestion = nest[level];
			if (!nestedQuestion || !nestedQuestion.answerId) {
				throw new Error(`Invalid nested question at level ${level}`);
			}
			const answerId = nestedQuestion.answerId;

			// Check if we already have an answer for this question
			if (existingAnswers[answerId]) {
				log(
					"questionFlowDebug",
					`Using existing answer for ${answerId}: ${JSON.stringify(existingAnswers[answerId])}`,
				);
				nestedAnswers[answerId] = existingAnswers[answerId];
				parentAnswer = nestedAnswers[answerId];
				continue;
			}
			// Determine the correct index for this level
			if (level > 0) {
				const parentIndexConfig =
					this.configManager.getIndexConfig(currentIndexName);
				currentIndexName =
					parentIndexConfig?.children?.[0] || currentIndexName;
			}

			// Fetch possible entries, filtered by parent if applicable
			const possibleEntries = await this.getPossibleEntries(
				currentIndexName,
				parentAnswer?.value || null,
			);

			// Handle the question (either select from possibleEntries or create new)
			const result = await this.handleTpsuggester(
				{
					...nestedQuestion,
					indexName: currentIndexName,
					choices: possibleEntries,
				},
				existingAnswers,
				level,
				parentAnswer?.value || null,
			);

			nestedAnswers[answerId] = {
				...result,
				metadata: {
					...result.metadata,
					questionType: "nestedTpsuggester",
					indexed: true,
					level: level,
					parentAnswerId: parentAnswer?.value || null,
					indexName: currentIndexName,
				},
			};

			parentAnswer = nestedAnswers[answerId];
		}

		return nestedAnswers;
	}

	private async getPossibleEntries(
		indexName: string,
		parentValue: string | null,
	): Promise<string[]> {
		const indexConfig = this.configManager.getIndexConfig(indexName);
		const entries = indexConfig?.entries || {};

		if (parentValue) {
			return Object.keys(entries).filter((entry) =>
				entries[entry].metadata.parents?.includes(parentValue),
			);
		} else {
			return Object.keys(entries);
		}
	}

	private async getIndexEntries(
		indexName: string,
		parentEntry: string | null = null,
	): Promise<Record<string, IndexEntry>> {
		try {
			return await this.configManager.getIndexEntries(
				indexName,
				parentEntry,
			);
		} catch (error) {
			log("errorDebug", `Error getting index entries: ${error.message}`);
			throw error;
		}
	}

	private async updateIndexEntries(
		indexName: string,
		newEntries: Record<string, IndexEntry>,
	): Promise<void> {
		try {
			await this.configManager.updateIndexEntries(indexName, newEntries);
		} catch (error) {
			log("errorDebug", `Error updating index entries: ${error.message}`);
			throw error;
		}
	}
}
