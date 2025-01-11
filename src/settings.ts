import { App, PluginSettingTab, Setting, TextAreaComponent } from "obsidian";
import { IndexNoteManagerPlugin } from "./pluginTypes";
import {
	NoteType,
	NoteSubtype,
	Question,
	Index,
	FrontMatterType,
	FrontMatterField,
} from "./types";
import { NewIndexEntryModal } from "./settings/modals/NewIndexEntryModal";
import { NewNoteTypeModal } from "./settings/modals/NewNoteTypeModal";
import { NewSubtypeModal } from "./settings/modals/NewSubtypeModal";
import { IndexEntriesCanvasModal } from "./settings/modals/IndexEntriesCanvasModal";
import { NewIndexModal } from "./settings/modals/NewIndexModal";
import { IndexRelationshipsCanvasModal } from "./settings/modals/IndexRelationshipsCanvasModal";
import { createQuestionDisplay } from "./settings/components/QuestionDisplay";

export class IndexNoteManagerSettingTab extends PluginSettingTab {
	plugin: IndexNoteManagerPlugin;
	jsonEditor: TextAreaComponent;

	constructor(app: App, plugin: IndexNoteManagerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h1", { text: "Index Note Manager Settings" });

		// Questions Section
		createQuestionDisplay(containerEl, this.plugin, () => {
			this.display(); // Refresh the entire settings tab
		});

		// Indices Section
		const indicesSection = containerEl.createEl("details", {
			cls: "indices-section",
		});
		indicesSection.createEl("summary", { text: "Index Relationships" });

		// Add New Index button
		new Setting(indicesSection)
			.setName("Add New Index")
			.setDesc("Create a new index")
			.addButton((btn) =>
				btn
					.setButtonText("New Index")
					.setCta()
					.onClick(() => {
						new NewIndexModal(this.app, this.plugin).open();
					}),
			);

		// Create Canvas button
		new Setting(indicesSection)
			.setName("Visualize Index Relationships")
			.setDesc("Create an Obsidian Canvas showing index relationships")
			.addButton((btn) =>
				btn
					.setButtonText("Create Canvas")
					.setCta()
					.onClick(() => {
						new IndexRelationshipsCanvasModal(
							this.app,
							this.plugin,
						).open();
					}),
			);

		// Add CSS for better visual hierarchy
		const style = document.createElement("style");
		style.textContent = `
			.indices-section, .questions-section, .note-types-section {
				margin-top: 20px;
				padding: 10px;
				border-radius: 5px;
				background-color: var(--background-secondary);
			}

			.index-details, .question-details, .note-type-container {
				margin: 10px 0;
				padding: 10px;
				border-left: 2px solid var(--interactive-accent);
				background-color: var(--background-primary);
				border-radius: 5px;
			}

			.nested-index-details, .nested-question-details, .subtype-details {
				margin: 10px 0 10px 20px;
				padding: 10px;
				border-left: 2px solid var(--text-accent);
				background-color: var(--background-secondary-alt);
				border-radius: 5px;
			}

			.new-entry-config, .frontmatter-container, .questions-container {
				margin: 10px 0 10px 20px;
				padding: 10px;
				border-left: 2px solid var(--text-muted);
				background-color: var(--background-modifier-form-field);
				border-radius: 5px;
			}

			.index-buttons {
				padding: 10px;
				background-color: var(--background-secondary-alt);
				border-radius: 5px;
				margin: 10px 0;
			}

			details summary {
				padding: 5px;
				cursor: pointer;
				font-weight: bold;
			}

			details summary:hover {
				background-color: var(--background-modifier-hover);
			}

			.question-setting, .index-setting, .nested-question-setting {
				border-bottom: 1px solid var(--background-modifier-border);
				padding-bottom: 5px;
			}
		`;
		document.head.appendChild(style);

		// Group indices by their relationships
		const indices = this.plugin.configManager.getAllIndices();
		const processedIndices = new Set<string>();

		// First process parent indices (level 0)
		Object.entries(indices).forEach(
			([indexName, index]: [string, Index]) => {
				if (index.level === 0 && index.children?.length) {
					const childIndex = index.children[0];
					const childData = indices[childIndex];

					if (
						!processedIndices.has(indexName) &&
						!processedIndices.has(childIndex)
					) {
						const indexDetails = indicesSection.createEl(
							"details",
							{
								cls: "index-details",
							},
						);
						indexDetails.createEl("summary", {
							text: `${indexName} → ${childIndex}`,
						});

						// Add buttons container
						const buttonsContainer = indexDetails.createEl("div", {
							cls: "index-buttons",
							attr: {
								style: "display: flex; gap: 10px; margin-bottom: 10px;",
							},
						});

						// Parent index buttons
						new Setting(buttonsContainer)
							.setName(`Add New ${indexName} Entry`)
							.setDesc(`Create a new entry in ${indexName} index`)
							.addButton((btn) =>
								btn
									.setButtonText("New Entry")
									.setCta()
									.onClick(() => {
										new NewIndexEntryModal(
											this.app,
											this.plugin,
											indexName,
											index,
										).open();
									}),
							);

						// Child index buttons
						new Setting(buttonsContainer)
							.setName(`Add New ${childIndex} Entry`)
							.setDesc(
								`Create a new entry in ${childIndex} index`,
							)
							.addButton((btn) =>
								btn
									.setButtonText("New Entry")
									.setCta()
									.onClick(() => {
										new NewIndexEntryModal(
											this.app,
											this.plugin,
											childIndex,
											childData,
										).open();
									}),
							);

						if (index.nested) {
							new Setting(buttonsContainer)
								.setName("View Entry Relationships")
								.setDesc(
									"Create a canvas showing relationships between entries",
								)
								.addButton((btn) =>
									btn
										.setButtonText("View Entries")
										.onClick(() => {
											new IndexEntriesCanvasModal(
												this.app,
												this.plugin,
												indexName,
												index,
											).open();
										}),
								);
						}

						// Parent index details
						const parentDetails = indexDetails.createEl("details", {
							cls: "nested-index-details",
						});
						parentDetails.createEl("summary", { text: indexName });

						new Setting(parentDetails)
							.setName("Level")
							.setDesc(index.level.toString())
							.setClass("index-setting");

						new Setting(parentDetails)
							.setName("Nested")
							.setDesc(index.nested ? "Yes" : "No")
							.setClass("index-setting");

						const entriesCount = Object.keys(index.entries).length;
						new Setting(parentDetails)
							.setName("Entries Count")
							.setDesc(entriesCount.toString())
							.setClass("index-setting");

						// Child index details
						const childDetails = indexDetails.createEl("details", {
							cls: "nested-index-details",
						});
						childDetails.createEl("summary", { text: childIndex });

						new Setting(childDetails)
							.setName("Level")
							.setDesc(childData.level.toString())
							.setClass("index-setting");

						new Setting(childDetails)
							.setName("Nested")
							.setDesc(childData.nested ? "Yes" : "No")
							.setClass("index-setting");

						const childEntriesCount = Object.keys(
							childData.entries,
						).length;
						new Setting(childDetails)
							.setName("Entries Count")
							.setDesc(childEntriesCount.toString())
							.setClass("index-setting");

						processedIndices.add(indexName);
						processedIndices.add(childIndex);
					}
				}
			},
		);

		// Then process standalone indices (no parent-child relationship)
		Object.entries(indices).forEach(
			([indexName, index]: [string, Index]) => {
				if (!processedIndices.has(indexName)) {
					const indexDetails = indicesSection.createEl("details", {
						cls: "index-details",
					});
					indexDetails.createEl("summary", { text: indexName });

					// Add buttons container
					const buttonsContainer = indexDetails.createEl("div", {
						cls: "index-buttons",
						attr: {
							style: "display: flex; gap: 10px; margin-bottom: 10px;",
						},
					});

					new Setting(buttonsContainer)
						.setName("Add New Entry")
						.setDesc("Create a new entry in this index")
						.addButton((btn) =>
							btn
								.setButtonText("New Entry")
								.setCta()
								.onClick(() => {
									new NewIndexEntryModal(
										this.app,
										this.plugin,
										indexName,
										index,
									).open();
								}),
						);

					if (index.nested) {
						new Setting(buttonsContainer)
							.setName("View Entry Relationships")
							.setDesc(
								"Create a canvas showing relationships between entries",
							)
							.addButton((btn) =>
								btn
									.setButtonText("View Entries")
									.onClick(() => {
										new IndexEntriesCanvasModal(
											this.app,
											this.plugin,
											indexName,
											index,
										).open();
									}),
							);
					}

					new Setting(indexDetails)
						.setName("Level")
						.setDesc(index.level.toString())
						.setClass("index-setting");

					new Setting(indexDetails)
						.setName("Nested")
						.setDesc(index.nested ? "Yes" : "No")
						.setClass("index-setting");

					const entriesCount = Object.keys(index.entries).length;
					new Setting(indexDetails)
						.setName("Entries Count")
						.setDesc(entriesCount.toString())
						.setClass("index-setting");

					processedIndices.add(indexName);
				}
			},
		);

		// Note Types Section
		const noteTypesSection = containerEl.createEl("details", {
			cls: "note-types-section",
		});
		noteTypesSection.createEl("summary", { text: "Note Types" });

		// Add New Note Type button
		new Setting(noteTypesSection)
			.setName("Add New Note Type")
			.setDesc("Create a new note type")
			.addButton((btn) =>
				btn
					.setButtonText("New Note Type")
					.setCta()
					.onClick(() => {
						new NewNoteTypeModal(this.app, this.plugin).open();
					}),
			);

		const noteTypes = this.plugin.configManager.getNoteConfig().noteTypes;

		noteTypes.forEach((noteType: NoteType) => {
			const noteTypeContainer = noteTypesSection.createEl("details", {
				cls: "note-type-container",
			});

			noteTypeContainer.createEl("summary", {
				text: `${noteType.id}`,
				cls: "note-type-header",
			});

			// Add New Subtype button
			new Setting(noteTypeContainer)
				.setName("Add New Subtype")
				.setDesc("Create a new subtype for this note type")
				.addButton((btn) =>
					btn
						.setButtonText("Add Subtype")
						.setCta()
						.onClick(() => {
							new NewSubtypeModal(
								this.app,
								this.plugin,
								noteType.id,
							).open();
						}),
				);

			if (noteType.baseFrontMatterPath) {
				new Setting(noteTypeContainer)
					.setName("Base Front Matter Path")
					.setDesc(noteType.baseFrontMatterPath)
					.setClass("note-type-setting");
			}

			const subtypesContainer = noteTypeContainer.createEl("details", {
				cls: "subtypes-container",
			});
			subtypesContainer.createEl("summary", { text: "Subtypes" });

			noteType.subtypes.forEach((subtype: NoteSubtype) => {
				const subtypeDetails = subtypesContainer.createEl("details", {
					cls: "subtype-details",
				});
				subtypeDetails.createEl("summary", { text: subtype.id });

				new Setting(subtypeDetails)
					.setName("Folder")
					.setDesc(subtype.folder)
					.setClass("subtype-setting");

				if (subtype.template) {
					new Setting(subtypeDetails)
						.setName("Template")
						.setDesc(subtype.template)
						.setClass("subtype-setting");
				}

				// Add buttons for managing questions
				const questionsContainer = subtypeDetails.createEl("details", {
					cls: "questions-container",
				});
				questionsContainer.createEl("summary", {
					text: "Configured Questions",
				});

				// Add Question button with dropdown
				new Setting(questionsContainer)
					.setName("Add Question")
					.setDesc("Add an existing question to this subtype")
					.addDropdown((dropdown) => {
						const allQuestions =
							this.plugin.configManager.getNoteConfig().questions;
						const unusedQuestions = allQuestions.filter(
							(q) => !subtype.questions?.includes(q.questionId),
						);

						dropdown.addOption("", "Select a question...");
						unusedQuestions.forEach((q) => {
							dropdown.addOption(
								q.questionId,
								`${q.questionId} (${q.type})`,
							);
						});

						dropdown.onChange(async (value) => {
							if (!value) return;

							if (!subtype.questions) {
								subtype.questions = [];
							}
							subtype.questions.push(value);
							await this.plugin.configManager.saveData();

							// Refresh just the questions container without collapsing
							const currentContainer =
								questionsContainer.querySelector(
									".questions-container",
								) as HTMLElement;
							if (currentContainer) {
								this.displayConfiguredQuestions(
									currentContainer,
									subtype.questions,
								);
							}
						});
					});

				// Display existing questions
				if (subtype.questions && subtype.questions.length > 0) {
					subtype.questions.forEach((questionId: string) => {
						const question = this.plugin.configManager
							.getNoteConfig()
							.questions.find((q) => q.questionId === questionId);
						const container = questionsContainer.createEl("div", {
							cls: "question-config",
							attr: {
								style: "margin-bottom: 10px; padding: 5px; border-left: 2px solid var(--interactive-accent);",
							},
						});

						new Setting(container)
							.setName("Question ID")
							.setDesc(questionId)
							.setClass("question-setting");

						if (question) {
							if (
								question.type === "nestedTpsuggester" &&
								question.nest
							) {
								// Display Answer IDs
								const answerIds = question.nest
									.map((q, i) => `${i + 1}. ${q.answerId}`)
									.join("\n");
								new Setting(container)
									.setName("Answer IDs")
									.setDesc(answerIds)
									.setClass("question-setting");

								// Display Prompts
								const prompts = question.nest
									.map((q, i) => `${i + 1}. ${q.prompt}`)
									.join("\n");
								new Setting(container)
									.setName("Prompts")
									.setDesc(prompts)
									.setClass("question-setting");

								// Show Index Relationship
								const parentIndex = question.indexName;
								if (parentIndex) {
									const childIndex =
										this.plugin.configManager.getIndexConfig(
											parentIndex,
										)?.children?.[0];
									new Setting(container)
										.setName("Index Relationship")
										.setDesc(
											`${parentIndex} → ${childIndex || "N/A"}`,
										)
										.setClass("question-setting");
								}

								new Setting(container)
									.setName("Type")
									.setDesc("Nested TPSuggester")
									.setClass("question-setting");
							} else {
								// Display for non-nested questions remains the same
								new Setting(container)
									.setName("Prompt")
									.setDesc(question.prompt)
									.setClass("question-setting");

								new Setting(container)
									.setName("Answer ID")
									.setDesc(question.answerId || "N/A")
									.setClass("question-setting");

								new Setting(container)
									.setName("Type")
									.setDesc(question.type)
									.setClass("question-setting");
							}
						}
					});
				}

				// Add buttons for managing front matter
				const frontMatterContainer = subtypeDetails.createEl(
					"details",
					{
						cls: "frontmatter-container",
					},
				);
				frontMatterContainer.createEl("summary", {
					text: "Front Matter Configuration",
				});

				// Add Front Matter Field button
				new Setting(frontMatterContainer)
					.setName("Add Front Matter Field")
					.setDesc("Add a new front matter field to this subtype")
					.addButton((btn) =>
						btn
							.setButtonText("Add Field")
							.setCta()
							.onClick(async () => {
								const newField: FrontMatterField = {
									id: "",
									value: "",
									type: "text" as FrontMatterType,
								};
								if (!subtype.frontMatter) {
									subtype.frontMatter = [];
								}
								subtype.frontMatter.push(newField);
								await this.plugin.configManager.saveData();

								// Refresh just the front matter fields without collapsing
								const fieldsContainer =
									frontMatterContainer.querySelector(
										".frontmatter-fields",
									) as HTMLElement;
								if (!fieldsContainer) {
									const newFieldsContainer =
										frontMatterContainer.createEl("div", {
											cls: "frontmatter-fields",
										});
									this.displayFrontMatterFields(
										newFieldsContainer,
										subtype.frontMatter,
									);
								} else {
									this.displayFrontMatterFields(
										fieldsContainer,
										subtype.frontMatter,
									);
								}
							}),
					);

				// Display existing front matter fields
				if (subtype.frontMatter && subtype.frontMatter.length > 0) {
					subtype.frontMatter.forEach((field, index) => {
						const fieldContainer = frontMatterContainer.createEl(
							"div",
							{
								cls: "frontmatter-field",
								attr: {
									style: "margin-bottom: 10px; padding: 5px; border-left: 2px solid var(--interactive-accent);",
								},
							},
						);

						new Setting(fieldContainer)
							.setName("Field")
							.setDesc(field.id)
							.addText((text) =>
								text
									.setValue(field.id)
									.onChange(async (value) => {
										field.id = value;
										await this.plugin.configManager.saveData();
									}),
							);

						new Setting(fieldContainer)
							.setName("Type")
							.setDesc("Select the type of front matter field")
							.addDropdown((dropdown) =>
								dropdown
									.addOption("text", "Text")
									.addOption("link", "Internal Link")
									.addOption("list", "List")
									.addOption("number", "Number")
									.addOption("checkbox", "Checkbox")
									.addOption("date", "Date (YYYY-MM-DD)")
									.addOption(
										"datetime",
										"Date & Time (YYYY-MM-DDTHH:mm)",
									)
									.addOption(
										"templater",
										"Templater Function",
									)
									.setValue(field.type)
									.onChange((value) => {
										field.type = value as FrontMatterType;
										if (value === "templater") {
											this.showTemplaterFunctionInput(
												fieldContainer,
												field,
											);
										}
										this.plugin.configManager.saveData();
									}),
							);

						new Setting(fieldContainer)
							.setName("Value Template")
							.addText((text) =>
								text
									.setValue(field.value)
									.setPlaceholder(
										"Value (can include {{placeholders}})",
									)
									.onChange(async (value) => {
										field.value = value;
										await this.plugin.configManager.saveData();
									}),
							);

						new Setting(fieldContainer).addButton((btn) =>
							btn.setButtonText("Remove").onClick(async () => {
								subtype.frontMatter.splice(index, 1);
								await this.plugin.configManager.saveData();
								this.displayFrontMatterFields(
									frontMatterContainer,
									subtype.frontMatter,
								);
							}),
						);

						// Show placeholders
						const placeholders = field.value.match(/{{[^}]+}}/g) as
							| string[]
							| null;
						if (placeholders) {
							const placeholderContainer =
								fieldContainer.createEl("div", {
									cls: "placeholder-list",
									attr: { style: "margin-left: 20px;" },
								});
							placeholderContainer.createEl("small", {
								text:
									"Uses placeholders: " +
									placeholders.join(", "),
								attr: { style: "color: var(--text-muted);" },
							});
						}
					});
				}
			});
		});
	}

	private displayNestedQuestions(container: HTMLElement, question: Question) {
		if (question.type === "nestedTpsuggester" && question.nest) {
			const nestedSection = container.createEl("details", {
				cls: "nested-questions-section",
			});
			nestedSection.createEl("summary", { text: "Nested Questions" });

			question.nest.forEach((nestedQ: Question, index: number) => {
				const nestedDetails = nestedSection.createEl("details", {
					cls: "nested-question-details",
				});
				nestedDetails.createEl("summary", {
					text: `Nested Question ${index + 1}: ${nestedQ.questionId}`,
				});

				// Basic settings remain the same...
				new Setting(nestedDetails)
					.setName("Question ID")
					.setDesc(nestedQ.questionId)
					.setClass("nested-question-setting");

				new Setting(nestedDetails)
					.setName("Answer ID")
					.setDesc(nestedQ.answerId || nestedQ.questionId)
					.setClass("nested-question-setting");

				new Setting(nestedDetails)
					.setName("Type")
					.setDesc(nestedQ.type || "tpsuggester")
					.setClass("nested-question-setting");

				new Setting(nestedDetails)
					.setName("Prompt")
					.setDesc(nestedQ.prompt || "No prompt specified")
					.setClass("nested-question-setting");

				// Create New Entry Configuration
				if (nestedQ.createNewEntry) {
					const newEntryDetails = nestedDetails.createEl("details", {
						cls: "new-entry-config",
					});
					newEntryDetails.createEl("summary", {
						text: "Create New Entry Configuration",
					});

					new Setting(newEntryDetails)
						.setName("Can Create New Entry")
						.setDesc("Yes")
						.setClass("nested-question-setting");

					if (nestedQ.newEntryNoteType) {
						new Setting(newEntryDetails)
							.setName("Note Type")
							.setDesc(nestedQ.newEntryNoteType)
							.setClass("nested-question-setting");
					}

					if (nestedQ.newEntryNoteSubtype) {
						new Setting(newEntryDetails)
							.setName("Note Subtype")
							.setDesc(nestedQ.newEntryNoteSubtype)
							.setClass("nested-question-setting");
					}
				}

				// Rest of the settings remain the same...
				if (nestedQ.indexName) {
					new Setting(nestedDetails)
						.setName("Index Name")
						.setDesc(nestedQ.indexName)
						.setClass("nested-question-setting");
				}

				if (nestedQ.allowManualEntry !== undefined) {
					new Setting(nestedDetails)
						.setName("Allow Manual Entry")
						.setDesc(nestedQ.allowManualEntry ? "Yes" : "No")
						.setClass("nested-question-setting");
				}

				if (nestedQ.multipleSelections !== undefined) {
					new Setting(nestedDetails)
						.setName("Multiple Selections")
						.setDesc(nestedQ.multipleSelections ? "Yes" : "No")
						.setClass("nested-question-setting");
				}

				if (nestedQ.parents && nestedQ.parents.length > 0) {
					new Setting(nestedDetails)
						.setName("Parent Answer IDs")
						.setDesc(nestedQ.parents.join(", "))
						.setClass("nested-question-setting");
				}

				if (nestedQ.type === "nestedTpsuggester" && nestedQ.nest) {
					this.displayNestedQuestions(nestedDetails, nestedQ);
				}
			});
		}
	}

	private displayConfiguredQuestions(
		container: HTMLElement,
		questionIds: string[],
	): void {
		const allQuestions =
			this.plugin.configManager.getNoteConfig().questions;

		questionIds.forEach((questionId) => {
			const question = allQuestions.find(
				(q) => q.questionId === questionId,
			);
			if (!question) return;

			const questionContainer = container.createEl("div", {
				cls: "configured-question",
				attr: {
					style: "margin-bottom: 15px; padding: 10px; border: 1px solid var(--background-modifier-border); border-radius: 5px;",
				},
			});

			// Question ID and Type
			questionContainer.createEl("div", {
				text: `Question ID: ${question.questionId} (${question.type})`,
				attr: { style: "font-weight: bold; margin-bottom: 10px;" },
			});

			if (question.type === "nestedTpsuggester" && question.nest) {
				// Display nested questions in a numbered list
				const nestedList = questionContainer.createEl("ol", {
					attr: { style: "margin: 10px 0; padding-left: 20px;" },
				});

				question.nest.forEach((nestedQ, index) => {
					const listItem = nestedList.createEl("li", {
						attr: { style: "margin-bottom: 10px;" },
					});

					listItem.createEl("div", {
						text: `Level ${index}:`,
						attr: {
							style: "font-weight: bold; margin-bottom: 5px;",
						},
					});

					listItem.createEl("div", {
						text: `Prompt: ${nestedQ.prompt || "N/A"}`,
						attr: { style: "margin-left: 10px;" },
					});

					listItem.createEl("div", {
						text: `Answer ID: ${nestedQ.answerId || "N/A"}`,
						attr: { style: "margin-left: 10px;" },
					});

					listItem.createEl("div", {
						text: `Index: ${nestedQ.indexName || "N/A"}`,
						attr: { style: "margin-left: 10px;" },
					});
				});
			} else {
				// Display regular question details
				questionContainer.createEl("div", {
					text: `Prompt: ${question.prompt || "N/A"}`,
				});

				questionContainer.createEl("div", {
					text: `Answer ID: ${question.answerId || "N/A"}`,
				});

				if (question.type === "tpsuggester") {
					questionContainer.createEl("div", {
						text: `Index: ${question.indexName || "N/A"}`,
					});
				}
			}

			// Display additional configuration
			if (question.allowManualEntry) {
				const manualEntryDiv = questionContainer.createEl("div", {
					attr: {
						style: "margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--background-modifier-border);",
					},
				});

				manualEntryDiv.createEl("div", {
					text: "✓ Allows Manual Entry",
					attr: { style: "color: var(--text-success);" },
				});

				if (question.createNewEntry) {
					manualEntryDiv.createEl("div", {
						text: "✓ Can Create New Entries",
						attr: { style: "color: var(--text-success);" },
					});

					if (question.newEntryNoteType) {
						manualEntryDiv.createEl("div", {
							text: `Note Type: ${question.newEntryNoteType}`,
							attr: { style: "margin-left: 10px;" },
						});

						if (question.newEntryNoteSubtype) {
							manualEntryDiv.createEl("div", {
								text: `Note Subtype: ${question.newEntryNoteSubtype}`,
								attr: { style: "margin-left: 10px;" },
							});
						}
					}
				}
			}
		});
	}

	// Add helper method to display front matter fields
	private displayFrontMatterFields(
		container: HTMLElement,
		fields: FrontMatterField[],
	): void {
		container.empty();

		fields.forEach((field, index) => {
			const fieldContainer = container.createEl("div", {
				cls: "frontmatter-field",
				attr: {
					style: "margin-bottom: 10px; padding: 5px; border-left: 2px solid var(--interactive-accent);",
				},
			});

			new Setting(fieldContainer).setName("Field").addText((text) =>
				text.setValue(field.id).onChange(async (value) => {
					field.id = value;
					await this.plugin.configManager.saveData();
				}),
			);

			new Setting(fieldContainer)
				.setName("Type")
				.setDesc("Select the type of front matter field")
				.addDropdown((dropdown) =>
					dropdown
						.addOption("text", "Text")
						.addOption("link", "Internal Link")
						.addOption("list", "List")
						.addOption("number", "Number")
						.addOption("checkbox", "Checkbox")
						.addOption("date", "Date (YYYY-MM-DD)")
						.addOption("datetime", "Date & Time (YYYY-MM-DDTHH:mm)")
						.addOption("templater", "Templater Function")
						.setValue(field.type)
						.onChange((value) => {
							field.type = value as FrontMatterType;
							if (value === "templater") {
								this.showTemplaterFunctionInput(
									fieldContainer,
									field,
								);
							}
							this.plugin.configManager.saveData();
						}),
				);

			new Setting(fieldContainer)
				.setName("Value Template")
				.addText((text) =>
					text
						.setValue(field.value)
						.setPlaceholder("Value (can include {{placeholders}})")
						.onChange(async (value) => {
							field.value = value;
							await this.plugin.configManager.saveData();
						}),
				);

			new Setting(fieldContainer).addButton((btn) =>
				btn.setButtonText("Remove").onClick(async () => {
					fields.splice(index, 1);
					await this.plugin.configManager.saveData();
					this.displayFrontMatterFields(container, fields);
				}),
			);

			// Show placeholders
			const placeholders = field.value.match(/{{[^}]+}}/g) as
				| string[]
				| null;
			if (placeholders) {
				const placeholderContainer = fieldContainer.createEl("div", {
					cls: "placeholder-list",
					attr: { style: "margin-left: 20px;" },
				});
				placeholderContainer.createEl("small", {
					text: "Uses placeholders: " + placeholders.join(", "),
					attr: { style: "color: var(--text-muted);" },
				});
			}
		});
	}

	// Add helper method for templater function input
	private showTemplaterFunctionInput(
		container: HTMLElement,
		field: FrontMatterField,
	) {
		new Setting(container)
			.setName("Templater Function")
			.setDesc(
				"Enter the templater function (e.g., tp.file.creation_date())",
			)
			.addText((text) =>
				text
					.setPlaceholder("<% tp.file.creation_date() %>")
					.setValue(field.templaterFunction || "")
					.onChange((value) => {
						field.templaterFunction = value;
						field.value = value; // Set the value to the templater function
						this.plugin.configManager.saveData();
					}),
			);
	}
}
