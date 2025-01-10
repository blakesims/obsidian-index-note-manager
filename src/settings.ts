import {
	App,
	PluginSettingTab,
	Setting,
	TextAreaComponent,
	Modal,
	Notice,
} from "obsidian";
import { IndexNoteManagerPlugin } from "./pluginTypes";
import { NoteType, NoteSubtype, Question, Index, IndexEntry } from "./types";

interface FrontMatterField {
	id: string;
	value: string;
	type: "string" | "link";
}

class NewIndexEntryModal extends Modal {
	private indexName: string;
	private index: Index;
	private plugin: IndexNoteManagerPlugin;
	private entryName: string = "";
	private parentEntry: string | null = null;

	constructor(
		app: App,
		plugin: IndexNoteManagerPlugin,
		indexName: string,
		index: Index,
	) {
		super(app);
		this.plugin = plugin;
		this.indexName = indexName;
		this.index = index;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: `New Entry for ${this.indexName}` });

		// Entry name input
		new Setting(contentEl)
			.setName("Entry Name")
			.setDesc("Enter the name for the new entry")
			.addText((text) =>
				text
					.setPlaceholder("Entry name")
					.onChange((value) => (this.entryName = value.trim())),
			);

		// Parent selection if needed
		if (this.index.parents && this.index.parents.length > 0) {
			const parentIndex = this.plugin.configManager.getIndexConfig(
				this.index.parents[0],
			);
			const parentEntries = Object.keys(parentIndex?.entries || {});

			if (parentEntries.length === 0) {
				new Notice(
					`No parent entries available in ${this.index.parents[0]}`,
				);
				this.close();
				return;
			}

			new Setting(contentEl)
				.setName("Parent Entry")
				.setDesc(`Select parent from ${this.index.parents[0]}`)
				.addDropdown((dropdown) => {
					dropdown.addOption("", "Select a parent...");
					parentEntries.forEach((entry) => {
						dropdown.addOption(entry, entry);
					});
					dropdown.onChange(
						(value) => (this.parentEntry = value || null),
					);
				});
		}

		// Save button
		new Setting(contentEl).addButton((btn) =>
			btn
				.setButtonText("Save")
				.setCta()
				.onClick(async () => {
					if (!this.entryName) {
						new Notice("Entry name is required");
						return;
					}

					if (
						this.index.parents &&
						this.index.parents.length > 0 &&
						!this.parentEntry
					) {
						new Notice("Parent entry is required");
						return;
					}

					// Check if entry already exists
					const existingEntries = Object.keys(this.index.entries);
					if (existingEntries.includes(this.entryName)) {
						new Notice(`Entry "${this.entryName}" already exists`);
						return;
					}

					try {
						const newEntry: Record<string, IndexEntry> = {
							[this.entryName]: {
								metadata: {
									level: this.index.level,
									parents: this.parentEntry
										? [this.parentEntry]
										: [],
								},
								children: {},
							},
						};

						await this.plugin.configManager.updateIndexEntries(
							this.indexName,
							newEntry,
							this.parentEntry,
						);
						new Notice(`Created new entry "${this.entryName}"`);
						this.close();
					} catch (error) {
						new Notice(`Failed to create entry: ${error.message}`);
						console.error("Failed to create entry:", error);
					}
				}),
		);
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class NewNoteTypeModal extends Modal {
	private plugin: IndexNoteManagerPlugin;
	private typeId: string = "";
	private baseFrontMatterPath: string = "";

	constructor(app: App, plugin: IndexNoteManagerPlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: "New Note Type" });

		// Type ID input
		new Setting(contentEl)
			.setName("Type ID")
			.setDesc("Enter the ID for the new note type")
			.addText((text) =>
				text
					.setPlaceholder("Type ID")
					.onChange((value) => (this.typeId = value.trim())),
			);

		// Base front matter path input
		new Setting(contentEl)
			.setName("Base Front Matter Path")
			.setDesc("(Optional) Path to base front matter template")
			.addText((text) =>
				text
					.setPlaceholder("Path to base front matter")
					.onChange(
						(value) => (this.baseFrontMatterPath = value.trim()),
					),
			);

		// Save button
		new Setting(contentEl).addButton((btn) =>
			btn
				.setButtonText("Save")
				.setCta()
				.onClick(async () => {
					if (!this.typeId) {
						new Notice("Type ID is required");
						return;
					}

					const noteConfig =
						this.plugin.configManager.getNoteConfig();

					// Check if type already exists
					if (
						noteConfig.noteTypes.some(
							(type) => type.id === this.typeId,
						)
					) {
						new Notice(`Note type "${this.typeId}" already exists`);
						return;
					}

					try {
						noteConfig.noteTypes.push({
							id: this.typeId,
							baseFrontMatterPath:
								this.baseFrontMatterPath || undefined,
							subtypes: [],
						});

						await this.plugin.configManager.setNoteConfig(
							noteConfig,
						);
						await this.plugin.configManager.saveData();
						new Notice(`Created new note type "${this.typeId}"`);
						this.close();
					} catch (error) {
						new Notice(
							`Failed to create note type: ${error.message}`,
						);
						console.error("Failed to create note type:", error);
					}
				}),
		);
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class NewSubtypeModal extends Modal {
	private plugin: IndexNoteManagerPlugin;
	private noteTypeId: string;
	private subtypeId: string = "";
	private folder: string = "";
	private template: string = "";
	private selectedQuestions: string[] = [];
	private frontMatterFields: FrontMatterField[] = [];

	constructor(app: App, plugin: IndexNoteManagerPlugin, noteTypeId: string) {
		super(app);
		this.plugin = plugin;
		this.noteTypeId = noteTypeId;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", {
			text: `New Subtype for ${this.noteTypeId}`,
		});

		// Subtype ID input
		new Setting(contentEl)
			.setName("Subtype ID")
			.setDesc("Enter the ID for the new subtype")
			.addText((text) =>
				text
					.setPlaceholder("Subtype ID")
					.onChange((value) => (this.subtypeId = value.trim())),
			);

		// Folder input
		new Setting(contentEl)
			.setName("Folder")
			.setDesc("Enter the folder path for this subtype")
			.addText((text) =>
				text
					.setPlaceholder("Folder path")
					.onChange((value) => (this.folder = value.trim())),
			);

		// Template input
		new Setting(contentEl)
			.setName("Template")
			.setDesc("(Optional) Path to template file")
			.addText((text) =>
				text
					.setPlaceholder("Template path")
					.onChange((value) => (this.template = value.trim())),
			);

		// Questions selection
		this.displayQuestionsSection(contentEl);

		// Front Matter Configuration
		this.frontMatterContainer = contentEl.createEl("details");
		this.frontMatterContainer.createEl("summary", {
			text: "Front Matter Configuration",
		});

		// Add Front Matter Entry button
		new Setting(this.frontMatterContainer)
			.setName("Add Front Matter Entry")
			.setDesc("Add a new front matter field")
			.addButton((btn) =>
				btn.setButtonText("Add Field").onClick(() => {
					this.frontMatterFields.push({
						id: "",
						value: "",
						type: "string",
					});
					this.refreshFrontMatterSection();
				}),
			);

		// Save button
		new Setting(contentEl).addButton((btn) =>
			btn
				.setButtonText("Save")
				.setCta()
				.onClick(async () => {
					if (!this.subtypeId) {
						new Notice("Subtype ID is required");
						return;
					}

					if (!this.folder) {
						new Notice("Folder is required");
						return;
					}

					// Check if subtype already exists
					const existingSubtypes = this.plugin.configManager
						.getNoteConfig()
						.noteTypes.find(
							(type) => type.id === this.noteTypeId,
						)?.subtypes;
					if (
						existingSubtypes?.some(
							(subtype) => subtype.id === this.subtypeId,
						)
					) {
						new Notice(
							`Subtype "${this.subtypeId}" already exists`,
						);
						return;
					}

					try {
						const noteConfig =
							this.plugin.configManager.getNoteConfig();
						const typeIndex = noteConfig.noteTypes.findIndex(
							(type) => type.id === this.noteTypeId,
						);

						if (typeIndex === -1) {
							throw new Error("Note type not found");
						}

						const newSubtype: NoteSubtype = {
							id: this.subtypeId,
							folder: this.folder,
							template: this.template || "",
							title: this.subtypeId,
							questions: this.selectedQuestions,
							frontMatter: this.frontMatterFields.map(
								(field) => ({
									id: field.id,
									value: field.value,
									type: field.type,
								}),
							),
						};

						noteConfig.noteTypes[typeIndex].subtypes.push(
							newSubtype,
						);
						await this.plugin.configManager.setNoteConfig(
							noteConfig,
						);
						await this.plugin.configManager.saveData();
						new Notice(`Created new subtype "${this.subtypeId}"`);
						this.close();
					} catch (error) {
						new Notice(
							`Failed to create subtype: ${error.message}`,
						);
						console.error("Failed to create subtype:", error);
					}
				}),
		);
	}

	private displayQuestionsSection(containerEl: HTMLElement) {
		const questionsContainer = containerEl.createEl("details");
		questionsContainer.createEl("summary", { text: "Select Questions" });

		// Add help text
		questionsContainer.createEl("p", {
			text: "Select questions to be asked when creating notes of this type. The answer IDs from these questions will be available as placeholders in the front matter configuration below.",
			attr: { style: "margin-bottom: 10px; color: var(--text-muted);" },
		});

		const questions = this.plugin.configManager.getNoteConfig().questions;
		questions.forEach((question) => {
			new Setting(questionsContainer)
				.setName(question.questionId)
				.setDesc(this.getQuestionDescription(question))
				.addToggle((toggle) =>
					toggle
						.setValue(
							this.selectedQuestions.includes(
								question.questionId,
							),
						)
						.onChange((value) => {
							if (value) {
								this.selectedQuestions.push(
									question.questionId,
								);
							} else {
								this.selectedQuestions =
									this.selectedQuestions.filter(
										(id) => id !== question.questionId,
									);
							}
							// Refresh the front matter section to update available answer IDs
							this.refreshFrontMatterSection();
						}),
				);
		});
	}

	private getQuestionDescription(question: Question): string {
		if (question.type === "nestedTpsuggester" && question.nest) {
			return `Nested questions:\n${question.nest
				.map(
					(q, i) =>
						`${i + 1}. ${q.prompt} (Answer ID: ${q.answerId})`,
				)
				.join("\n")}`;
		}
		return question.prompt || "No prompt specified";
	}

	private refreshFrontMatterSection() {
		if (this.frontMatterContainer) {
			this.frontMatterContainer.empty();
			this.displayFrontMatterSection(this.frontMatterContainer);
		}
	}

	private frontMatterContainer: HTMLElement;

	private displayFrontMatterSection(containerEl: HTMLElement) {
		this.frontMatterContainer = containerEl;
		const frontMatterDetails = containerEl.createEl("details");
		frontMatterDetails.createEl("summary", {
			text: "Front Matter Configuration",
		});

		// Add help text
		frontMatterDetails.createEl("p", {
			text: "Configure the front matter fields for this note subtype. You can use answer IDs from selected questions as placeholders in the values.",
			attr: { style: "margin-bottom: 10px; color: var(--text-muted);" },
		});

		// Display available answer IDs from selected questions
		const availableAnswerIds = this.getAvailableAnswerIds();
		if (availableAnswerIds.size > 0) {
			const answerIdsContainer = frontMatterDetails.createEl("div", {
				cls: "answer-ids-container",
				attr: {
					style: "margin: 10px 0; padding: 10px; background-color: var(--background-secondary); border-radius: 5px;",
				},
			});

			answerIdsContainer.createEl("h3", {
				text: "Available Placeholders from Selected Questions",
				attr: { style: "margin: 0 0 10px 0; font-size: 0.9em;" },
			});

			const list = answerIdsContainer.createEl("ul", {
				attr: { style: "margin: 0; padding-left: 20px;" },
			});

			Array.from(availableAnswerIds)
				.sort()
				.forEach((id) => {
					list.createEl("li", {
						text: `{{${id}}}`,
						attr: { style: "font-family: monospace;" },
					});
				});
		}

		// Add Field button and existing fields
		new Setting(frontMatterDetails)
			.setName("Add Front Matter Entry")
			.setDesc("Add a new front matter field")
			.addButton((btn) =>
				btn.setButtonText("Add Field").onClick(() => {
					this.frontMatterFields.push({
						id: "",
						value: "",
						type: "string",
					});
					this.refreshFrontMatterSection();
				}),
			);

		// Display existing front matter fields
		this.frontMatterFields.forEach((field, index) => {
			const fieldContainer = frontMatterDetails.createEl("div", {
				cls: "front-matter-field",
				attr: {
					style: "margin-top: 10px; padding: 10px; border: 1px solid var(--background-modifier-border); border-radius: 5px;",
				},
			});

			new Setting(fieldContainer).setName("Field ID").addText((text) =>
				text
					.setPlaceholder("e.g., tags")
					.setValue(field.id)
					.onChange((value) => {
						this.frontMatterFields[index].id = value;
					}),
			);

			new Setting(fieldContainer)
				.setName("Value")
				.setDesc("Can include placeholders like {{answer_id}}")
				.addText((text) =>
					text
						.setPlaceholder("Value (can include {{placeholders}})")
						.setValue(field.value)
						.onChange((value) => {
							this.frontMatterFields[index].value = value;
						}),
				);

			new Setting(fieldContainer)
				.setName("Type")
				.addDropdown((dropdown) =>
					dropdown
						.addOption("string", "String")
						.addOption("link", "Link")
						.setValue(field.type)
						.onChange((value) => {
							this.frontMatterFields[index].type = value as
								| "string"
								| "link";
						}),
				);

			new Setting(fieldContainer).addButton((btn) =>
				btn.setButtonText("Remove").onClick(() => {
					this.frontMatterFields.splice(index, 1);
					this.refreshFrontMatterSection();
				}),
			);
		});
	}

	private getAvailableAnswerIds(): Set<string> {
		const answerIds = new Set<string>();
		const questions = this.plugin.configManager.getNoteConfig().questions;

		this.selectedQuestions.forEach((selectedId) => {
			const question = questions.find((q) => q.questionId === selectedId);
			if (question) {
				if (question.type === "nestedTpsuggester" && question.nest) {
					question.nest.forEach((q) => {
						if (q.answerId) answerIds.add(q.answerId);
					});
				} else if (question.answerId) {
					answerIds.add(question.answerId);
				}
			}
		});

		return answerIds;
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class PlaceholderViewerModal extends Modal {
	private questions: Question[];

	constructor(app: App, questions: Question[]) {
		super(app);
		this.questions = questions;
	}

	private getNestedQuestionPlaceholders(
		question: Question,
		container: HTMLElement,
	) {
		if (!question.nest) return;

		// Create a section for this nested question group
		const nestedSection = container.createEl("details", {
			cls: "nested-placeholder-group",
		});
		nestedSection.createEl("summary", { text: question.questionId });

		// Add description of the nested structure
		const descEl = nestedSection.createEl("div", {
			cls: "nested-description",
			attr: { style: "margin-bottom: 10px; color: var(--text-muted);" },
		});
		descEl.createEl("small", {
			text: "This is a nested question group. Each nested question's answer will be available as a direct placeholder.",
		});

		// Process each nested question
		question.nest.forEach((nestedQ) => {
			if (nestedQ.answerId) {
				// Create placeholder display
				new Setting(nestedSection)
					.setName(`{{${nestedQ.answerId}}}`)
					.setDesc(`From nested question: ${nestedQ.prompt}`)
					.setClass("placeholder-item");

				// If this nested question has its own nest, process recursively
				if (nestedQ.nest) {
					this.getNestedQuestionPlaceholders(nestedQ, nestedSection);
				}
			}
		});
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: "Available Placeholders" });

		const placeholdersContainer = contentEl.createEl("div", {
			cls: "placeholders-container",
		});

		// Add explanation at the top
		const explanationEl = placeholdersContainer.createEl("div", {
			cls: "placeholder-explanation",
			attr: {
				style: "margin-bottom: 20px; padding: 10px; background: var(--background-secondary);",
			},
		});
		explanationEl.createEl("p", {
			text: "Placeholders are used in templates and front matter. They are replaced with actual values when a note is created.",
			attr: { style: "margin-bottom: 5px;" },
		});
		explanationEl.createEl("p", {
			text: "Note: Nested questions create flat placeholders. Each answer is available directly by its answerId.",
			attr: { style: "color: var(--text-muted);" },
		});

		// Standard questions
		const standardQuestions = this.questions.filter(
			(q) => q.type !== "nestedTpsuggester",
		);
		if (standardQuestions.length > 0) {
			const standardSection = placeholdersContainer.createEl("details", {
				cls: "placeholder-section",
			});
			standardSection.createEl("summary", { text: "Standard Questions" });

			standardQuestions.forEach((question) => {
				if (question.answerId) {
					new Setting(standardSection)
						.setName(`{{${question.answerId}}}`)
						.setDesc(`From question: ${question.prompt}`)
						.setClass("placeholder-item");
				}
			});
		}

		// Nested questions
		const nestedQuestions = this.questions.filter(
			(q) => q.type === "nestedTpsuggester",
		);
		if (nestedQuestions.length > 0) {
			const nestedSection = placeholdersContainer.createEl("details", {
				cls: "placeholder-section",
			});
			nestedSection.createEl("summary", { text: "Nested Questions" });

			nestedQuestions.forEach((question) => {
				this.getNestedQuestionPlaceholders(question, nestedSection);
			});
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

interface CanvasNode {
	id: string;
	type: string;
	text: string;
	x: number;
	y: number;
	width: number;
	height: number;
	color: string;
}

interface CanvasEdge {
	id: string;
	fromNode: string;
	toNode: string;
	fromEnd: string;
	toEnd: string;
	label: string;
	color: string;
}

interface CanvasData {
	nodes: CanvasNode[];
	edges: CanvasEdge[];
}

class IndexRelationshipsCanvasModal extends Modal {
	private plugin: IndexNoteManagerPlugin;
	private canvasName: string = "Index Relationships";

	constructor(app: App, plugin: IndexNoteManagerPlugin) {
		super(app);
		this.plugin = plugin;
	}

	private generateCanvasJson(): CanvasData {
		const indices = this.plugin.configManager.getAllIndices();
		const nodes: CanvasNode[] = [];
		const edges: CanvasEdge[] = [];

		// Constants for layout
		const BOX_WIDTH = 300;
		const BOX_HEIGHT = 150;
		const VERTICAL_GAP = BOX_HEIGHT * 5; // Distance between parent and child rows
		const HORIZONTAL_GAP = BOX_WIDTH * 2; // Gap between nodes in the same row

		// First, identify root nodes (level 0) and child nodes
		const rootIndices = Object.entries(indices).filter(
			([_, index]) => index.level === 0,
		);
		const childIndices = Object.entries(indices).filter(
			([_, index]) => index.level > 0,
		);

		// Position root nodes at y=0, spread horizontally
		let x = 100;
		rootIndices.forEach(([indexName, index]) => {
			nodes.push({
				id: indexName,
				type: "text",
				text: `${indexName}\nLevel: ${index.level}${index.nested ? "\nNested: Yes" : ""}`,
				x,
				y: 0,
				width: BOX_WIDTH,
				height: BOX_HEIGHT,
				color: "4", // green for root nodes
			});
			x += HORIZONTAL_GAP;
		});

		// Position child nodes above, spread horizontally
		x = 100;
		childIndices.forEach(([indexName, index]) => {
			nodes.push({
				id: indexName,
				type: "text",
				text: `${indexName}\nLevel: ${index.level}${index.nested ? "\nNested: Yes" : ""}`,
				x,
				y: VERTICAL_GAP,
				width: BOX_WIDTH,
				height: BOX_HEIGHT,
				color: "5", // cyan for child nodes
			});
			x += HORIZONTAL_GAP;
		});

		// Create edges for parent-child relationships
		Object.entries(indices).forEach(([indexName, index]) => {
			// Parent relationships
			if (index.parents) {
				index.parents.forEach((parentName) => {
					edges.push({
						id: `${parentName}-${indexName}`,
						fromNode: parentName,
						toNode: indexName,
						fromEnd: "none",
						toEnd: "arrow",
						label: "parent of",
						color: "6", // purple for edges
					});
				});
			}

			// Child relationships
			if (index.children) {
				index.children.forEach((childName) => {
					edges.push({
						id: `${indexName}-${childName}`,
						fromNode: indexName,
						toNode: childName,
						fromEnd: "none",
						toEnd: "arrow",
						label: "has child",
						color: "6", // purple for edges
					});
				});
			}
		});

		return { nodes, edges };
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: "Create Index Relationships Canvas" });

		new Setting(contentEl)
			.setName("Canvas Name")
			.setDesc("Enter the name for the canvas file (without extension)")
			.addText((text) =>
				text
					.setValue(this.canvasName)
					.onChange((value) => (this.canvasName = value.trim())),
			);

		new Setting(contentEl).addButton((btn) =>
			btn
				.setButtonText("Create Canvas")
				.setCta()
				.onClick(async () => {
					try {
						const canvasJson = this.generateCanvasJson();
						const fileName = `${this.canvasName}.canvas`;

						// Use Obsidian's adapter to write the file
						await this.app.vault.create(
							fileName,
							JSON.stringify(canvasJson, null, 2),
						);

						new Notice(`Created canvas file: ${fileName}`);
						this.close();
					} catch (error) {
						new Notice(`Failed to create canvas: ${error.message}`);
						console.error("Failed to create canvas:", error);
					}
				}),
		);
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class IndexEntriesCanvasModal extends Modal {
	private plugin: IndexNoteManagerPlugin;
	private indexName: string;
	private index: Index;
	private canvasName: string;

	constructor(
		app: App,
		plugin: IndexNoteManagerPlugin,
		indexName: string,
		index: Index,
	) {
		super(app);
		this.plugin = plugin;
		this.indexName = indexName;
		this.index = index;
		this.canvasName = `${indexName}-entries`;
	}

	private generateEntriesCanvasJson(): CanvasData {
		const nodes: CanvasNode[] = [];
		const edges: CanvasEdge[] = [];

		// Constants for layout
		const BOX_WIDTH = 250;
		const BOX_HEIGHT = 100;
		const VERTICAL_GAP = BOX_HEIGHT * 3;
		const HORIZONTAL_GAP = BOX_WIDTH * 1.5;
		const GROUP_GAP = BOX_WIDTH * 2; // Additional gap between groups

		// Get all parent entries and sort them
		const parentEntries = Object.entries(this.index.entries);
		let currentX = 0; // Keep track of rightmost position

		// Process each parent and its children as a group
		parentEntries.forEach(([parentName, parentEntry]) => {
			const childEntries = parentEntry.children?.course || [];
			if (childEntries.length === 0) return;

			// Place children first
			const childNodes: any[] = [];
			childEntries.forEach((childName: string, index: number) => {
				const childNode = {
					id: childName,
					type: "text",
					text: childName,
					x: currentX + index * HORIZONTAL_GAP,
					y: VERTICAL_GAP,
					width: BOX_WIDTH,
					height: BOX_HEIGHT,
					color: "5", // cyan for child nodes
				};
				childNodes.push(childNode);
				nodes.push(childNode);

				// Create edge from parent to child
				edges.push({
					id: `${parentName}-${childName}`,
					fromNode: parentName,
					toNode: childName,
					fromEnd: "none",
					toEnd: "arrow",
					label: "has course",
					color: "6", // purple for edges
				});
			});

			// Calculate parent x position as midpoint of its children
			const groupStartX = currentX;
			const groupEndX =
				currentX + (childEntries.length - 1) * HORIZONTAL_GAP;
			const parentX = groupStartX + (groupEndX - groupStartX) / 2;

			// Add parent node
			nodes.push({
				id: parentName,
				type: "text",
				text: parentName,
				x: parentX,
				y: 0,
				width: BOX_WIDTH,
				height: BOX_HEIGHT,
				color: "4", // green for parent nodes
			});

			// Update currentX to start next group after this one
			currentX = groupEndX + GROUP_GAP;
		});

		return { nodes, edges };
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h2", {
			text: `Create Entry Relationships Canvas for ${this.indexName}`,
		});

		new Setting(contentEl)
			.setName("Canvas Name")
			.setDesc("Enter the name for the canvas file (without extension)")
			.addText((text) =>
				text
					.setValue(this.canvasName)
					.onChange((value) => (this.canvasName = value.trim())),
			);

		new Setting(contentEl).addButton((btn) =>
			btn
				.setButtonText("Create Canvas")
				.setCta()
				.onClick(async () => {
					try {
						const canvasJson = this.generateEntriesCanvasJson();
						const fileName = `${this.canvasName}.canvas`;

						await this.app.vault.create(
							fileName,
							JSON.stringify(canvasJson, null, 2),
						);

						new Notice(`Created canvas file: ${fileName}`);
						this.close();
					} catch (error) {
						new Notice(`Failed to create canvas: ${error.message}`);
						console.error("Failed to create canvas:", error);
					}
				}),
		);
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class NewIndexModal extends Modal {
	private plugin: IndexNoteManagerPlugin;
	private indexId: string = "";
	private isNested: boolean = false;
	private level: number = 0;
	private parentIndex: string | null = null;
	private dynamicFieldsContainer: HTMLElement;

	constructor(app: App, plugin: IndexNoteManagerPlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: "Create New Index" });

		// Index ID
		new Setting(contentEl)
			.setName("Index ID")
			.setDesc("Enter the ID for the new index")
			.addText((text) =>
				text
					.setPlaceholder("Index ID")
					.onChange((value) => (this.indexId = value.trim())),
			);

		// Is Nested
		new Setting(contentEl)
			.setName("Nested Index")
			.setDesc("Is this a nested index?")
			.addToggle((toggle) =>
				toggle.setValue(this.isNested).onChange((value) => {
					this.isNested = value;
					this.refreshDynamicFields();
				}),
			);

		// Container for dynamic fields
		this.dynamicFieldsContainer = contentEl.createEl("div");
		this.refreshDynamicFields();

		// Save button
		new Setting(contentEl).addButton((btn) =>
			btn
				.setButtonText("Create Index")
				.setCta()
				.onClick(async () => {
					if (!this.validateFields()) {
						return;
					}

					try {
						await this.createIndex();
					} catch (error) {
						new Notice(`Failed to create index: ${error.message}`);
						console.error("Failed to create index:", error);
					}
				}),
		);
	}

	private async createIndex(): Promise<void> {
		const newIndex: Index = {
			nested: this.isNested,
			level: this.level,
			entries: {},
			// Safely handle parent index reference
			parents: this.level === 1 && this.parentIndex ? [this.parentIndex] : undefined,
			children: this.level === 0 ? [] : undefined,
		};

		await this.plugin.configManager.addIndex(this.indexId, newIndex);

		// Update parent's children array if this is a child index
		if (this.level === 1 && this.parentIndex) {
			const parentIndex = this.plugin.configManager.getIndexConfig(this.parentIndex);
			if (parentIndex) {
				if (!parentIndex.children) {
					parentIndex.children = [];
				}
				if (!parentIndex.children.includes(this.indexId)) {
					parentIndex.children.push(this.indexId);
					await this.plugin.configManager.updateParentIndex(this.parentIndex, parentIndex);
				}
			}
		}

		new Notice(`Created new index "${this.indexId}"`);
		this.close();
	}

	private refreshDynamicFields(): void {
		this.dynamicFieldsContainer.empty();

		if (this.isNested) {
			// Show level selection only for nested indices
			new Setting(this.dynamicFieldsContainer)
				.setName("Level")
				.setDesc(
					"Index level (0 for root indices, 1 for child indices)",
				)
				.addDropdown((dropdown) =>
					dropdown
						.addOption("0", "Level 0 (Root)")
						.addOption("1", "Level 1 (Child)")
						.onChange((value) => {
							this.level = parseInt(value);
							this.refreshParentSelection();
						}),
				);

			// Container for parent selection
			const parentSelectionContainer =
				this.dynamicFieldsContainer.createEl("div");
			this.refreshParentSelection(parentSelectionContainer);
		} else {
			// Non-nested indices are always level 0
			this.level = 0;
		}
	}

	private refreshParentSelection(
		container: HTMLElement = this.dynamicFieldsContainer,
	) {
		container.empty();

		if (this.isNested && this.level === 1) {
			// Get available parent indices (level 0 indices without children)
			const availableParents = Object.entries(
				this.plugin.configManager.getAllIndices(),
			)
				.filter(
					([_, index]) =>
						index.level === 0 &&
						index.nested &&
						(!index.children || index.children.length === 0),
				)
				.map(([name, _]) => name);

			if (availableParents.length === 0) {
				container.createEl("p", {
					text: "No available parent indices. Create a level 0 nested index first.",
					attr: { style: "color: var(--text-error);" },
				});
				return;
			}

			new Setting(container)
				.setName("Parent Index")
				.setDesc(
					"Select the parent index (must be a level 0 nested index without children)",
				)
				.addDropdown((dropdown) => {
					dropdown.addOption("", "Select parent...");
					availableParents.forEach((name) =>
						dropdown.addOption(name, name),
					);
					dropdown.onChange(
						(value) => (this.parentIndex = value || null),
					);
				});
		}
	}

	private validateFields(): boolean {
		if (!this.indexId) {
			new Notice("Index ID is required");
			return false;
		}

		// Check if index already exists
		const existingIndices = Object.keys(
			this.plugin.configManager.getAllIndices(),
		);
		if (existingIndices.includes(this.indexId)) {
			new Notice(`Index "${this.indexId}" already exists`);
			return false;
		}

		if (this.isNested && this.level === 1 && !this.parentIndex) {
			new Notice("Parent index is required for level 1 indices");
			return false;
		}

		return true;
	}
}

class NewQuestionModal extends Modal {
	private plugin: IndexNoteManagerPlugin;
	private dynamicFieldsContainer: HTMLElement;
	private questionId: string = "";
	private answerId: string = "";
	private type: string = "inputPrompt";
	private prompt: string = "";
	private frontMatterType: string = "";
	private indexName: string = "";
	private parentAnswerId: string = "";
	private allowManualEntry: boolean = false;
	private createNewEntry: boolean = false;
	private multipleSelections: boolean = false;
	private newEntryNoteType: string = "";
	private newEntryNoteSubtype: string = "";
	private isNested: boolean = false;
	private nestedQuestions: any[] = [];

	constructor(app: App, plugin: IndexNoteManagerPlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: "Create New Question" });

		// Basic fields
		new Setting(contentEl)
			.setName("Question ID")
			.setDesc("Unique identifier for this question")
			.addText((text) =>
				text
					.setPlaceholder("e.g., student_name_question")
					.onChange((value) => (this.questionId = value.trim())),
			);

		// Question Type
		new Setting(contentEl)
			.setName("Question Type")
			.setDesc("Select the type of question")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("inputPrompt", "Input Prompt")
					.addOption("tpsuggester", "Index Suggester")
					.addOption("nestedTpsuggester", "Nested Index Suggester")
					.onChange((value) => {
						this.type = value;
						this.refreshDynamicFields();
					}),
			);

		// Container for dynamic fields
		this.dynamicFieldsContainer = contentEl.createEl("div");
		this.refreshDynamicFields();

		// Save button
		new Setting(contentEl).addButton((btn) =>
			btn
				.setButtonText("Save")
				.setCta()
				.onClick(async () => {
					if (!this.validateFields()) {
						return;
					}

					try {
						const noteConfig =
							this.plugin.configManager.getNoteConfig();
						const newQuestion = this.createQuestionConfig();

						noteConfig.questions.push(newQuestion);
						await this.plugin.configManager.setNoteConfig(
							noteConfig,
						);
						await this.plugin.configManager.saveData();

						new Notice(`Created new question "${this.questionId}"`);
						this.close();
					} catch (error) {
						new Notice(
							`Failed to create question: ${error.message}`,
						);
						console.error("Failed to create question:", error);
					}
				}),
		);
	}

	private getNestedIndices(): { name: string; display: string; depth: number }[] {
		const indices = this.plugin.configManager.getAllIndices();
		const nestedGroups: { name: string; display: string; depth: number }[] = [];

		// Find root indices (level 0) that are nested
		Object.entries(indices).forEach(([indexName, index]) => {
			if (index.nested && index.level === 0) {
				let currentIndex = index;
				let currentName = indexName;
				let depth = 1;
				let displayName = indexName;
				
				// Follow the chain of children
				while (currentIndex.children && currentIndex.children.length > 0) {
					const childName = currentIndex.children[0];
					const childIndex = indices[childName];
					if (!childIndex) break;
					
					displayName += ` → ${childName}`;
					currentIndex = childIndex;
					currentName = childName;
					depth++;
				}

				nestedGroups.push({
					name: indexName,
					display: displayName,
					depth: depth
				});
			}
		});

		return nestedGroups;
	}

	private refreshDynamicFields(): void {
		this.dynamicFieldsContainer.empty();

		// Answer ID for input prompts
		if (this.type === 'inputPrompt') {
			new Setting(this.dynamicFieldsContainer)
				.setName("Answer ID")
				.setDesc("ID used in placeholders (use snake_case)")
				.addText((text) =>
					text
						.setPlaceholder("e.g., student_name")
						.setValue(this.answerId)
						.onChange((value) => {
							const snakeCaseValue = value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
							if (value !== snakeCaseValue) {
								text.setValue(snakeCaseValue);
							}
							this.answerId = snakeCaseValue;
						}),
				);

			new Setting(this.dynamicFieldsContainer)
				.setName("Prompt")
				.setDesc("Question prompt shown to user")
				.addText((text) =>
					text
						.setPlaceholder("Enter the prompt...")
						.setValue(this.prompt)
						.onChange((value) => (this.prompt = value.trim())),
				);
		}

		// Index selection for TPSuggester and Nested TPSuggester
		if (this.type === 'tpsuggester' || this.type === 'nestedTpsuggester') {
			if (this.type === 'tpsuggester') {
				// For regular TPSuggester, show all indices but add warning for child indices
				const indices = this.plugin.configManager.getAllIndices();
				const indexOptions = Object.entries(indices).map(([name, index]) => ({
					name,
					level: index.level
				}));

				new Setting(this.dynamicFieldsContainer)
					.setName('Index')
					.setDesc('Select the index to use')
					.addDropdown(dropdown => {
						dropdown.addOption('', 'Select index...');
						indexOptions.forEach(({ name, level }) => {
							dropdown.addOption(name, name);
						});
						dropdown.setValue(this.indexName);
						dropdown.onChange(value => {
							this.indexName = value;
							if (value && indices[value].level > 0) {
								const warningEl = this.dynamicFieldsContainer.createEl('div', {
									cls: 'warning',
									attr: {
										style: 'color: var(--text-warning); margin-top: 10px; font-size: 0.9em;'
									}
								});
								warningEl.createEl('strong', { text: 'Note: ' });
								warningEl.appendText('This is a child index. Consider using a Nested Index Suggester if you need to select parent entries first.');
							}
						});
					});
			} else {
				// For Nested TPSuggester, only show nested index groups
				const nestedGroups = this.getNestedIndices();

				if (nestedGroups.length === 0) {
					const warningEl = this.dynamicFieldsContainer.createEl('div', {
						cls: 'warning',
						attr: {
							style: 'color: var(--text-error); margin-bottom: 10px;'
						}
					});
					warningEl.createEl('strong', { text: 'No nested indices found. ' });
					warningEl.appendText('Create a nested index group first.');
					return;
				}

				// Group Question ID
				new Setting(this.dynamicFieldsContainer)
					.setName('Group Question ID')
					.setDesc('Unique identifier for this nested question group (use snake_case)')
					.addText(text => {
						text.setPlaceholder('e.g., university_course_for_student')
							.setValue(this.questionId)
							.onChange(value => {
								const snakeCaseValue = value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
								if (value !== snakeCaseValue) {
									text.setValue(snakeCaseValue);
								}
								this.questionId = snakeCaseValue;
							});
					});

				new Setting(this.dynamicFieldsContainer)
					.setName('Nested Index Group')
					.setDesc('Select the nested index group to use')
					.addDropdown(dropdown => {
						dropdown.addOption('', 'Select nested index group...');
						nestedGroups.forEach(group => {
							dropdown.addOption(group.name, group.display);
						});
						dropdown.setValue(this.indexName);
						dropdown.onChange(value => {
							this.indexName = value;
							if (value) {
								const selectedGroup = nestedGroups.find(g => g.name === value);
								if (selectedGroup) {
									this.setupNestedQuestions(selectedGroup.depth);
									this.isNested = true;
									this.refreshDynamicFields();
								}
							}
						});
					});

				// Remove redundant fields for nested questions
				if (this.type !== 'nestedTpsuggester' || !this.isNested) {
					// Answer ID and Prompt only for non-nested questions
					new Setting(this.dynamicFieldsContainer)
						.setName("Answer ID")
						.setDesc("ID used in placeholders")
						.addText((text) =>
							text
								.setPlaceholder("e.g., student_name")
								.setValue(this.answerId)
								.onChange((value) => (this.answerId = value.trim())),
						);

					new Setting(this.dynamicFieldsContainer)
						.setName("Prompt")
						.setDesc("Question prompt shown to user")
						.addText((text) =>
							text
								.setPlaceholder("Enter the prompt...")
								.setValue(this.prompt)
								.onChange((value) => (this.prompt = value.trim())),
						);

					// Common settings only for non-nested questions
					new Setting(this.dynamicFieldsContainer)
						.setName("Allow Manual Entry")
						.setDesc("Allow users to enter custom values")
						.addToggle((toggle) =>
							toggle.setValue(this.allowManualEntry).onChange((value) => {
								this.allowManualEntry = value;
								if (!value) {
									this.createNewEntry = false;
								}
								this.refreshDynamicFields();
							}),
						);

					if (this.allowManualEntry) {
						new Setting(this.dynamicFieldsContainer)
							.setName("Create New Entry")
							.setDesc("Allow creating new index entries")
							.addToggle((toggle) =>
								toggle
									.setValue(this.createNewEntry)
									.onChange((value) => {
										this.createNewEntry = value;
										this.refreshDynamicFields();
									}),
							);

						if (this.createNewEntry) {
							const noteTypes = this.plugin.configManager.getNoteConfig().noteTypes;

							new Setting(this.dynamicFieldsContainer)
								.setName("New Entry Note Type")
								.setDesc("Note type for new entries")
								.addDropdown((dropdown) => {
									dropdown.addOption("", "Select note type...");
									noteTypes.forEach((type) =>
										dropdown.addOption(type.id, type.id),
									);
									dropdown.setValue(this.newEntryNoteType);
									dropdown.onChange((value) => {
										this.newEntryNoteType = value;
										this.refreshDynamicFields();
									});
								});

							if (this.newEntryNoteType) {
								const selectedType = noteTypes.find(
									(t) => t.id === this.newEntryNoteType,
								);
								if (selectedType) {
									new Setting(this.dynamicFieldsContainer)
										.setName("New Entry Note Subtype")
										.setDesc("Note subtype for new entries")
										.addDropdown((dropdown) => {
											dropdown.addOption("", "Select subtype...");
											selectedType.subtypes.forEach((subtype) =>
												dropdown.addOption(subtype.id, subtype.id),
											);
											dropdown.setValue(this.newEntryNoteSubtype);
											dropdown.onChange(
												(value) =>
													(this.newEntryNoteSubtype = value),
											);
										});
								}
							}
						}
					}
				}

				new Setting(this.dynamicFieldsContainer)
					.setName("Allow Multiple Selections")
					.setDesc("Allow selecting multiple values")
					.addToggle((toggle) =>
						toggle
							.setValue(this.multipleSelections)
							.onChange((value) => (this.multipleSelections = value)),
					);
			}

			// Nested questions configuration
			if (this.type === "nestedTpsuggester" && this.isNested && this.nestedQuestions.length > 0) {
				const nestedContainer = this.dynamicFieldsContainer.createEl('div', {
					cls: 'nested-questions-container',
					attr: {
						style: 'margin-top: 20px; padding: 10px; background-color: var(--background-secondary); border-radius: 5px;'
					}
				});

				nestedContainer.createEl('h3', {
					text: 'Nested Questions Configuration',
					attr: { style: 'margin: 0 0 10px 0;' }
				});

				// Help text
				nestedContainer.createEl('p', {
					text: 'Configure the prompts for each level of the nested index. Answer IDs are automatically set to match the index names.',
					attr: { style: 'margin-bottom: 15px; color: var(--text-muted);' }
				});

				// Show nested questions configuration
				this.nestedQuestions.forEach((question, index) => {
					const questionContainer = nestedContainer.createEl('div', {
						cls: 'nested-question-config',
						attr: {
							style: 'margin-bottom: 20px; padding: 10px; border: 1px solid var(--background-modifier-border); border-radius: 5px;'
						}
					});

					// Level indicator
					questionContainer.createEl('div', {
						text: `Level ${index} Index: ${question.answerId}`,
						attr: {
							style: 'font-weight: bold; margin-bottom: 10px; color: var(--text-accent);'
						}
					});

					// Question ID (read-only display)
					new Setting(questionContainer)
						.setName('Question ID')
						.setDesc('Automatically generated from index name')
						.addText(text => text
							.setValue(question.questionId)
							.setDisabled(true)
						);

					// Answer ID (read-only display)
					new Setting(questionContainer)
						.setName('Answer ID')
						.setDesc('Matches the index name for this level')
						.addText(text => text
							.setValue(question.answerId)
							.setDisabled(true)
						);

					// Prompt (editable)
					new Setting(questionContainer)
						.setName('Prompt')
						.setDesc(`Enter the prompt for selecting a ${question.answerId}`)
						.addText(text => text
							.setPlaceholder(`e.g., Select a ${question.answerId}...`)
							.setValue(question.prompt)
							.onChange(value => {
								this.nestedQuestions[index].prompt = value.trim();
							})
						);

					// Common settings for each level
					new Setting(questionContainer)
						.setName('Allow Manual Entry')
						.setDesc('Allow users to enter custom values')
						.addToggle(toggle => toggle
							.setValue(question.allowManualEntry)
							.onChange(value => {
								this.nestedQuestions[index].allowManualEntry = value;
								if (!value) {
									this.nestedQuestions[index].createNewEntry = false;
								}
								this.refreshDynamicFields();
							})
						);

					if (question.allowManualEntry) {
						new Setting(questionContainer)
							.setName('Create New Entry')
							.setDesc('Allow creating new index entries')
							.addToggle(toggle => toggle
								.setValue(question.createNewEntry)
								.onChange(value => {
									this.nestedQuestions[index].createNewEntry = value;
									this.refreshDynamicFields();
								})
							);

						if (question.createNewEntry) {
							const noteTypes = this.plugin.configManager.getNoteConfig().noteTypes;
							
							new Setting(questionContainer)
								.setName('New Entry Note Type')
								.setDesc('Note type for new entries')
								.addDropdown(dropdown => {
									dropdown.addOption('', 'Select note type...');
									noteTypes.forEach(type => dropdown.addOption(type.id, type.id));
									dropdown.setValue(question.newEntryNoteType || '');
									dropdown.onChange(value => {
										this.nestedQuestions[index].newEntryNoteType = value;
										this.refreshDynamicFields();
									});
								});

							if (question.newEntryNoteType) {
								const selectedType = noteTypes.find(t => t.id === question.newEntryNoteType);
								if (selectedType) {
									new Setting(questionContainer)
										.setName('New Entry Note Subtype')
										.setDesc('Note subtype for new entries')
										.addDropdown(dropdown => {
											dropdown.addOption('', 'Select subtype...');
											selectedType.subtypes.forEach(subtype => 
												dropdown.addOption(subtype.id, subtype.id)
											);
											dropdown.setValue(question.newEntryNoteSubtype || '');
											dropdown.onChange(value => {
												this.nestedQuestions[index].newEntryNoteSubtype = value;
											});
										});
								}
							}
						}
					}

					new Setting(questionContainer)
						.setName('Allow Multiple Selections')
						.setDesc('Allow selecting multiple values')
						.addToggle(toggle => toggle
							.setValue(question.multipleSelections)
							.onChange(value => {
								this.nestedQuestions[index].multipleSelections = value;
							})
						);
				});
			}
		}
	}

	private setupNestedQuestions(depth: number): void {
		// Clear existing questions
		this.nestedQuestions = [];
		
		// Get the chain of indices
		const indices = this.plugin.configManager.getAllIndices();
		let currentIndex = indices[this.indexName];
		let currentName = this.indexName;
		
		// Create a question for each level
		for (let i = 0; i < depth; i++) {
			this.nestedQuestions.push({
				answerId: currentName,
				prompt: '',
				allowManualEntry: false,
				createNewEntry: false,
				multipleSelections: false
			});

			// Move to next index in chain
			if (currentIndex.children && currentIndex.children.length > 0) {
				currentName = currentIndex.children[0];
				currentIndex = indices[currentName];
			}
		}
	}

	private validateFields(): boolean {
		if (!this.questionId) {
			new Notice("Question ID is required");
			return false;
		}

		// Check if question ID already exists
		const existingQuestions =
			this.plugin.configManager.getNoteConfig().questions;
		if (existingQuestions.some((q) => q.questionId === this.questionId)) {
			new Notice(`Question "${this.questionId}" already exists`);
			return false;
		}

		if (!this.isNested && !this.answerId) {
			new Notice("Answer ID is required");
			return false;
		}

		if (!this.prompt && !this.isNested) {
			new Notice("Prompt is required");
			return false;
		}

		if (
			(this.type === "tpsuggester" ||
				this.type === "nestedTpsuggester") &&
			!this.indexName
		) {
			new Notice("Index selection is required");
			return false;
		}

		if (
			this.createNewEntry &&
			(!this.newEntryNoteType || !this.newEntryNoteSubtype)
		) {
			new Notice(
				"Note type and subtype are required when creating new entries",
			);
			return false;
		}

		if (this.isNested) {
			if (this.nestedQuestions.length === 0) {
				new Notice("At least one nested question is required");
				return false;
			}

			for (const [index, question] of this.nestedQuestions.entries()) {
				if (
					!question.questionId ||
					!question.answerId ||
					!question.prompt
				) {
					new Notice(
						`All fields are required for nested question ${index + 1}`,
					);
					return false;
				}
			}
		}

		return true;
	}

	private createQuestionConfig(): any {
		if (this.type === "nestedTpsuggester" && this.isNested) {
			return {
				questionId: this.questionId,
				type: this.type,
				indexName: this.indexName,
				frontMatterType: this.frontMatterType || undefined,
				nest: this.nestedQuestions.map((q, index) => ({
					questionId: q.questionId,
					answerId: q.answerId,
					prompt: q.prompt,
					allowManualEntry: q.allowManualEntry,
					createNewEntry: q.createNewEntry,
					newEntryNoteType: q.createNewEntry
						? q.newEntryNoteType
						: undefined,
					newEntryNoteSubtype: q.createNewEntry
						? q.newEntryNoteSubtype
						: undefined,
					multipleSelections: q.multipleSelections,
					frontMatterType: this.frontMatterType || undefined,
					...(index === 1
						? { parents: [this.nestedQuestions[0].answerId] }
						: {}),
				})),
			};
		}

		const config: any = {
			questionId: this.questionId,
			answerId: this.answerId,
			type: this.type,
			prompt: this.prompt,
		};

		if (this.frontMatterType) {
			config.frontMatterType = this.frontMatterType;
		}

		if (this.type === "tpsuggester" || this.type === "nestedTpsuggester") {
			config.indexName = this.indexName;
			config.allowManualEntry = this.allowManualEntry;
			config.createNewEntry = this.createNewEntry;
			config.multipleSelections = this.multipleSelections;

			if (this.createNewEntry) {
				config.newEntryNoteType = this.newEntryNoteType;
				config.newEntryNoteSubtype = this.newEntryNoteSubtype;
			}

			if (this.type === "nestedTpsuggester" && !this.isNested) {
				config.parentAnswerId = this.parentAnswerId;
			}
		}

		return config;
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

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

		// Add JSON Editor Section
		const jsonSection = containerEl.createEl("details", {
			cls: "json-editor-section",
		});
		jsonSection.createEl("summary", { text: "JSON Configuration" });

		new Setting(jsonSection)
			.setName("Configuration")
			.setDesc("Edit the raw JSON configuration")
			.addTextArea((text) => {
				this.jsonEditor = text;
				text.setValue(
					JSON.stringify(
						this.plugin.configManager.getNoteConfig(),
						null,
						2,
					),
				)
					.setPlaceholder("Enter your configuration here")
					.onChange(async (value) => {
						try {
							const config = JSON.parse(value);
							await this.plugin.configManager.setNoteConfig(
								config,
							);
							await this.plugin.configManager.saveData();
							this.display(); // Refresh the display
						} catch (e) {
							console.error("Invalid JSON:", e);
						}
					});
				text.inputEl.rows = 20;
				text.inputEl.cols = 50;
			});

		// Questions Section
		const questionsSection = containerEl.createEl("details", {
			cls: "questions-section",
		});
		questionsSection.createEl("summary", {
			text: "Questions Configuration",
		});

		const questions = this.plugin.configManager.getNoteConfig().questions;
		questions.forEach((question: Question) => {
			const questionDetails = questionsSection.createEl("details", {
				cls: "question-details",
			});
			questionDetails.createEl("summary", { text: question.questionId });

			// Basic question info
			new Setting(questionDetails)
				.setName("Question ID")
				.setDesc(question.questionId)
				.setClass("question-setting");

			// For nested questions, show all answer IDs that will be generated
			if (question.type === "nestedTpsuggester" && question.nest) {
				const answerIdsList = question.nest
					.map((q, i) => `${i + 1}. ${q.answerId}`)
					.join("\n");
				new Setting(questionDetails)
					.setName("Answer IDs")
					.setDesc(answerIdsList)
					.setClass("question-setting");

				// Show all prompts in sequence
				const promptsList = question.nest
					.map((q, i) => `${i + 1}. ${q.prompt}`)
					.join("\n");
				new Setting(questionDetails)
					.setName("Prompts")
					.setDesc(promptsList)
					.setClass("question-setting");

				// Show the index relationship
				const parentIndex = question.indexName;
				if (parentIndex) {
					const childIndex =
						this.plugin.configManager.getIndexConfig(parentIndex)
							?.children?.[0];
					new Setting(questionDetails)
						.setName("Index Relationship")
						.setDesc(`${parentIndex} → ${childIndex || "N/A"}`)
						.setClass("question-setting");
				}
			} else {
				new Setting(questionDetails)
					.setName("Answer ID")
					.setDesc(question.answerId || "N/A")
					.setClass("question-setting");

				new Setting(questionDetails)
					.setName("Prompt")
					.setDesc(question.prompt || "No prompt specified")
					.setClass("question-setting");

				if (question.indexName) {
					new Setting(questionDetails)
						.setName("Index Name")
						.setDesc(question.indexName)
						.setClass("question-setting");
				}
			}

			new Setting(questionDetails)
				.setName("Type")
				.setDesc(question.type)
				.setClass("question-setting");

			// Index-related settings
			if (question.indexName) {
				new Setting(questionDetails)
					.setName("Index Name")
					.setDesc(question.indexName)
					.setClass("question-setting");
			}

			if (question.createNewEntry !== undefined) {
				new Setting(questionDetails)
					.setName("Can Create New Entry")
					.setDesc(question.createNewEntry ? "Yes" : "No")
					.setClass("question-setting");
			}

			if (question.allowManualEntry !== undefined) {
				new Setting(questionDetails)
					.setName("Allow Manual Entry")
					.setDesc(question.allowManualEntry ? "Yes" : "No")
					.setClass("question-setting");
			}

			if (question.multipleSelections !== undefined) {
				new Setting(questionDetails)
					.setName("Multiple Selections")
					.setDesc(question.multipleSelections ? "Yes" : "No")
					.setClass("question-setting");
			}

			// Nested questions
			if (question.type === "nestedTpsuggester") {
				this.displayNestedQuestions(questionDetails, question);
			}
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
						.setButtonText("New Subtype")
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

				// Enhanced Front Matter display
				if (subtype.frontMatter && subtype.frontMatter.length > 0) {
					const frontMatterDetails = subtypeDetails.createEl(
						"details",
						{
							cls: "frontmatter-container",
						},
					);
					frontMatterDetails.createEl("summary", {
						text: "Front Matter Configuration",
					});

					subtype.frontMatter.forEach((field) => {
						const fieldContainer = frontMatterDetails.createEl(
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
							.setClass("frontmatter-setting");

						new Setting(fieldContainer)
							.setName("Type")
							.setDesc(field.type)
							.setClass("frontmatter-setting");

						new Setting(fieldContainer)
							.setName("Value Template")
							.setDesc(field.value)
							.setClass("frontmatter-setting");

						// Add placeholder detection
						const placeholders = field.value.match(/{{[^}]+}}/g);
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

				// Enhanced Questions display
				if (subtype.questions && subtype.questions.length > 0) {
					const questionsDetails = subtypeDetails.createEl('details', {
						cls: 'questions-container'
					});
					questionsDetails.createEl('summary', { text: 'Configured Questions' });

					subtype.questions.forEach((questionId: string) => {
						const question = questions.find(q => q.questionId === questionId);
						const container = questionsDetails.createEl('div', {
							cls: 'question-config',
							attr: { style: 'margin-bottom: 10px; padding: 5px; border-left: 2px solid var(--interactive-accent);' }
						});

						new Setting(container)
							.setName('Question ID')
							.setDesc(questionId)
							.setClass('question-setting');

						if (question) {
							if (question.type === 'nestedTpsuggester' && question.nest) {
								// Display Answer IDs
								const answerIds = question.nest.map((q, i) => `${i + 1}. ${q.answerId}`).join('\n');
								new Setting(container)
									.setName('Answer IDs')
									.setDesc(answerIds)
									.setClass('question-setting');

								// Display Prompts
								const prompts = question.nest.map((q, i) => `${i + 1}. ${q.prompt}`).join('\n');
								new Setting(container)
									.setName('Prompts')
									.setDesc(prompts)
									.setClass('question-setting');

								// Show Index Relationship
								const parentIndex = question.indexName;
								if (parentIndex) {
									const childIndex = this.plugin.configManager.getIndexConfig(parentIndex)?.children?.[0];
									new Setting(container)
										.setName('Index Relationship')
										.setDesc(`${parentIndex} → ${childIndex || 'N/A'}`)
										.setClass('question-setting');
								}

								new Setting(container)
									.setName('Type')
									.setDesc('Nested TPSuggester')
									.setClass('question-setting');
							} else {
								// Display for non-nested questions remains the same
								new Setting(container)
									.setName('Prompt')
									.setDesc(question.prompt)
									.setClass('question-setting');

								new Setting(container)
									.setName('Answer ID')
									.setDesc(question.answerId || 'N/A')
									.setClass('question-setting');

								new Setting(container)
									.setName('Type')
									.setDesc(question.type)
									.setClass('question-setting');
							}
						}
					});
				}
			});
		});

		// Add View Placeholders button at the top of Questions Section
		new Setting(questionsSection)
			.setName("View Available Placeholders")
			.setDesc(
				"See all placeholders that can be used in templates and front matter",
			)
			.addButton((btn) =>
				btn.setButtonText("View Placeholders").onClick(() => {
					new PlaceholderViewerModal(this.app, questions).open();
				}),
			);

		// Add New Question button
		new Setting(questionsSection)
			.setName("Add New Question")
			.setDesc("Create a new question")
			.addButton((btn) =>
				btn
					.setButtonText("New Question")
					.setCta()
					.onClick(() => {
						new NewQuestionModal(this.app, this.plugin).open();
					}),
			);
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

	private displayConfiguredQuestions(container: HTMLElement, questions: Question[]): void {
		questions.forEach(question => {
			const questionContainer = container.createEl('div', {
				cls: 'configured-question',
				attr: {
					style: 'margin-bottom: 15px; padding: 10px; border: 1px solid var(--background-modifier-border); border-radius: 5px;'
				}
			});

			// Question ID and Type
			questionContainer.createEl('div', {
				text: `Question ID: ${question.questionId} (${question.type})`,
				attr: { style: 'font-weight: bold; margin-bottom: 10px;' }
			});

			if (question.type === 'nestedTpsuggester' && question.nest) {
				// Display nested questions in a numbered list
				const nestedList = questionContainer.createEl('ol', {
						attr: { style: 'margin: 10px 0; padding-left: 20px;' }
					});

				question.nest.forEach((nestedQ: Question, index: number) => {
					const listItem = nestedList.createEl('li', {
						attr: { style: 'margin-bottom: 10px;' }
					});

					listItem.createEl('div', {
						text: `Level ${index}:`,
						attr: { style: 'font-weight: bold; margin-bottom: 5px;' }
					});

					listItem.createEl('div', {
						text: `Prompt: ${nestedQ.prompt || 'N/A'}`,
						attr: { style: 'margin-left: 10px;' }
					});

					listItem.createEl('div', {
						text: `Answer ID: ${nestedQ.indexName || 'N/A'}`,
						attr: { style: 'margin-left: 10px;' }
					});

					listItem.createEl('div', {
						text: `Index: ${nestedQ.indexName || 'N/A'}`,
						attr: { style: 'margin-left: 10px;' }
					});
				});
			} else {
				// Display regular question details
				questionContainer.createEl('div', {
					text: `Prompt: ${question.prompt || 'N/A'}`
				});

				questionContainer.createEl('div', {
					text: `Answer ID: ${question.indexName || 'N/A'}`
				});

				if (question.type === 'tpsuggester') {
					questionContainer.createEl('div', {
						text: `Index: ${question.indexName || 'N/A'}`
					});
				}
			}

			// Display additional configuration
			if (question.allowManualEntry) {
				const manualEntryDiv = questionContainer.createEl('div', {
					attr: { style: 'margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--background-modifier-border);' }
				});

				manualEntryDiv.createEl('div', {
					text: '✓ Allows Manual Entry',
					attr: { style: 'color: var(--text-success);' }
				});

				if (question.createNewEntry) {
					manualEntryDiv.createEl('div', {
						text: '✓ Can Create New Entries',
						attr: { style: 'color: var(--text-success);' }
					});

					if (question.newEntryNoteType) {
						manualEntryDiv.createEl('div', {
							text: `Note Type: ${question.newEntryNoteType}`,
							attr: { style: 'margin-left: 10px;' }
						});

						if (question.newEntryNoteSubtype) {
							manualEntryDiv.createEl('div', {
								text: `Note Subtype: ${question.newEntryNoteSubtype}`,
								attr: { style: 'margin-left: 10px;' }
							});
						}
					}
				}
			}
		});
	}
}

