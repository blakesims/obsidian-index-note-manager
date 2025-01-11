import { Setting } from "obsidian";
import { FrontMatterField } from "../../types";

export function showTemplaterFunctionInput(
    container: HTMLElement,
    field: FrontMatterField
): void {
    new Setting(container)
        .setName("Templater Function")
        .setDesc("Enter the templater function (e.g., tp.file.creation_date())")
        .addText((text) =>
            text
                .setPlaceholder("<% tp.file.creation_date() %>")
                .setValue(field.templaterFunction || "")
                .onChange((value) => {
                    field.templaterFunction = value;
                    field.value = value; // Set the value to the templater function
                })
        );
}

export function createFrontMatterFieldComponent(
    container: HTMLElement,
    field: FrontMatterField,
    onUpdate: (updatedField: FrontMatterField) => void
): void {
    // Implementation here...
} 