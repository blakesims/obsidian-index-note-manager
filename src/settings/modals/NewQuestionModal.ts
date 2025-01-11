import { App, Modal, Notice, Setting } from "obsidian";
import { IndexNoteManagerPlugin } from "../../pluginTypes";
import { Question } from "../../types";
import { IndexNoteManagerSettingTab } from "../../settings";

interface NewQuestionModalData {
    questionId: string;
    answerId: string;
    prompt: string;
}

export class NewQuestionModal extends Modal {
    private data: NewQuestionModalData = {
        questionId: "",
        answerId: "",
        prompt: "",
    };

    private plugin: IndexNoteManagerPlugin;
    private settingsTab: IndexNoteManagerSettingTab;

    constructor(
        app: App,
        plugin: IndexNoteManagerPlugin,
        settingsTab: IndexNoteManagerSettingTab,
    ) {
        super(app);
        this.plugin = plugin;
        this.settingsTab = settingsTab;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl("h2", { text: "Add New Question" });

        // Question ID
        new Setting(contentEl)
            .setName("Question ID")
            .setDesc("A unique identifier for this question")
            .addText((text) =>
                text
                    .setPlaceholder("e.g., student_name_question")
                    .onChange((value) => {
                        this.data.questionId = value;
                    }),
            );

        // Answer ID
        new Setting(contentEl)
            .setName("Answer ID")
            .setDesc("The ID used to reference this answer in placeholders")
            .addText((text) =>
                text.setPlaceholder("e.g., student_name").onChange((value) => {
                    this.data.answerId = value;
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
                        this.data.prompt = value;
                    }),
            );

        // Save button
        new Setting(contentEl).addButton((btn) =>
            btn
                .setButtonText("Save")
                .setCta()
                .onClick(() => {
                    const { questionId, answerId, prompt } = this.data;
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

                    this.close();
                    this.settingsTab.display();
                }),
        );
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
} 