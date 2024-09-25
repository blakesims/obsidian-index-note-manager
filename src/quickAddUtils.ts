import { App } from "obsidian";
import { log } from "./debugUtils";

export class QuickAddUtils {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	async inputPrompt(
		header: string,
		placeholder?: string,
		value?: string,
	): Promise<string> {
		const quickAdd = this.app.plugins.plugins["quickadd"];
		if (!quickAdd) {
			log(
				"errorDebug",
				"QuickAdd plugin not found. Using default prompt.",
			);
			return prompt(header) || ""; // Ensure it returns a string
		}
		return await quickAdd.api.inputPrompt(header, placeholder, value);
	}

	async suggester(
		displayItems: string[],
		actualItems: string[],
		header: string,
	): Promise<string> {
		const quickAdd = this.app.plugins.plugins["quickadd"];
		if (!quickAdd) {
			log(
				"errorDebug",
				"QuickAdd plugin not found. Using default suggester.",
			);
			return actualItems[0];
		}
		return await quickAdd.api.suggester(displayItems, actualItems, header);
	}
}
