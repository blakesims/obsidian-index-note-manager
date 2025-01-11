import { App, Modal, Notice, Setting, ButtonComponent } from "obsidian";
import { IndexNoteManagerPlugin } from "../../pluginTypes";
import { FrontMatterField, FrontMatterType, Question } from "../../types";
import { QuestionModal } from "./QuestionModal";
import { createFrontMatterFieldComponent, showTemplaterFunctionInput } from "../components/FrontMatterField";

export class NewSubtypeModal extends Modal {
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
        this.displayFrontMatterSection(this.frontMatterContainer);

        // Save button
        new Setting(contentEl)
            .addButton((btn) =>
                btn
                    .setButtonText("Save")
                    .setCta()
                    .onClick(async () => {
                        if (!this.subtypeId || !this.folder) {
                            new Notice("Please fill in all required fields");
                            return;
                        }

                        const noteConfig = this.plugin.configManager.getNoteConfig();
                        const noteType = noteConfig.noteTypes.find(
                            (nt) => nt.id === this.noteTypeId
                        );

                        if (!noteType) {
                            new Notice("Note type not found");
                            return;
                        }

                        noteType.subtypes.push({
                            id: this.subtypeId,
                            folder: this.folder,
                            template: this.template,
                            frontMatter: this.frontMatterFields,
                            questions: this.selectedQuestions,
                            title: "",
                        });

                        await this.plugin.configManager.saveData();
                        this.close();
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

        // Add "Add New Question" button
        new ButtonComponent(buttonsContainer)
            .setButtonText("Add New Question")
            .onClick(() => {
                new QuestionModal(
                    this.app,
                    this.plugin,
                    (question: Question) => {
                        const noteConfig = this.plugin.configManager.getNoteConfig();
                        noteConfig.questions.push(question);
                        this.plugin.configManager.saveData();
                        this.refreshQuestionsSection(questionsContainer);
                    }
                ).open();
            });

        const questions = this.plugin.configManager.getNoteConfig().questions;
        questions.forEach((question) => {
            new Setting(questionsContainer)
                .setName(question.questionId)
                .setDesc(this.getQuestionDescription(question))
                .addToggle((toggle) =>
                    toggle
                        .setValue(this.selectedQuestions.includes(question.questionId))
                        .onChange((value) => {
                            if (value) {
                                this.selectedQuestions.push(question.questionId);
                            } else {
                                this.selectedQuestions = this.selectedQuestions.filter(
                                    (id) => id !== question.questionId
                                );
                            }
                            this.refreshFrontMatterSection();
                        })
                )
                .addExtraButton((button) => {
                    button
                        .setIcon("edit")
                        .setTooltip("Edit Question")
                        .onClick(() => {
                            new QuestionModal(
                                this.app,
                                this.plugin,
                                (updatedQuestion: Question) => {
                                    const noteConfig = this.plugin.configManager.getNoteConfig();
                                    const index = noteConfig.questions.findIndex(
                                        (q) => q.questionId === question.questionId
                                    );
                                    if (index !== -1) {
                                        noteConfig.questions[index] = updatedQuestion;
                                        this.plugin.configManager.saveData();
                                        this.refreshQuestionsSection(questionsContainer);
                                    }
                                },
                                question
                            ).open();
                        });
                });
        });
    }

    private refreshQuestionsSection(container: HTMLElement) {
        container.empty();
        this.displayQuestionsSection(container);
    }

    private getQuestionDescription(question: Question): string {
        let desc = `Type: ${question.type}\nPrompt: ${question.prompt}`;
        if (question.type === "nestedTpsuggester" && question.nest) {
            desc += `\nNested questions:\n${question.nest
                .map((q, i) => `${i + 1}. ${q.prompt} (Answer ID: ${q.answerId})`)
                .join("\n")}`;
        }
        return desc;
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

        // Add "Add Field" button
        new Setting(frontMatterDetails)
            .setName("Add Front Matter Field")
            .setDesc("Add a new front matter field")
            .addButton((btn) =>
                btn
                    .setButtonText("Add Field")
                    .setCta()
                    .onClick(() => {
                        const newField: FrontMatterField = {
                            id: "",
                            value: "",
                            type: "text",
                        };
                        this.frontMatterFields.push(newField);
                        this.refreshFrontMatterSection();
                    }),
            );

        // Display fields
        const fieldsContainer = frontMatterDetails.createDiv();
        this.frontMatterFields.forEach((field, index) => {
            createFrontMatterFieldComponent(
                fieldsContainer,
                field,
                (updatedField: FrontMatterField) => {
                    this.frontMatterFields[index] = updatedField;
                    if (updatedField.type === "templater") {
                        showTemplaterFunctionInput(fieldsContainer, updatedField);
                    }
                }
            );
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
} 