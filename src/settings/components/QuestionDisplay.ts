import { App, Setting, ButtonComponent } from "obsidian";
import { IndexNoteManagerPlugin } from "../../pluginTypes";
import { Question } from "../../types";
import { QuestionModal } from "../modals/QuestionModal";

export function createQuestionDisplay(
    containerEl: HTMLElement,
    plugin: IndexNoteManagerPlugin,
    onQuestionChange: () => void
) {
    const questionsContainer = containerEl.createEl("details");
    questionsContainer.createEl("summary", { text: "Questions" });

    // Add help text
    questionsContainer.createEl("p", {
        text: "Configure questions that will be asked when creating notes. These questions can be used in note types and their answers will be available as placeholders.",
        attr: { style: "margin-bottom: 10px; color: var(--text-muted);" },
    });

    // Add "New Question" button
    new ButtonComponent(questionsContainer)
        .setButtonText("Add New Question")
        .setCta()
        .onClick(() => {
            new QuestionModal(
                plugin.app,
                plugin,
                (question: Question) => {
                    const noteConfig = plugin.configManager.getNoteConfig();
                    noteConfig.questions.push(question);
                    plugin.configManager.saveData();
                    onQuestionChange();
                }
            ).open();
        });

    // Display existing questions
    const questions = plugin.configManager.getNoteConfig().questions;
    questions.forEach((question) => {
        const questionEl = new Setting(questionsContainer)
            .setName(question.questionId)
            .setDesc(getQuestionDescription(question))
            .addExtraButton((btn) =>
                btn
                    .setIcon("edit")
                    .setTooltip("Edit Question")
                    .onClick(() => {
                        new QuestionModal(
                            plugin.app,
                            plugin,
                            (updatedQuestion: Question) => {
                                // Find and update the question
                                const noteConfig = plugin.configManager.getNoteConfig();
                                const index = noteConfig.questions.findIndex(
                                    (q) => q.questionId === question.questionId
                                );
                                if (index !== -1) {
                                    noteConfig.questions[index] = updatedQuestion;
                                    plugin.configManager.saveData();
                                    onQuestionChange();
                                }
                            },
                            question
                        ).open();
                    })
            )
            .addExtraButton((btn) =>
                btn
                    .setIcon("trash")
                    .setTooltip("Delete Question")
                    .onClick(() => {
                        const noteConfig = plugin.configManager.getNoteConfig();
                        const index = noteConfig.questions.findIndex(
                            (q) => q.questionId === question.questionId
                        );
                        if (index !== -1) {
                            noteConfig.questions.splice(index, 1);
                            plugin.configManager.saveData();
                            onQuestionChange();
                        }
                    })
            );

        // Add usage information if available
        const usage = getQuestionUsage(plugin, question.questionId);
        if (usage.length > 0) {
            const usageEl = questionEl.descEl.createDiv({
                cls: "question-usage",
                attr: { style: "margin-top: 5px; font-size: 0.8em; color: var(--text-muted);" },
            });
            usageEl.createSpan({ text: "Used in: " });
            usage.forEach((u, i) => {
                usageEl.createSpan({ text: `${u.noteType} > ${u.subtype}${i < usage.length - 1 ? ", " : ""}` });
            });
        }
    });
}

function getQuestionDescription(question: Question): string {
    let desc = `Type: ${question.type}\nPrompt: ${question.prompt}`;
    if (question.type === "nestedTpsuggester" && question.nest) {
        desc += `\nNested questions:\n${question.nest
            .map((q, i) => `${i + 1}. ${q.prompt} (Answer ID: ${q.answerId})`)
            .join("\n")}`;
    }
    return desc;
}

function getQuestionUsage(
    plugin: IndexNoteManagerPlugin,
    questionId: string
): Array<{ noteType: string; subtype: string }> {
    const usage: Array<{ noteType: string; subtype: string }> = [];
    const noteConfig = plugin.configManager.getNoteConfig();

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