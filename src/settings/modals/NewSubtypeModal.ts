import { App, Modal, Notice, Setting, ButtonComponent } from "obsidian";
import { IndexNoteManagerPlugin } from "../../pluginTypes";
import { FrontMatterField, FrontMatterType, Question } from "../../types";
import { QuestionEditModal } from "./QuestionEditModal";
import { createFrontMatterFieldComponent, showTemplaterFunctionInput } from "../components/FrontMatterField";

interface NewSubtypeModalData {
    questionId: string;
    answerId: string;
    prompt: string;
}

export class NewSubtypeModal extends Modal {
    private modalData: NewSubtypeModalData = {
        questionId: "",
        answerId: "",
        prompt: "",
    };

    private plugin: IndexNoteManagerPlugin;
    private noteTypeId: string;
    private subtypeId = "";
    private folder = "";
    private template = "";
    private selectedQuestions: string[] = [];
    private frontMatterFields: FrontMatterField[] = [];
    private frontMatterContainer: HTMLElement;

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
                        type: "text" as FrontMatterType,
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
                        const noteConfig = this.plugin.configManager.getNoteConfig();
                        const typeIndex = noteConfig.noteTypes.findIndex(
                            (type) => type.id === this.noteTypeId,
                        );

                        if (typeIndex === -1) {
                            throw new Error("Note type not found");
                        }

                        const newSubtype = {
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
                        if (error instanceof Error) {
                            new Notice(
                                `Failed to create subtype: ${error.message}`,
                            );
                            console.error("Failed to create subtype:", error);
                        } else {
                            new Notice("Failed to create subtype: Unknown error");
                            console.error("Failed to create subtype:", error);
                        }
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

        // Add buttons container at the top
        const buttonsContainer = questionsContainer.createDiv({
            cls: "question-buttons-container",
            attr: { style: "margin-bottom: 20px;" },
        });

        // Add "View Available Placeholders" button
        new ButtonComponent(buttonsContainer)
            .setButtonText("View Available Placeholders")
            .onClick(() => {
                this.showAvailablePlaceholders();
            });

        // Add "Add New Question" button
        new ButtonComponent(buttonsContainer)
            .setButtonText("Add New Question")
            .onClick(() => {
                this.showNewQuestionModal();
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
                )
                .addExtraButton((button) => {
                    button
                        .setIcon("edit")
                        .setTooltip("Edit Question")
                        .onClick(() => {
                            new QuestionEditModal(
                                this.app,
                                this.plugin,
                                question,
                            ).open();
                        });
                });
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
                        type: "text" as FrontMatterType,
                    });
                    this.refreshFrontMatterSection();
                }),
            );

        // Display existing front matter fields
        this.frontMatterFields.forEach((field, index) => {
            createFrontMatterFieldComponent(
                frontMatterDetails,
                field,
                index,
                (updatedField, idx) => {
                    this.frontMatterFields[idx] = updatedField;
                    this.plugin.configManager.saveData();
                },
                (idx) => {
                    this.frontMatterFields.splice(idx, 1);
                    this.refreshFrontMatterSection();
                },
                (container, field) => {
                    showTemplaterFunctionInput(container, field, (updatedField) => {
                        this.frontMatterFields[index] = updatedField;
                        this.plugin.configManager.saveData();
                    });
                }
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

    private showAvailablePlaceholders() {
        const placeholders = this.selectedQuestions
            .map((questionId) => {
                const question = this.plugin.configManager
                    .getNoteConfig()
                    .questions.find((q) => q.questionId === questionId);
                if (!question) return null;

                if (question.type === "nestedTpsuggester" && question.nest) {
                    return question.nest
                        .map((q) => `{{${q.answerId}}}`)
                        .join("\n");
                }
                return `{{${question.answerId}}}`;
            })
            .filter((p) => p)
            .join("\n");

        const modal = new Modal(this.app);
        modal.titleEl.setText("Available Placeholders");
        modal.contentEl.createEl("p", {
            text: "These placeholders can be used in your front matter configuration:",
            attr: { style: "margin-bottom: 10px;" },
        });

        if (placeholders) {
            modal.contentEl.createEl("pre", {
                text: placeholders,
                attr: {
                    style: "background-color: var(--background-secondary); padding: 10px; border-radius: 5px;",
                },
            });
        } else {
            modal.contentEl.createEl("p", {
                text: "No placeholders available. Select some questions first.",
                attr: { style: "color: var(--text-muted);" },
            });
        }

        modal.open();
    }

    private showNewQuestionModal() {
        const modal = new Modal(this.app);
        modal.titleEl.setText("Add New Question");

        const { contentEl } = modal;

        // Question ID
        new Setting(contentEl)
            .setName("Question ID")
            .setDesc("A unique identifier for this question")
            .addText((text) =>
                text
                    .setPlaceholder("e.g., student_name_question")
                    .onChange((value) => {
                        this.modalData.questionId = value;
                    }),
            );

        // Answer ID
        new Setting(contentEl)
            .setName("Answer ID")
            .setDesc("The ID used to reference this answer in placeholders")
            .addText((text) =>
                text.setPlaceholder("e.g., student_name").onChange((value) => {
                    this.modalData.answerId = value;
                }),
            );

        // Prompt
        new Setting(contentEl)
            .setName("Prompt")
            .setDesc("The question to ask the user")
            .addText((text) =>
                text
                    .setPlaceholder("e.g., What is the student's name?")
                    .onChange((value) => {
                        this.modalData.prompt = value;
                    }),
            );

        // Save button
        new Setting(contentEl).addButton((btn) =>
            btn
                .setButtonText("Save")
                .setCta()
                .onClick(() => {
                    const { questionId, answerId, prompt } = this.modalData;
                    if (!questionId || !answerId || !prompt) {
                        new Notice("Please fill in all fields");
                        return;
                    }

                    const newQuestion: Question = {
                        questionId,
                        answerId,
                        type: "inputPrompt",
                        prompt,
                    };

                    const noteConfig = this.plugin.configManager.getNoteConfig();
                    noteConfig.questions.push(newQuestion);
                    this.plugin.configManager.saveData();

                    modal.close();
                    this.refreshFrontMatterSection(); // Refresh just this section
                }),
        );

        modal.open();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
} 