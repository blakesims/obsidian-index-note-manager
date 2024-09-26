import { App } from "obsidian";
import { ConfigManager } from "./configManager";
import { NoteCreator } from "./noteCreator";
import { Question, Answer, NoteConfig, NoteSubtype } from "./types";
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
		// Note: We'll need to set this after NoteCreator is instantiated
		this.noteCreator = null as any;
	}

	setNoteCreator(noteCreator: NoteCreator) {
		this.noteCreator = noteCreator;
	}

	async askQuestion(
		question: Question,
		existingAnswers: Record<string, Answer> = {},
	): Promise<Answer> {
		log("questionFlowDebug", `Asking question: ${question.questionId}`);
		try {
			switch (question.type.toLowerCase()) {
				case "inputprompt":
					return await this.handleInputPrompt(question);
				case "tpsuggester":
					return await this.handleTpsuggester(
						question,
						existingAnswers,
					);
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
		nestingLevel: number = 0,
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
		let indexData: Record<string, any> = {};

		if (indexName) {
			const parentValue = existingAnswers[answerId]?.value || null;
			log(
				"questionFlowDebug",
				`Fetching index entries for ${indexName}, parent: ${parentValue}`,
			);
			indexData = await this.getIndexEntries(indexName, parentValue);
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
		let newEntryCreated = false;

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
									level: 0,
									parents: [],
								},
							},
						});
						log(
							"questionFlowDebug",
							`New entry saved to index: ${newOption}`,
						);
						newEntryCreated = true;

						if (createNewEntry) {
							log(
								"questionFlowDebug",
								`Triggering new note creation for: ${newOption}`,
							);
							await this.noteCreator.createNewEntryNote(
								newOption,
								newEntryNoteType,
								newEntryNoteSubtype,
								{
									...existingAnswers,
									[answerId]: {
										value: newOption,
										type: "string",
										metadata: {
											questionType: "tpsuggester",
											indexed: true,
											level: 0,
											parentAnswerId: null,
										},
									},
								},
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

		let metadata = {
			level: 0,
			type: answerId,
			indexed: !!indexName,
		};

		if (indexName) {
			if (Array.isArray(finalAnswer)) {
				finalAnswer.forEach((answer) => {
					if (indexData[answer]) {
						metadata = {
							...metadata,
							...indexData[answer].metadata,
						};
					}
				});
			} else if (indexData[finalAnswer]) {
				metadata = { ...metadata, ...indexData[finalAnswer].metadata };
			}
		}

		// When creating the answer object, include the new metadata
		return this.createAnswerObject(finalAnswer, {
			questionType: "tpsuggester",
			indexed: !!indexName,
			level: nestingLevel,
			parentAnswerId: parentAnswerId,
		});
	}

	private async handleNestedTpsuggester(
		question: Question,
		existingAnswers: Record<string, Answer>,
	): Promise<Answer> {
		const { indexName, nest } = question;
		const answers = { ...existingAnswers };

		if (!Array.isArray(nest)) {
			throw new Error("nest is not an array");
		}

		let parentAnswerId: string | null = null;

		for (let i = 0; i < nest.length; i++) {
			const nestedQuestion = nest[i];
			const nestedIndexName = nestedQuestion.answerId;

			const tpsuggesterQuestion: Question = {
				...nestedQuestion,
				indexName: nestedIndexName,
				answerId: nestedIndexName,
				type: "tpsuggester",
			};

			const result = await this.handleTpsuggester(
				tpsuggesterQuestion,
				answers,
				i, // Pass the current nesting level
				parentAnswerId, // Pass the parent answer ID
			);
			answers[nestedIndexName] = result;

			// Update parentAnswerId for the next iteration
			parentAnswerId = nestedIndexName;
		}

		return this.createAnswerObject(answers, {
			questionType: "nestedTpsuggester",
			indexed: !!indexName,
			level: nest.length - 1, // The level is the depth of the nest
			parentAnswerId: null, // The nested structure itself doesn't have a parent
		});
	}

	private createAnswerObject(
		value: any,
		metadata: {
			questionType: string;
			indexed?: boolean;
			level?: number | null;
			parentAnswerId?: string | null;
		},
	): Answer {
		return {
			value: value,
			type: Array.isArray(value) ? "array" : typeof value,
			metadata: {
				questionType: metadata.questionType,
				indexed: metadata.indexed || false,
				level: metadata.level ?? null,
				parentAnswerId: metadata.parentAnswerId ?? null,
			},
		};
	}
	getRequiredAnswerIds(
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

	private async getIndexEntries(
		indexName: string,
		parentEntry: string | null = null,
	): Promise<Record<string, any>> {
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
		newEntries: Record<string, any>,
	): Promise<void> {
		try {
			await this.configManager.updateIndexEntries(indexName, newEntries);
		} catch (error) {
			log("errorDebug", `Error updating index entries: ${error.message}`);
			throw error;
		}
	}
}
