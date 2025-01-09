import { App, PluginSettingTab, Setting, TextAreaComponent, Modal, ButtonComponent, Notice } from 'obsidian';
import { IndexNoteManagerPlugin } from './pluginTypes';
import { NoteType, NoteSubtype, Question, Index, IndexEntry } from './types';

class NewIndexEntryModal extends Modal {
	private indexName: string;
	private index: Index;
	private plugin: IndexNoteManagerPlugin;
	private entryName: string = '';
	private parentEntry: string | null = null;

	constructor(app: App, plugin: IndexNoteManagerPlugin, indexName: string, index: Index) {
		super(app);
		this.plugin = plugin;
		this.indexName = indexName;
		this.index = index;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl('h2', { text: `New Entry for ${this.indexName}` });

		// Entry name input
		new Setting(contentEl)
			.setName('Entry Name')
			.setDesc('Enter the name for the new entry')
			.addText(text => text
				.setPlaceholder('Entry name')
				.onChange(value => this.entryName = value.trim()));

		// Parent selection if needed
		if (this.index.parents && this.index.parents.length > 0) {
			const parentIndex = this.plugin.configManager.getIndexConfig(this.index.parents[0]);
			const parentEntries = Object.keys(parentIndex?.entries || {});

			if (parentEntries.length === 0) {
				new Notice(`No parent entries available in ${this.index.parents[0]}`);
				this.close();
				return;
			}

			new Setting(contentEl)
				.setName('Parent Entry')
				.setDesc(`Select parent from ${this.index.parents[0]}`)
				.addDropdown(dropdown => {
					dropdown.addOption('', 'Select a parent...');
					parentEntries.forEach(entry => {
						dropdown.addOption(entry, entry);
					});
					dropdown.onChange(value => this.parentEntry = value || null);
				});
		}

		// Save button
		new Setting(contentEl)
			.addButton(btn => btn
				.setButtonText('Save')
				.setCta()
				.onClick(async () => {
					if (!this.entryName) {
						new Notice('Entry name is required');
						return;
					}

					if (this.index.parents?.length > 0 && !this.parentEntry) {
						new Notice('Parent entry is required');
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
									parents: this.parentEntry ? [this.parentEntry] : [],
								},
								children: {}
							}
						};

						await this.plugin.configManager.updateIndexEntries(
							this.indexName,
							newEntry,
							this.parentEntry
						);
						new Notice(`Created new entry "${this.entryName}"`);
						this.close();
					} catch (error) {
						new Notice(`Failed to create entry: ${error.message}`);
						console.error('Failed to create entry:', error);
					}
				}));
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class NewNoteTypeModal extends Modal {
	private plugin: IndexNoteManagerPlugin;
	private typeId: string = '';
	private baseFrontMatterPath: string = '';

	constructor(app: App, plugin: IndexNoteManagerPlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl('h2', { text: 'New Note Type' });

		// Type ID input
		new Setting(contentEl)
			.setName('Type ID')
			.setDesc('Enter the ID for the new note type')
			.addText(text => text
				.setPlaceholder('Type ID')
				.onChange(value => this.typeId = value.trim()));

		// Base front matter path input
		new Setting(contentEl)
			.setName('Base Front Matter Path')
			.setDesc('(Optional) Path to base front matter template')
			.addText(text => text
				.setPlaceholder('Path to base front matter')
				.onChange(value => this.baseFrontMatterPath = value.trim()));

		// Save button
		new Setting(contentEl)
			.addButton(btn => btn
				.setButtonText('Save')
				.setCta()
				.onClick(async () => {
					if (!this.typeId) {
						new Notice('Type ID is required');
						return;
					}

					const noteConfig = this.plugin.configManager.getNoteConfig();
					
					// Check if type already exists
					if (noteConfig.noteTypes.some(type => type.id === this.typeId)) {
						new Notice(`Note type "${this.typeId}" already exists`);
						return;
					}

					try {
						noteConfig.noteTypes.push({
							id: this.typeId,
							baseFrontMatterPath: this.baseFrontMatterPath || undefined,
							subtypes: []
						});

						await this.plugin.configManager.setNoteConfig(noteConfig);
						await this.plugin.configManager.saveData();
						new Notice(`Created new note type "${this.typeId}"`);
						this.close();
					} catch (error) {
						new Notice(`Failed to create note type: ${error.message}`);
						console.error('Failed to create note type:', error);
					}
				}));
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class NewSubtypeModal extends Modal {
	private plugin: IndexNoteManagerPlugin;
	private noteType: NoteType;
	private subtypeId: string = '';
	private folder: string = '';
	private template: string = '';
	private selectedQuestions: string[] = [];
	private frontMatter: Array<{id: string; value: string; type: string}> = [];

	constructor(app: App, plugin: IndexNoteManagerPlugin, noteType: NoteType) {
		super(app);
		this.plugin = plugin;
		this.noteType = noteType;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl('h2', { text: `New Subtype for ${this.noteType.id}` });

		// Subtype ID input
		new Setting(contentEl)
			.setName('Subtype ID')
			.setDesc('Enter the ID for the new subtype')
			.addText(text => text
				.setPlaceholder('Subtype ID')
				.onChange(value => this.subtypeId = value.trim()));

		// Folder input
		new Setting(contentEl)
			.setName('Folder')
			.setDesc('Enter the folder path for this subtype')
			.addText(text => text
				.setPlaceholder('Folder path')
				.onChange(value => this.folder = value.trim()));

		// Template input
		new Setting(contentEl)
			.setName('Template')
			.setDesc('(Optional) Path to template file')
			.addText(text => text
				.setPlaceholder('Template path')
				.onChange(value => this.template = value.trim()));

		// Questions selection
		const questions = this.plugin.configManager.getNoteConfig().questions;
		if (questions.length > 0) {
			const questionContainer = contentEl.createEl('details', { cls: 'questions-container' });
			questionContainer.createEl('summary', { text: 'Select Questions' });

			questions.forEach(question => {
				new Setting(questionContainer)
					.setName(question.questionId)
					.setDesc(question.prompt)
					.addToggle(toggle => toggle
						.onChange(value => {
							if (value) {
								this.selectedQuestions.push(question.questionId);
							} else {
								this.selectedQuestions = this.selectedQuestions.filter(
									id => id !== question.questionId
								);
							}
						}));
			});
		}

		// Front Matter Configuration
		const frontMatterContainer = contentEl.createEl('details', { cls: 'frontmatter-container' });
		frontMatterContainer.createEl('summary', { text: 'Front Matter Configuration' });

		// Add Front Matter Entry button
		new Setting(frontMatterContainer)
			.setName('Add Front Matter Entry')
			.setDesc('Add a new front matter field')
			.addButton(btn => btn
				.setButtonText('Add Field')
				.onClick(() => {
					const fieldContainer = frontMatterContainer.createEl('div', { cls: 'frontmatter-field' });
					
					// Field ID
					new Setting(fieldContainer)
						.setName('Field ID')
						.addText(text => text
							.setPlaceholder('Field ID (e.g., tags)')
							.onChange(value => {
								const index = this.frontMatter.length;
								this.frontMatter[index] = {
									...this.frontMatter[index] || {},
									id: value.trim()
								};
							}));

					// Field Value
					new Setting(fieldContainer)
						.setName('Value')
						.addText(text => text
							.setPlaceholder('Value (can include {{placeholders}})')
							.onChange(value => {
								const index = this.frontMatter.length;
								this.frontMatter[index] = {
									...this.frontMatter[index] || {},
									value: value.trim()
								};
							}));

					// Field Type
					new Setting(fieldContainer)
						.setName('Type')
						.addDropdown(dropdown => {
							dropdown
								.addOption('string', 'String')
								.addOption('link', 'Link')
								.onChange(value => {
									const index = this.frontMatter.length;
									this.frontMatter[index] = {
										...this.frontMatter[index] || {},
										type: value
									};
								});
						});
				}));

		// Save button
		new Setting(contentEl)
			.addButton(btn => btn
				.setButtonText('Save')
				.setCta()
				.onClick(async () => {
					if (!this.subtypeId) {
						new Notice('Subtype ID is required');
						return;
					}

					if (!this.folder) {
						new Notice('Folder is required');
						return;
					}

					// Check if subtype already exists
					const existingSubtypes = this.noteType.subtypes || [];
					if (existingSubtypes.some(subtype => subtype.id === this.subtypeId)) {
						new Notice(`Subtype "${this.subtypeId}" already exists`);
						return;
					}

					try {
						const noteConfig = this.plugin.configManager.getNoteConfig();
						const typeIndex = noteConfig.noteTypes.findIndex(
							type => type.id === this.noteType.id
						);

						if (typeIndex === -1) {
							throw new Error('Note type not found');
						}

						// Validate front matter entries
						const validFrontMatter = this.frontMatter.filter(entry => 
							entry.id && entry.value && entry.type);

						const newSubtype: NoteSubtype = {
							id: this.subtypeId,
							folder: this.folder,
							template: this.template || '',
							title: this.subtypeId,
							questions: this.selectedQuestions,
							frontMatter: validFrontMatter
						};

						noteConfig.noteTypes[typeIndex].subtypes.push(newSubtype);
						await this.plugin.configManager.setNoteConfig(noteConfig);
						await this.plugin.configManager.saveData();
						new Notice(`Created new subtype "${this.subtypeId}"`);
						this.close();
					} catch (error) {
						new Notice(`Failed to create subtype: ${error.message}`);
						console.error('Failed to create subtype:', error);
					}
				}));
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

	private getNestedQuestionPlaceholders(question: Question, container: HTMLElement) {
		if (!question.nest) return;

		// Create a section for this nested question group
		const nestedSection = container.createEl('details', { 
			cls: 'nested-placeholder-group' 
		});
		nestedSection.createEl('summary', { text: question.questionId });

		// Add description of the nested structure
		const descEl = nestedSection.createEl('div', { 
			cls: 'nested-description',
			attr: { style: 'margin-bottom: 10px; color: var(--text-muted);' }
		});
		descEl.createEl('small', { 
			text: 'This is a nested question group. Each nested question\'s answer will be available as a direct placeholder.'
		});

		// Process each nested question
		question.nest.forEach(nestedQ => {
			if (nestedQ.answerId) {
				// Create placeholder display
				new Setting(nestedSection)
					.setName(`{{${nestedQ.answerId}}}`)
					.setDesc(`From nested question: ${nestedQ.prompt}`)
					.setClass('placeholder-item');

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
		contentEl.createEl('h2', { text: 'Available Placeholders' });

		const placeholdersContainer = contentEl.createEl('div', { cls: 'placeholders-container' });

		// Add explanation at the top
		const explanationEl = placeholdersContainer.createEl('div', { 
			cls: 'placeholder-explanation',
			attr: { style: 'margin-bottom: 20px; padding: 10px; background: var(--background-secondary);' }
		});
		explanationEl.createEl('p', { 
			text: 'Placeholders are used in templates and front matter. They are replaced with actual values when a note is created.',
			attr: { style: 'margin-bottom: 5px;' }
		});
		explanationEl.createEl('p', { 
			text: 'Note: Nested questions create flat placeholders. Each answer is available directly by its answerId.',
			attr: { style: 'color: var(--text-muted);' }
		});

		// Standard questions
		const standardQuestions = this.questions.filter(q => q.type !== 'nestedTpsuggester');
		if (standardQuestions.length > 0) {
			const standardSection = placeholdersContainer.createEl('details', { cls: 'placeholder-section' });
			standardSection.createEl('summary', { text: 'Standard Questions' });
			
			standardQuestions.forEach(question => {
				if (question.answerId) {
					new Setting(standardSection)
						.setName(`{{${question.answerId}}}`)
						.setDesc(`From question: ${question.prompt}`)
						.setClass('placeholder-item');
				}
			});
		}

		// Nested questions
		const nestedQuestions = this.questions.filter(q => q.type === 'nestedTpsuggester');
		if (nestedQuestions.length > 0) {
			const nestedSection = placeholdersContainer.createEl('details', { cls: 'placeholder-section' });
			nestedSection.createEl('summary', { text: 'Nested Questions' });
			
			nestedQuestions.forEach(question => {
				this.getNestedQuestionPlaceholders(question, nestedSection);
			});
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class IndexRelationshipsCanvasModal extends Modal {
	private plugin: IndexNoteManagerPlugin;
	private canvasName: string = 'Index Relationships';

	constructor(app: App, plugin: IndexNoteManagerPlugin) {
		super(app);
		this.plugin = plugin;
	}

	private generateCanvasJson(): any {
		const indices = this.plugin.configManager.getAllIndices();
		const nodes: any[] = [];
		const edges: any[] = [];
		
		// Constants for layout
		const BOX_WIDTH = 300;
		const BOX_HEIGHT = 150;
		const VERTICAL_GAP = BOX_HEIGHT * 5; // Distance between parent and child rows
		const HORIZONTAL_GAP = BOX_WIDTH * 2; // Gap between nodes in the same row
		
		// First, identify root nodes (level 0) and child nodes
		const rootIndices = Object.entries(indices).filter(([_, index]) => index.level === 0);
		const childIndices = Object.entries(indices).filter(([_, index]) => index.level > 0);
		
		// Position root nodes at y=0, spread horizontally
		let x = 100;
		rootIndices.forEach(([indexName, index]) => {
			nodes.push({
				id: indexName,
				type: 'text',
				text: `${indexName}\nLevel: ${index.level}${index.nested ? '\nNested: Yes' : ''}`,
				x,
				y: 0,
				width: BOX_WIDTH,
				height: BOX_HEIGHT,
				color: "4" // green for root nodes
			});
			x += HORIZONTAL_GAP;
		});
		
		// Position child nodes above, spread horizontally
		x = 100;
		childIndices.forEach(([indexName, index]) => {
			nodes.push({
				id: indexName,
				type: 'text',
				text: `${indexName}\nLevel: ${index.level}${index.nested ? '\nNested: Yes' : ''}`,
				x,
				y: VERTICAL_GAP,
				width: BOX_WIDTH,
				height: BOX_HEIGHT,
				color: "5" // cyan for child nodes
			});
			x += HORIZONTAL_GAP;
		});

		// Create edges for parent-child relationships
		Object.entries(indices).forEach(([indexName, index]) => {
			// Parent relationships
			if (index.parents) {
				index.parents.forEach(parentName => {
					edges.push({
						id: `${parentName}-${indexName}`,
						fromNode: parentName,
						toNode: indexName,
						fromEnd: "none",
						toEnd: "arrow",
						label: "parent of",
						color: "6" // purple for edges
					});
				});
			}

			// Child relationships
			if (index.children) {
				index.children.forEach(childName => {
						edges.push({
							id: `${indexName}-${childName}`,
							fromNode: indexName,
							toNode: childName,
							fromEnd: "none",
							toEnd: "arrow",
							label: "has child",
							color: "6" // purple for edges
						});
				});
			}
		});

		return {
			nodes,
			edges
		};
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl('h2', { text: 'Create Index Relationships Canvas' });

		new Setting(contentEl)
			.setName('Canvas Name')
			.setDesc('Enter the name for the canvas file (without extension)')
			.addText(text => text
				.setValue(this.canvasName)
				.onChange(value => this.canvasName = value.trim()));

		new Setting(contentEl)
			.addButton(btn => btn
				.setButtonText('Create Canvas')
				.setCta()
				.onClick(async () => {
					try {
						const canvasJson = this.generateCanvasJson();
						const fileName = `${this.canvasName}.canvas`;
						
						// Use Obsidian's adapter to write the file
						await this.app.vault.create(
							fileName,
							JSON.stringify(canvasJson, null, 2)
						);
						
						new Notice(`Created canvas file: ${fileName}`);
						this.close();
					} catch (error) {
						new Notice(`Failed to create canvas: ${error.message}`);
						console.error('Failed to create canvas:', error);
					}
				}));
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

	constructor(app: App, plugin: IndexNoteManagerPlugin, indexName: string, index: Index) {
		super(app);
		this.plugin = plugin;
		this.indexName = indexName;
		this.index = index;
		this.canvasName = `${indexName}-entries`;
	}

	private generateEntriesCanvasJson(): any {
		const nodes: any[] = [];
		const edges: any[] = [];
		
		// Constants for layout
		const BOX_WIDTH = 250;
		const BOX_HEIGHT = 100;
		const VERTICAL_GAP = BOX_HEIGHT * 3;
		const HORIZONTAL_GAP = BOX_WIDTH * 1.5;
		
		// Group entries by level
		const entriesByLevel: { [key: number]: string[] } = {};
		Object.entries(this.index.entries).forEach(([entryName, entry]) => {
			const level = entry.metadata.level;
			entriesByLevel[level] = entriesByLevel[level] || [];
			entriesByLevel[level].push(entryName);
		});
		
		// Create nodes for each entry, organizing by level
		Object.entries(entriesByLevel).forEach(([levelStr, entries]) => {
			const level = parseInt(levelStr);
			const y = level * VERTICAL_GAP;
			
			entries.forEach((entryName, index) => {
				const entry = this.index.entries[entryName];
				const x = index * HORIZONTAL_GAP;
				
				nodes.push({
					id: entryName,
					type: 'text',
					text: entryName,
					x,
					y,
					width: BOX_WIDTH,
					height: BOX_HEIGHT,
					color: "4" // green for all nodes
				});
				
				// Create edges for parent-child relationships
				if (entry.metadata.parents) {
					entry.metadata.parents.forEach(parentName => {
						edges.push({
							id: `${parentName}-${entryName}`,
							fromNode: parentName,
							toNode: entryName,
							fromEnd: "none",
							toEnd: "arrow",
							label: "parent of",
							color: "6" // purple for edges
						});
					});
				}

				// Add edges for children if they exist
				if (entry.children) {
					Object.entries(entry.children).forEach(([childIndexName, childEntries]) => {
						childEntries.forEach(childName => {
							edges.push({
								id: `${entryName}-${childName}`,
								fromNode: entryName,
								toNode: childName,
								fromEnd: "none",
								toEnd: "arrow",
								label: "has child",
								color: "6" // purple for edges
							});
						});
					});
				}
			});
		});

		return {
			nodes,
			edges
		};
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl('h2', { text: `Create Entry Relationships Canvas for ${this.indexName}` });

		new Setting(contentEl)
			.setName('Canvas Name')
			.setDesc('Enter the name for the canvas file (without extension)')
			.addText(text => text
				.setValue(this.canvasName)
				.onChange(value => this.canvasName = value.trim()));

		new Setting(contentEl)
			.addButton(btn => btn
				.setButtonText('Create Canvas')
				.setCta()
				.onClick(async () => {
					try {
						const canvasJson = this.generateEntriesCanvasJson();
						const fileName = `${this.canvasName}.canvas`;
						
						await this.app.vault.create(
							fileName,
							JSON.stringify(canvasJson, null, 2)
						);
						
						new Notice(`Created canvas file: ${fileName}`);
						this.close();
					} catch (error) {
						new Notice(`Failed to create canvas: ${error.message}`);
						console.error('Failed to create canvas:', error);
					}
				}));
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
		
		containerEl.createEl('h1', { text: 'Index Note Manager Settings' });
		
		// Add JSON Editor Section
		const jsonSection = containerEl.createEl('details', { cls: 'json-editor-section' });
		jsonSection.createEl('summary', { text: 'JSON Configuration' });
		
		new Setting(jsonSection)
			.setName('Configuration')
			.setDesc('Edit the raw JSON configuration')
			.addTextArea(text => {
				this.jsonEditor = text;
				text
					.setValue(JSON.stringify(this.plugin.configManager.getNoteConfig(), null, 2))
					.setPlaceholder('Enter your configuration here')
					.onChange(async (value) => {
						try {
							const config = JSON.parse(value);
							await this.plugin.configManager.setNoteConfig(config);
							await this.plugin.configManager.saveData();
							this.display(); // Refresh the display
						} catch (e) {
							console.error('Invalid JSON:', e);
						}
					});
				text.inputEl.rows = 20;
				text.inputEl.cols = 50;
			});

		// Questions Section
		const questionsSection = containerEl.createEl('details', { cls: 'questions-section' });
		questionsSection.createEl('summary', { text: 'Questions Configuration' });
		
		const questions = this.plugin.configManager.getNoteConfig().questions;
		questions.forEach((question: Question) => {
			const questionDetails = questionsSection.createEl('details', {
				cls: 'question-details'
			});
			questionDetails.createEl('summary', { text: question.questionId });
			
			// Basic question info
			new Setting(questionDetails)
				.setName('Question ID')
				.setDesc(question.questionId)
				.setClass('question-setting');
				
			new Setting(questionDetails)
				.setName('Answer ID')
				.setDesc(question.answerId || 'N/A')
				.setClass('question-setting');
				
			new Setting(questionDetails)
				.setName('Type')
				.setDesc(question.type)
				.setClass('question-setting');
				
			new Setting(questionDetails)
				.setName('Prompt')
				.setDesc(question.prompt)
				.setClass('question-setting');
			
			// Index-related settings
			if (question.indexName) {
				new Setting(questionDetails)
					.setName('Index Name')
					.setDesc(question.indexName)
					.setClass('question-setting');
			}
			
			if (question.createNewEntry !== undefined) {
				new Setting(questionDetails)
					.setName('Can Create New Entry')
					.setDesc(question.createNewEntry ? 'Yes' : 'No')
					.setClass('question-setting');
			}
			
			if (question.allowManualEntry !== undefined) {
				new Setting(questionDetails)
					.setName('Allow Manual Entry')
					.setDesc(question.allowManualEntry ? 'Yes' : 'No')
					.setClass('question-setting');
			}
			
			if (question.multipleSelections !== undefined) {
				new Setting(questionDetails)
					.setName('Multiple Selections')
					.setDesc(question.multipleSelections ? 'Yes' : 'No')
					.setClass('question-setting');
			}
			
			// Nested questions
			this.displayNestedQuestions(questionDetails, question);
		});
		
		// Indices Section
		const indicesSection = containerEl.createEl('details', { cls: 'indices-section' });
		indicesSection.createEl('summary', { text: 'Index Relationships' });
		
		const indices = this.plugin.configManager.getAllIndices();
		Object.entries(indices).forEach(([indexName, index]: [string, Index]) => {
			const indexDetails = indicesSection.createEl('details', {
					cls: 'index-details'
			});
			indexDetails.createEl('summary', { text: indexName });
			
			// Add buttons container
			const buttonsContainer = indexDetails.createEl('div', { 
				cls: 'index-buttons',
				attr: { style: 'display: flex; gap: 10px; margin-bottom: 10px;' }
			});

			// Add New Entry button
			new Setting(buttonsContainer)
				.setName('Add New Entry')
				.setDesc('Create a new entry in this index')
				.addButton(btn => btn
					.setButtonText('New Entry')
					.setCta()
					.onClick(() => {
						new NewIndexEntryModal(
							this.app,
							this.plugin,
							indexName,
							index
						).open();
					}));

			// Add View Entries button for nested indices
			if (index.nested) {
				new Setting(buttonsContainer)
					.setName('View Entry Relationships')
					.setDesc('Create a canvas showing relationships between entries in this index')
					.addButton(btn => btn
						.setButtonText('View Entries')
						.onClick(() => {
							new IndexEntriesCanvasModal(
								this.app,
								this.plugin,
								indexName,
								index
							).open();
						}));
			}

			new Setting(indexDetails)
				.setName('Nested')
				.setDesc(index.nested ? 'Yes' : 'No')
				.setClass('index-setting');
				
			new Setting(indexDetails)
				.setName('Level')
				.setDesc(index.level.toString())
				.setClass('index-setting');
			
			if (index.parents && index.parents.length > 0) {
				new Setting(indexDetails)
					.setName('Parents')
					.setDesc(index.parents.join(', '))
					.setClass('index-setting');
			}
			
			if (index.children && index.children.length > 0) {
				new Setting(indexDetails)
					.setName('Children')
					.setDesc(index.children.join(', '))
					.setClass('index-setting');
			}
			
			// Show entries count
			const entriesCount = Object.keys(index.entries).length;
			new Setting(indexDetails)
				.setName('Entries Count')
				.setDesc(entriesCount.toString())
				.setClass('index-setting');
		});
		
		// Add Create Canvas button at the top of Indices Section
		new Setting(indicesSection)
			.setName('Visualize Index Relationships')
			.setDesc('Create an Obsidian Canvas showing index relationships')
			.addButton(btn => btn
				.setButtonText('Create Canvas')
				.setCta()
				.onClick(() => {
					new IndexRelationshipsCanvasModal(this.app, this.plugin).open();
				}));
		
		// Note Types Section
		const noteTypesSection = containerEl.createEl('details', { cls: 'note-types-section' });
		noteTypesSection.createEl('summary', { text: 'Note Types' });

		// Add New Note Type button
		new Setting(noteTypesSection)
			.setName('Add New Note Type')
			.setDesc('Create a new note type')
			.addButton(btn => btn
				.setButtonText('New Note Type')
				.setCta()
				.onClick(() => {
					new NewNoteTypeModal(this.app, this.plugin).open();
				}));
		
		const noteTypes = this.plugin.configManager.getNoteConfig().noteTypes;
		
		noteTypes.forEach((noteType: NoteType) => {
			const noteTypeContainer = noteTypesSection.createEl('details', { 
				cls: 'note-type-container'
			});
			
			noteTypeContainer.createEl('summary', { 
				text: `${noteType.id}`,
				cls: 'note-type-header'
			});

			// Add New Subtype button
			new Setting(noteTypeContainer)
				.setName('Add New Subtype')
				.setDesc('Create a new subtype for this note type')
				.addButton(btn => btn
					.setButtonText('New Subtype')
					.setCta()
					.onClick(() => {
						new NewSubtypeModal(this.app, this.plugin, noteType).open();
					}));
			
			if (noteType.baseFrontMatterPath) {
				new Setting(noteTypeContainer)
					.setName('Base Front Matter Path')
					.setDesc(noteType.baseFrontMatterPath)
					.setClass('note-type-setting');
			}
			
			const subtypesContainer = noteTypeContainer.createEl('details', {
				cls: 'subtypes-container'
			});
			subtypesContainer.createEl('summary', { text: 'Subtypes' });
			
			noteType.subtypes.forEach((subtype: NoteSubtype) => {
				const subtypeDetails = subtypesContainer.createEl('details', {
					cls: 'subtype-details'
				});
				subtypeDetails.createEl('summary', { text: subtype.id });
				
				new Setting(subtypeDetails)
					.setName('Folder')
					.setDesc(subtype.folder)
					.setClass('subtype-setting');
					
				if (subtype.template) {
					new Setting(subtypeDetails)
						.setName('Template')
						.setDesc(subtype.template)
						.setClass('subtype-setting');
				}
				
				// Enhanced Front Matter display
				if (subtype.frontMatter && subtype.frontMatter.length > 0) {
					const frontMatterDetails = subtypeDetails.createEl('details', {
						cls: 'frontmatter-container'
					});
					frontMatterDetails.createEl('summary', { text: 'Front Matter Configuration' });
					
					subtype.frontMatter.forEach(field => {
						const fieldContainer = frontMatterDetails.createEl('div', { 
							cls: 'frontmatter-field',
							attr: { style: 'margin-bottom: 10px; padding: 5px; border-left: 2px solid var(--interactive-accent);' }
						});
						
						new Setting(fieldContainer)
							.setName('Field')
							.setDesc(field.id)
							.setClass('frontmatter-setting');
							
						new Setting(fieldContainer)
							.setName('Type')
							.setDesc(field.type)
							.setClass('frontmatter-setting');
							
						new Setting(fieldContainer)
							.setName('Value Template')
							.setDesc(field.value)
							.setClass('frontmatter-setting');

						// Add placeholder detection
						const placeholders = field.value.match(/{{[^}]+}}/g);
						if (placeholders) {
							const placeholderContainer = fieldContainer.createEl('div', { 
								cls: 'placeholder-list',
								attr: { style: 'margin-left: 20px;' }
							});
							placeholderContainer.createEl('small', { 
								text: 'Uses placeholders: ' + placeholders.join(', '),
								attr: { style: 'color: var(--text-muted);' }
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
							new Setting(container)
								.setName('Prompt')
								.setDesc(question.prompt)
								.setClass('question-setting');
								
							new Setting(container)
								.setName('Answer ID')
								.setDesc(question.answerId || 'N/A')
								.setClass('question-setting');
								
							if (question.type === 'nestedTpsuggester') {
								new Setting(container)
									.setName('Type')
									.setDesc('Nested Questions')
									.setClass('question-setting');
							}
						}
					});
				}
			});
		});

		// Add View Placeholders button at the top of Questions Section
		new Setting(questionsSection)
			.setName('View Available Placeholders')
			.setDesc('See all placeholders that can be used in templates and front matter')
			.addButton(btn => btn
				.setButtonText('View Placeholders')
				.onClick(() => {
					new PlaceholderViewerModal(this.app, questions).open();
				}));
	}

	private displayNestedQuestions(container: HTMLElement, question: Question) {
		if (question.type === 'nestedTpsuggester' && question.nest) {
			const nestedSection = container.createEl('details', {
				cls: 'nested-questions-section'
			});
			nestedSection.createEl('summary', { text: 'Nested Questions' });
			
			question.nest.forEach((nestedQ: Question) => {
				const nestedDetails = nestedSection.createEl('details', {
					cls: 'nested-question-details'
				});
				nestedDetails.createEl('summary', { text: nestedQ.questionId });
				
				new Setting(nestedDetails)
					.setName('Question ID')
					.setDesc(nestedQ.questionId)
					.setClass('nested-question-setting');
					
				new Setting(nestedDetails)
					.setName('Answer ID')
					.setDesc(nestedQ.answerId || 'N/A')
					.setClass('nested-question-setting');
					
				new Setting(nestedDetails)
					.setName('Type')
					.setDesc(nestedQ.type || 'N/A')
					.setClass('nested-question-setting');
					
				new Setting(nestedDetails)
					.setName('Prompt')
					.setDesc(nestedQ.prompt || 'N/A')
					.setClass('nested-question-setting');

				if (nestedQ.parents && nestedQ.parents.length > 0) {
					new Setting(nestedDetails)
						.setName('Parent Answer IDs')
						.setDesc(nestedQ.parents.join(', '))
						.setClass('nested-question-setting');
				}
				
				if (nestedQ.frontMatterType) {
					new Setting(nestedDetails)
						.setName('Front Matter Type')
						.setDesc(nestedQ.frontMatterType)
						.setClass('nested-question-setting');
				}

				// Recursively display nested questions
				if (nestedQ.type === 'nestedTpsuggester') {
					this.displayNestedQuestions(nestedDetails, nestedQ);
				}
			});
		}
	}
} 