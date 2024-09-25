import { App } from "obsidian";
import { log } from "./debugUtils";

export class TemplaterUtils {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	initTemplater() {
		const templater =
			this.app.plugins.plugins["templater-obsidian"]?.templater;

		if (!templater) {
			log("errorDebug", "Templater plugin not found.");
			return null;
		}

		const systemModule =
			templater.functions_generator.internal_functions.modules_array.find(
				(m: any) => m.name === "system",
			);
		const fileModule =
			templater.functions_generator.internal_functions.modules_array.find(
				(m: any) => m.name === "file",
			);

		const tpsuggester = systemModule.static_object.suggester;
		const createNew = fileModule.static_object.create_new;
		const findTFile = fileModule.static_object.find_tfile;

		return {
			templater,
			tpsuggester,
			createNew,
			findTFile,
		};
	}
}
