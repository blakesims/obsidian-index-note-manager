import { App, Modal, Notice, Setting } from "obsidian";
import { IndexNoteManagerPlugin } from "../../pluginTypes";
import { Question } from "../../types";

export class QuestionEditModal extends Modal {
    private question: Question;
    private plugin: IndexNoteManagerPlugin;

    constructor(app: App, plugin: IndexNoteManagerPlugin, question: Question) {
        super(app);
        this.plugin = plugin;
        this.question = question;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl("h2", { text: "Edit Question" });

        // Question ID (read-only)
        new Setting(contentEl)
            .setName("Question ID")
            .addText((text) =>
                text.setValue(this.question.questionId).setDisabled(true),
            );

        // Answer ID
        new Setting(contentEl).setName("Answer ID").addText((text) =>
            text.setValue(this.question.answerId).onChange(async (value) => {
                this.question.answerId = value;
            }),
        );

        // Prompt
        new Setting(contentEl).setName("Prompt").addText((text) =>
            text.setValue(this.question.prompt).onChange(async (value) => {
                this.question.prompt = value;
            }),
        );

        // Usage information
        const usageContainer = contentEl.createEl("div");
        usageContainer.createEl("h3", { text: "Used In" });
        const usage = this.getQuestionUsage(this.question.questionId);

        if (usage.length > 0) {
            const ul = usageContainer.createEl("ul");
            usage.forEach((u) => {
                ul.createEl("li", {
                    text: `${u.noteType} > ${u.subtype}`,
                });
            });
        } else {
            usageContainer.createEl("p", {
                text: "Not currently used in any note types",
                attr: { style: "color: var(--text-error);" },
            });
        }

        // Save button
        new Setting(contentEl).addButton((btn) =>
            btn.setButtonText("Save").onClick(async () => {
                await this.plugin.configManager.saveData();
                this.close();
            }),
        );
    }

    private getQuestionUsage(
        questionId: string,
    ): Array<{ noteType: string; subtype: string }> {
        const usage: Array<{ noteType: string; subtype: string }> = [];
        const noteConfig = this.plugin.configManager.getNoteConfig();

        noteConfig.noteTypes.forEach((noteType) => {
            noteType.subtypes.forEach((subtype) => {
                if (subtype.questions.includes(questionId)) {
                    usage.push({
                        noteType: noteType.id,
                        subtype: subtype.id,
                    });
                }
            });
        });

        return usage;
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
} 