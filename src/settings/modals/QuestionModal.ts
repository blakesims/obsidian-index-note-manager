import { App, Modal, Notice, Setting, DropdownComponent } from "obsidian";
import { IndexNoteManagerPlugin } from "../../pluginTypes";
import { Question, Index } from "../../types";
import { toSnakeCase } from "../../utils/stringUtils";

type QuestionType = "inputPrompt" | "tpsuggester" | "nestedTpsuggester";

interface QuestionModalData {
    questionId: string;
    answerId: string;
    prompt: string;
    type: QuestionType;
    indexName?: string;
    allowManualEntry?: boolean;
    createNewEntry?: boolean;
    multipleSelections?: boolean;
    newEntryNoteType?: string;
    newEntryNoteSubtype?: string;
    nest?: QuestionModalData[];
    parents?: string[];
}

export class QuestionModal extends Modal {
    private data: QuestionModalData;
    private plugin: IndexNoteManagerPlugin;
    private onSave: (question: Question) => void;
    private isEdit: boolean;
    private availableIndices: string[];
    private availableNoteTypes: string[];
    private nestedIndices: Map<string, string[]>;

    constructor(
        app: App,
        plugin: IndexNoteManagerPlugin,
        onSave: (question: Question) => void,
        existingQuestion?: Question
    ) {
        super(app);
        this.plugin = plugin;
        this.onSave = onSave;
        this.isEdit = !!existingQuestion;
        this.nestedIndices = this.getNestedIndices();
        this.availableIndices = this.data?.type === "nestedTpsuggester" 
            ? Array.from(this.nestedIndices.keys())
            : Object.keys(this.plugin.configManager.getAllIndices());
        this.availableNoteTypes = this.plugin.configManager.getNoteConfig().noteTypes.map(nt => nt.id);

        // Initialize with existing data or defaults
        this.data = {
            questionId: existingQuestion?.questionId || "",
            answerId: existingQuestion?.answerId || "",
            prompt: existingQuestion?.prompt || "",
            type: existingQuestion?.type || "inputPrompt",
            indexName: existingQuestion?.indexName,
            allowManualEntry: existingQuestion?.allowManualEntry ?? false,
            createNewEntry: existingQuestion?.createNewEntry ?? false,
            multipleSelections: existingQuestion?.multipleSelections ?? false,
            newEntryNoteType: existingQuestion?.newEntryNoteType,
            newEntryNoteSubtype: existingQuestion?.newEntryNoteSubtype,
            nest: existingQuestion?.nest?.map(q => ({ ...q })),
            parents: existingQuestion?.parents?.slice()
        };
    }

    private getNestedIndices(): Map<string, string[]> {
        const nestedMap = new Map<string, string[]>();
        const indices = this.plugin.configManager.getAllIndices();
        
        // First pass: collect direct children
        for (const [indexName, index] of Object.entries(indices)) {
            if (index.children) {
                nestedMap.set(indexName, index.children);
            }
        }
        
        return nestedMap;
    }

    private validateQuestionId(id: string): boolean {
        const noteConfig = this.plugin.configManager.getNoteConfig();
        const existingQuestion = noteConfig.questions.find(q => q.questionId === id);
        return !existingQuestion || (this.isEdit && existingQuestion.questionId === this.data.questionId);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl("h2", { text: this.isEdit ? "Edit Question" : "Add New Question" });

        // Question Type Dropdown
        new Setting(contentEl)
            .setName("Question Type")
            .setDesc("Select the type of question")
            .addDropdown(dropdown => {
                dropdown
                    .addOption("inputPrompt", "Simple Input")
                    .addOption("tpsuggester", "Index Selection")
                    .addOption("nestedTpsuggester", "Nested Index Selection")
                    .setValue(this.data.type)
                    .onChange(value => {
                        this.data.type = value as QuestionType;
                        // If switching to an index-based type, set answerId to first available index
                        if ((value === "tpsuggester" || value === "nestedTpsuggester") && this.availableIndices.length > 0) {
                            this.data.indexName = this.availableIndices[0];
                            this.data.answerId = this.data.indexName;
                        }
                        this.updateModalContent();
                    });
            });

        // Question ID
        new Setting(contentEl)
            .setName("Question ID")
            .setDesc("A unique identifier for this question (snake_case)")
            .addText(text => {
                text.setValue(this.data.questionId)
                    .setDisabled(this.isEdit) // Disable in edit mode
                    .onChange(value => {
                        const snakeCaseValue = toSnakeCase(value);
                        text.setValue(snakeCaseValue);
                        this.data.questionId = snakeCaseValue;
                        
                        // Show warning if ID already exists
                        if (!this.validateQuestionId(snakeCaseValue)) {
                            text.inputEl.style.borderColor = "var(--text-error)";
                            new Notice("This Question ID already exists!");
                        } else {
                            text.inputEl.style.borderColor = "";
                        }
                    });
                if (this.isEdit) {
                    text.inputEl.style.backgroundColor = "var(--background-modifier-disabled)";
                }
            });

        this.updateModalContent();

        // Save button
        new Setting(contentEl)
            .addButton(btn =>
                btn
                    .setButtonText("Save")
                    .setCta()
                    .onClick(() => {
                        if (this.validateAndSave()) {
                            this.close();
                        }
                    })
            );
    }

    private updateModalContent() {
        // Remove any existing dynamic content
        const dynamicContent = this.contentEl.querySelector(".dynamic-content");
        if (dynamicContent) {
            dynamicContent.remove();
        }

        const container = this.contentEl.createDiv({ cls: "dynamic-content" });

        if (this.data.type === "inputPrompt") {
            this.createInputPromptContent(container);
        } else if (this.data.type === "tpsuggester" || this.data.type === "nestedTpsuggester") {
            this.createIndexBasedContent(container);
        }
    }

    private createInputPromptContent(container: HTMLElement) {
        // Answer ID for input prompt
        new Setting(container)
            .setName("Answer ID")
            .setDesc("The ID used to reference this answer in placeholders (snake_case)")
            .addText(text => {
                text.setValue(this.data.answerId)
                    .onChange(value => {
                        const snakeCaseValue = toSnakeCase(value);
                        text.setValue(snakeCaseValue);
                        this.data.answerId = snakeCaseValue;
                    });
            });

        // Prompt
        new Setting(container)
            .setName("Prompt")
            .setDesc("The question to ask the user")
            .addText(text =>
                text
                    .setValue(this.data.prompt)
                    .onChange(value => {
                        this.data.prompt = value;
                    })
            );
    }

    private createIndexBasedContent(container: HTMLElement) {
        // Index selection
        new Setting(container)
            .setName(this.data.type === "nestedTpsuggester" ? "Select Nested Index" : "Select Index")
            .setDesc(this.data.type === "nestedTpsuggester" 
                ? "Choose the parent-child index relationship to use" 
                : "Choose the index to use for this question")
            .addDropdown(dropdown => {
                const availableIndices = this.data.type === "nestedTpsuggester"
                    ? Array.from(this.nestedIndices.keys())
                    : this.availableIndices;

                if (this.data.type === "nestedTpsuggester") {
                    // Add options showing the relationships
                    availableIndices.forEach(index => {
                        const children = this.nestedIndices.get(index);
                        if (children && children.length > 0) {
                            const label = `${index} → ${children.join(", ")}`;
                            dropdown.addOption(index, label);
                        }
                    });
                } else {
                    availableIndices.forEach(index => {
                        dropdown.addOption(index, index);
                    });
                }

                if (availableIndices.length === 0 && this.data.type === "nestedTpsuggester") {
                    dropdown.setDisabled(true);
                    container.createEl("div", {
                        text: "No nested indices available. Create parent-child index relationships first.",
                        attr: { style: "color: var(--text-error); margin: 10px 0;" }
                    });
                    return;
                }

                dropdown.setValue(this.data.indexName || availableIndices[0])
                    .onChange(value => {
                        this.data.indexName = value;
                        this.data.answerId = value;

                        if (this.data.type === "nestedTpsuggester") {
                            this.createNestedQuestionsFromHierarchy(value);
                            const nestedSection = container.querySelector('.nested-questions-section');
                            if (nestedSection) {
                                this.updateNestedQuestions(nestedSection as HTMLElement);
                            }
                        }
                    });
            });

        if (this.data.type === "nestedTpsuggester") {
            // Nested Questions Section
            const nestedSection = container.createEl("details", {
                cls: "nested-questions-section",
            });
            nestedSection.createEl("summary", { text: "Nested Questions" });

            // If we have an index selected, create the hierarchy
            if (this.data.indexName && !this.data.nest?.length) {
                this.createNestedQuestionsFromHierarchy(this.data.indexName);
            }

            // Display existing nested questions
            this.updateNestedQuestions(nestedSection);
        } else {
            // Regular index-based question options
            // Multiple Selections (moved up)
            new Setting(container)
                .setName("Multiple Selections")
                .setDesc("Allow users to select multiple values from the index")
                .addToggle(toggle => {
                    toggle.setValue(this.data.multipleSelections || false)
                        .onChange(value => {
                            this.data.multipleSelections = value;
                        });
                });

            // Allow Manual Entry
            new Setting(container)
                .setName("Allow New Index Entries")
                .setDesc("Allow users to add new entries to the index when answering this question")
                .addToggle(toggle => {
                    toggle.setValue(this.data.allowManualEntry || false)
                        .onChange(value => {
                            this.data.allowManualEntry = value;
                            // Update visibility of Create Notes option
                            const createNotesContainer = container.querySelector('.create-notes-container');
                            if (createNotesContainer instanceof HTMLElement) {
                                createNotesContainer.style.display = value ? 'block' : 'none';
                            }
                            if (!value) {
                                this.data.createNewEntry = false;
                                const noteTypeSettings = container.querySelector('.note-type-settings');
                                if (noteTypeSettings instanceof HTMLElement) {
                                    noteTypeSettings.style.display = 'none';
                                }
                            }
                        });
                });

            // Create New Entry (wrapped in container for conditional display)
            const createNotesContainer = container.createDiv({ cls: 'create-notes-container' });
            createNotesContainer.style.display = this.data.allowManualEntry ? 'block' : 'none';

            new Setting(createNotesContainer)
                .setName("Create Notes for New Entries")
                .setDesc("Automatically create new notes when new index entries are added")
                .addToggle(toggle => {
                    toggle.setValue(this.data.createNewEntry || false)
                        .onChange(value => {
                            this.data.createNewEntry = value;
                            const noteTypeSettings = container.querySelector('.note-type-settings');
                            if (noteTypeSettings instanceof HTMLElement) {
                                noteTypeSettings.style.display = value ? 'block' : 'none';
                            }
                        });
                });

            // Add explanation about note creation
            const noteExplanation = createNotesContainer.createEl("div", {
                cls: "note-creation-explanation",
                attr: { 
                    style: "margin: 10px; padding: 10px; background: var(--background-modifier-form-field); border-radius: 5px;" 
                }
            });
            noteExplanation.createEl("p", {
                text: "When 'Create Notes for New Entries' is enabled, a new note will be created for each new index entry. The note will:",
                attr: { style: "margin-bottom: 8px;" }
            });
            const list = noteExplanation.createEl("ul");
            list.createEl("li", { text: "Use the selected note type and subtype" });
            list.createEl("li", { text: "Include answers from this and other questions in the front matter" });
            list.createEl("li", { text: "Be created in the appropriate folder based on the subtype settings" });

            // Note Type Settings (only shown when createNewEntry is true)
            const noteTypeSettings = container.createDiv({ cls: 'note-type-settings' });
            if (noteTypeSettings instanceof HTMLElement) {
                noteTypeSettings.style.display = this.data.createNewEntry ? 'block' : 'none';
            }

            // Note Type Selection
            new Setting(noteTypeSettings)
                .setName("New Entry Note Type")
                .setDesc("Select the note type for new entries")
                .addDropdown(dropdown => {
                    this.availableNoteTypes.forEach(type => {
                        dropdown.addOption(type, type);
                    });
                    dropdown.setValue(this.data.newEntryNoteType || this.availableNoteTypes[0])
                        .onChange(value => {
                            this.data.newEntryNoteType = value;
                            // Update subtypes dropdown
                            this.updateSubtypesDropdown(noteTypeSettings, value);
                        });
                });

            // Subtype Selection (populated based on selected note type)
            if (this.data.newEntryNoteType) {
                this.updateSubtypesDropdown(noteTypeSettings, this.data.newEntryNoteType);
            }
        }

        // Prompt
        new Setting(container)
            .setName("Prompt")
            .setDesc("The question to ask the user")
            .addText(text =>
                text
                    .setValue(this.data.prompt)
                    .onChange(value => {
                        this.data.prompt = value;
                    })
            );

        // Note about answer ID
        container.createEl("div", {
            text: "Note: For index-based questions, the Answer ID is automatically set to the index name.",
            attr: { style: "margin: 10px; padding: 10px; background: var(--background-modifier-form-field); border-radius: 5px;" }
        });
    }

    private updateSubtypesDropdown(container: HTMLElement, noteType: string) {
        const existingSubtypeSetting = container.querySelector('.subtype-setting');
        if (existingSubtypeSetting) {
            existingSubtypeSetting.remove();
        }

        const selectedNoteType = this.plugin.configManager.getNoteConfig()
            .noteTypes.find(nt => nt.id === noteType);

        if (selectedNoteType) {
            new Setting(container)
                .setName("New Entry Note Subtype")
                .setDesc("Select the note subtype for new entries")
                .setClass('subtype-setting')
                .addDropdown(dropdown => {
                    selectedNoteType.subtypes.forEach(subtype => {
                        dropdown.addOption(subtype.id, subtype.id);
                    });
                    dropdown.setValue(this.data.newEntryNoteSubtype || selectedNoteType.subtypes[0]?.id)
                        .onChange(value => {
                            this.data.newEntryNoteSubtype = value;
                        });
                });
        }
    }

    private updateNestedQuestions(container: HTMLElement) {
        // Clear existing nested questions
        const existingQuestions = container.querySelectorAll('.nested-question');
        existingQuestions.forEach(el => el.remove());

        // Display each nested question
        this.data.nest?.forEach((nestedQuestion, index) => {
            const questionContainer = container.createDiv({ cls: 'nested-question' });
            
            // Add a header showing the relationship
            const parentIndex = nestedQuestion.parents?.[0] || "";
            questionContainer.createEl("h3", { 
                text: `${parentIndex} → ${nestedQuestion.indexName}`,
                attr: { style: "margin-bottom: 1em; color: var(--text-muted);" }
            });

            // Question ID
            new Setting(questionContainer)
                .setName(`Nested Question ${index + 1} ID`)
                .addText(text => {
                    text.setValue(nestedQuestion.questionId)
                        .onChange(value => {
                            nestedQuestion.questionId = toSnakeCase(value);
                            text.setValue(nestedQuestion.questionId);
                        });
                });

            // Answer ID
            new Setting(questionContainer)
                .setName("Answer ID")
                .addText(text => {
                    text.setValue(nestedQuestion.answerId)
                        .onChange(value => {
                            nestedQuestion.answerId = toSnakeCase(value);
                            text.setValue(nestedQuestion.answerId);
                        });
                });

            // Prompt
            new Setting(questionContainer)
                .setName("Prompt")
                .addText(text => {
                    text.setValue(nestedQuestion.prompt)
                        .onChange(value => {
                            nestedQuestion.prompt = value;
                        });
                });

            // Multiple Selections (moved up)
            new Setting(questionContainer)
                .setName("Multiple Selections")
                .setDesc("Allow users to select multiple values from this index")
                .addToggle(toggle => {
                    toggle.setValue(nestedQuestion.multipleSelections || false)
                        .onChange(value => {
                            nestedQuestion.multipleSelections = value;
                        });
                });

            // Allow Manual Entry
            new Setting(questionContainer)
                .setName("Allow New Index Entries")
                .setDesc("Allow users to add new entries to this index level")
                .addToggle(toggle => {
                    toggle.setValue(nestedQuestion.allowManualEntry || false)
                        .onChange(value => {
                            nestedQuestion.allowManualEntry = value;
                            // Update visibility of Create Notes option
                            const createNotesContainer = questionContainer.querySelector('.nested-create-notes-container');
                            if (createNotesContainer instanceof HTMLElement) {
                                createNotesContainer.style.display = value ? 'block' : 'none';
                            }
                            if (!value) {
                                nestedQuestion.createNewEntry = false;
                                const noteTypeSettings = questionContainer.querySelector('.nested-note-type-settings');
                                if (noteTypeSettings instanceof HTMLElement) {
                                    noteTypeSettings.style.display = 'none';
                                }
                            }
                        });
                });

            // Create New Entry (wrapped in container for conditional display)
            const createNotesContainer = questionContainer.createDiv({ cls: 'nested-create-notes-container' });
            createNotesContainer.style.display = nestedQuestion.allowManualEntry ? 'block' : 'none';

            new Setting(createNotesContainer)
                .setName("Create Notes for New Entries")
                .setDesc("Automatically create new notes when new index entries are added")
                .addToggle(toggle => {
                    toggle.setValue(nestedQuestion.createNewEntry || false)
                        .onChange(value => {
                            nestedQuestion.createNewEntry = value;
                            const noteTypeSettings = questionContainer.querySelector('.nested-note-type-settings');
                            if (noteTypeSettings instanceof HTMLElement) {
                                noteTypeSettings.style.display = value ? 'block' : 'none';
                            }
                        });
                });

            // Note Type Settings
            const noteTypeSettings = questionContainer.createDiv({ cls: 'nested-note-type-settings' });
            if (noteTypeSettings instanceof HTMLElement) {
                noteTypeSettings.style.display = nestedQuestion.createNewEntry ? 'block' : 'none';
            }

            // Note Type Selection
            new Setting(noteTypeSettings)
                .setName("New Entry Note Type")
                .setDesc("Select the note type for new entries")
                .addDropdown(dropdown => {
                    this.availableNoteTypes.forEach(type => {
                        dropdown.addOption(type, type);
                    });
                    dropdown.setValue(nestedQuestion.newEntryNoteType || this.availableNoteTypes[0])
                        .onChange(value => {
                            nestedQuestion.newEntryNoteType = value;
                            this.updateSubtypesDropdown(noteTypeSettings, value);
                        });
                });

            // Subtype Selection (populated based on selected note type)
            if (nestedQuestion.newEntryNoteType) {
                this.updateSubtypesDropdown(noteTypeSettings, nestedQuestion.newEntryNoteType);
            }

            // Add separator
            questionContainer.createEl("hr");

            // Add note creation explanation for nested questions too
            if (nestedQuestion.createNewEntry) {
                const noteExplanation = questionContainer.createEl("div", {
                    cls: "note-creation-explanation",
                    attr: { 
                        style: "margin: 10px; padding: 10px; background: var(--background-modifier-form-field); border-radius: 5px;" 
                    }
                });
                noteExplanation.createEl("p", {
                    text: `Notes created for new ${nestedQuestion.indexName} entries will include answers from all questions in the hierarchy.`,
                });
            }
        });
    }

    private createNestedQuestionsFromHierarchy(parentIndex: string) {
        // Get the complete hierarchy for this index
        const indices = this.plugin.configManager.getAllIndices();
        const parentIndexData = indices[parentIndex];
        
        if (!parentIndexData || !parentIndexData.children || parentIndexData.children.length === 0) {
            return;
        }

        // Create nested questions for each level
        const nestedQuestions: QuestionModalData[] = [];
        let currentIndex = parentIndex;
        let currentParent = parentIndex;
        let level = 0;

        while (true) {
            const currentIndexData = indices[currentIndex];
            if (!currentIndexData || !currentIndexData.children || currentIndexData.children.length === 0) {
                break;
            }

            const childIndex = currentIndexData.children[0];
            nestedQuestions.push({
                questionId: `${toSnakeCase(childIndex)}_question`,
                answerId: childIndex,
                prompt: `Select ${childIndex}:`,
                type: "tpsuggester" as QuestionType,
                indexName: childIndex,
                allowManualEntry: false,
                createNewEntry: false,
                multipleSelections: false,
                parents: [currentParent]
            });

            currentParent = childIndex;
            currentIndex = childIndex;
            level++;
        }

        this.data.nest = nestedQuestions;
    }

    private validateAndSave(): boolean {
        const { questionId, answerId, prompt, type, indexName } = this.data;

        // Basic validation
        if (!questionId || !answerId || !prompt) {
            new Notice("Please fill in all required fields");
            return false;
        }

        // Validate question ID uniqueness
        if (!this.validateQuestionId(questionId)) {
            new Notice("This Question ID already exists!");
            return false;
        }

        // Validate index selection for index-based questions
        if ((type === "tpsuggester" || type === "nestedTpsuggester") && !indexName) {
            new Notice("Please select an index");
            return false;
        }

        // Validate note type and subtype if createNewEntry is true
        if (this.data.createNewEntry) {
            if (!this.data.newEntryNoteType || !this.data.newEntryNoteSubtype) {
                new Notice("Please select both note type and subtype for new entries");
                return false;
            }
        }

        // Create question object
        const question: Question = {
            ...this.data
        };

        // Call the save callback
        this.onSave(question);
        return true;
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
} 