export interface StreamingSection {
	key: string;
	html: string;
	tagName: string;
}

function createStreamingSection(tagName: string, html: string, index: number): StreamingSection {
	return {
		key: `${tagName}:${index}`,
		html,
		tagName,
	};
}

export function splitStreamingSections(html: string): StreamingSection[] {
	const template = document.createElement("template");
	template.innerHTML = html;

	const sections: StreamingSection[] = [];
	let sectionIndex = 0;

	for (const node of Array.from(template.content.childNodes)) {
		if (node.nodeType === Node.TEXT_NODE) {
			const textContent = node.textContent ?? "";
			if (textContent.trim().length === 0) {
				continue;
			}

			const paragraph = document.createElement("p");
			paragraph.textContent = textContent;
			sections.push(createStreamingSection(paragraph.tagName, paragraph.outerHTML, sectionIndex));
			sectionIndex += 1;
			continue;
		}

		if (!(node instanceof Element)) {
			continue;
		}

		sections.push(createStreamingSection(node.tagName, node.outerHTML, sectionIndex));
		sectionIndex += 1;
	}

	return sections;
}
