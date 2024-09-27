export class ModalUtils {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	async showModal(
		promptQuestion: string,
		suggestions: string[],
	): Promise<string | null> {
		return new Promise((resolve, reject) => {
			// Create modal container
			const modal = document.createElement("div");
			modal.className = "custom-modal";
			modal.innerHTML = `
                <div class="custom-modal-content">
                    <button id="cancelBtn" class="cancel-btn">×</button>
                    <h2>${promptQuestion}</h2>
                    <input type="text" id="customInput" placeholder="Type to search options">
                    <div class="suggestion-container"></div>
                </div>
            `;

			// Add suggestions
			const suggestionContainer = modal.querySelector(
				".suggestion-container",
			);
			let currentIndex = -1;

			function renderSuggestions(filteredSuggestions: string[]) {
				suggestionContainer.innerHTML = "";
				filteredSuggestions.forEach((suggestion, index) => {
					const btn = document.createElement("button");
					btn.textContent = suggestion;
					btn.className = "suggestion-btn";
					btn.onclick = () => {
						document.getElementById("customInput").value =
							suggestion;
						resolve(suggestion);
						document.body.removeChild(modal);
					};
					if (index === currentIndex) {
						btn.classList.add("selected");
					}
					suggestionContainer.appendChild(btn);
				});
			}

			function filterSuggestions(query: string) {
				const lowerQuery = query.toLowerCase();
				return suggestions.filter((suggestion) =>
					suggestion.toLowerCase().includes(lowerQuery),
				);
			}

			function handleKeyDown(event: KeyboardEvent) {
				const filteredSuggestions = filterSuggestions(inputEl.value);
				if (event.key === "ArrowDown") {
					currentIndex =
						(currentIndex + 1) % filteredSuggestions.length;
					renderSuggestions(filteredSuggestions);
				} else if (event.key === "ArrowUp") {
					currentIndex =
						(currentIndex - 1 + filteredSuggestions.length) %
						filteredSuggestions.length;
					renderSuggestions(filteredSuggestions);
				} else if (event.key === "Enter") {
					if (
						currentIndex >= 0 &&
						currentIndex < filteredSuggestions.length
					) {
						const selectedSuggestion =
							filteredSuggestions[currentIndex];
						inputEl.value = selectedSuggestion;
						resolve(selectedSuggestion);
						document.body.removeChild(modal);
					}
				}
			}

			const inputEl = modal.querySelector(
				"#customInput",
			) as HTMLInputElement;
			inputEl.addEventListener("input", () => {
				currentIndex = -1;
				renderSuggestions(filterSuggestions(inputEl.value));
			});

			inputEl.addEventListener("keydown", handleKeyDown);

			modal.querySelector("#cancelBtn").onclick = () => {
				reject(new Error("Cancelled prompt"));
				document.body.removeChild(modal);
			};

			// Add modal to body
			document.body.appendChild(modal);

			// Focus on input
			inputEl.focus();

			// Initial render of suggestions
			renderSuggestions(suggestions);
		});
	}

	async inputPrompt(prompt: string): Promise<string | null> {
		return new Promise((resolve, reject) => {
			const modal = document.createElement("div");
			modal.className = "custom-modal";
			modal.innerHTML = `
                <div class="custom-modal-content">
                    <button id="cancelBtn" class="cancel-btn">×</button>
                    <h2>${prompt}</h2>
                    <input type="text" id="customInput" placeholder="Enter your answer">
                </div>
            `;

			const inputEl = modal.querySelector(
				"#customInput",
			) as HTMLInputElement;

			modal.querySelector("#cancelBtn").onclick = () => {
				reject(new Error("Cancelled prompt"));
				document.body.removeChild(modal);
			};

			inputEl.addEventListener("keydown", (event: KeyboardEvent) => {
				if (event.key === "Enter") {
					resolve(inputEl.value);
					document.body.removeChild(modal);
				}
			});

			document.body.appendChild(modal);
			inputEl.focus();
		});
	}
}
