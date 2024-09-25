export const debug = {
	generalDebug: true,
	answerIdDebug: true,
	nestedTpsuggesterDebug: true,
	answerStorageDebug: true,
	questionFlowDebug: true,
	formatAnswerDebug: true,
	frontMatterDebug: true,
	errorDebug: true,
};

export function log(type: keyof typeof debug, ...args: any[]) {
	if (debug[type]) {
		console.log(`[${type}]`, ...args);
	}
}
