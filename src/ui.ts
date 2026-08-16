/**
 * Boxed questionnaire component — one question at a time, option list with
 * preview pane, "Type something." free-text row, multi-select toggles,
 * progress dots. Built on pi-tui primitives (SelectList + Input); Esc
 * anywhere cancels. Mirrors the visual language of pi's own dialogs.
 */

import type { Theme } from "@earendil-works/pi-coding-agent";
import { type Component, Input, Key, matchesKey, SelectList, type SelectItem, type TUI, truncateToWidth, visibleWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui";
import type { QuestionAnswer, QuestionData } from "./types.ts";

const TYPE_ROW_VALUE = "__type_something__";

export class QuestionnaireComponent implements Component {
	private tab = 0;
	private answers: Array<QuestionAnswer | null>;
	private customMode = false;
	private input = new Input();
	private multiChecked = new Set<number>();
	private done: (result: { answers: QuestionAnswer[]; cancelled: boolean }) => void;
	private select: SelectList;

	constructor(
		private readonly questions: QuestionData[],
		private readonly tui: TUI,
		private readonly theme: Theme,
		done: (result: { answers: QuestionAnswer[]; cancelled: boolean }) => void,
	) {
		this.answers = questions.map(() => null);
		this.done = done;
		this.select = this.buildSelect();
		this.input.onSubmit = (value: string) => this.commitCustom(value);
		this.input.onEscape = () => {
			this.customMode = false;
			this.tui.requestRender();
		};
	}

	// ── state helpers ────────────────────────────────────────────────────

	private itemsFor(q: QuestionData): SelectItem[] {
		const items: SelectItem[] = q.options.map((o) => ({
			value: o.label,
			label: o.label,
			description: o.description,
		}));
		items.push({ value: TYPE_ROW_VALUE, label: "Type something.", description: "Type a custom answer" });
		return items;
	}

	private buildSelect(): SelectList {
		const t = this.theme;
		const q = this.currentQuestion();
		const select = new SelectList(this.itemsFor(q), Math.min(8, q.options.length + 2), {
			selectedPrefix: (text) => t.fg("accent", text),
			selectedText: (text) => t.fg("accent", text),
			description: (text) => t.fg("muted", text),
			scrollInfo: (text) => t.fg("dim", text),
			noMatch: (text) => t.fg("warning", text),
		});
		select.onSelectionChange = () => this.tui.requestRender();
		select.onCancel = () => this.finish(true);
		select.onSelect = (item) => {
			if (item) this.onRow(item); // Enter on an empty list yields null — ignore
		};
		return select;
	}

	private currentQuestion(): QuestionData {
		return this.questions[this.tab]!;
	}

	private currentAnswer(): QuestionAnswer | null {
		return this.answers[this.tab] ?? null;
	}

	// ── actions ──────────────────────────────────────────────────────────

	private onRow(item: SelectItem): void {
		const q = this.currentQuestion();
		if (item.value === TYPE_ROW_VALUE) {
			this.customMode = true;
			this.input.setValue("");
			this.tui.requestRender();
			return;
		}
		if (q.multiSelect) {
			const idx = q.options.findIndex((o) => o.label === item.value);
			if (this.multiChecked.has(idx)) this.multiChecked.delete(idx);
			else this.multiChecked.add(idx);
			this.saveMulti();
			this.tui.requestRender();
			return;
		}
		const opt = q.options.find((o) => o.label === item.value)!;
		this.answers[this.tab] = {
			questionIndex: this.tab,
			question: q.question,
			kind: "option",
			answer: opt.label,
			...(opt.preview ? { preview: opt.preview } : {}),
		};
		this.advance();
	}

	private commitCustom(value: string): void {
		const q = this.currentQuestion();
		if (q.multiSelect) {
			const prev = this.currentAnswer();
			const selected = [...(prev?.kind === "multi" ? prev.selected ?? [] : [])];
			const trimmed = value.trim();
			if (trimmed && !selected.includes(trimmed)) selected.push(trimmed);
			this.answers[this.tab] = { questionIndex: this.tab, question: q.question, kind: "multi", answer: null, selected };
			this.customMode = false;
			this.tui.requestRender();
			return;
		}
		this.answers[this.tab] = { questionIndex: this.tab, question: q.question, kind: "custom", answer: value.trim() || null };
		this.advance();
	}

	private saveMulti(): void {
		const q = this.currentQuestion();
		const selected: string[] = [];
		for (const idx of this.multiChecked) selected.push(q.options[idx]!.label);
		selected.sort((a, b) => q.options.findIndex((o) => o.label === a) - q.options.findIndex((o) => o.label === b));
		this.answers[this.tab] = selected.length > 0 ? { questionIndex: this.tab, question: q.question, kind: "multi", answer: null, selected } : null;
	}

	private advance(): void {
		if (this.tab < this.questions.length - 1) {
			this.tab += 1;
			this.multiChecked = this.restoreChecked();
			this.customMode = false;
			this.select = this.buildSelect();
			this.tui.requestRender();
			return;
		}
		this.finish(false);
	}

	private restoreChecked(): Set<number> {
		const q = this.currentQuestion();
		const a = this.currentAnswer();
		const set = new Set<number>();
		if (q.multiSelect && a?.kind === "multi") {
			for (let i = 0; i < q.options.length; i++) {
				if (a.selected!.includes(q.options[i]!.label)) set.add(i);
			}
		}
		return set;
	}

	private finish(cancelled: boolean): void {
		if (cancelled) {
			this.done({ answers: [], cancelled: true });
			return;
		}
		this.saveMulti();
		this.done({ answers: this.answers.filter((a): a is QuestionAnswer => a !== null), cancelled: false });
	}

	// ── Component ────────────────────────────────────────────────────────

	invalidate(): void {
		/* no cached strings */
	}

	handleInput(data: string): void {
		if (this.customMode) {
			this.input.handleInput(data);
			this.tui.requestRender();
			return;
		}
		if (matchesKey(data, Key.escape) || matchesKey(data, Key.ctrl("c"))) {
			this.finish(true);
			return;
		}
		this.select.handleInput(data);
	}

	render(width: number): string[] {
		const q = this.currentQuestion();
		const lines: string[] = [];
		const boxWidth = Math.min(width - 4, 100);
		const contentWidth = boxWidth - 4;
		const pad = (line: string): string => line + " ".repeat(Math.max(0, width - visibleWidth(line)));
		const dim = (s: string): string => this.theme.fg("dim", s);
		const bar = (): string => dim("├" + "─".repeat(boxWidth - 2) + "┤");
		const row = (content: string): string => dim("│") + " " + content + " ".repeat(Math.max(0, boxWidth - visibleWidth(content) - 3)) + dim("│");

		lines.push(pad(dim("╭" + "─".repeat(boxWidth - 2) + "╮")));
		const answered = this.answers.filter((a) => a !== null).length;
		lines.push(pad(row(`${this.theme.fg("accent", this.theme.bold("Questions"))} ${this.theme.fg("dim", `(${this.tab + 1}/${this.questions.length})`)}`)));
		lines.push(pad(bar()));

		// progress dots
		const dots = this.questions
			.map((_, i) => {
				if (i === this.tab) return this.theme.fg("accent", "●");
				if (this.answers[i]) return this.theme.fg("success", "●");
				return dim("○");
			})
			.join(" ");
		lines.push(pad(row(dots)));
		lines.push(pad(row("")));

		// header chip + question
		lines.push(pad(row(this.theme.fg("accent", `[${q.header}]`))));
		for (const line of wrapTextWithAnsi(this.theme.bold(q.question), contentWidth - 2)) {
			lines.push(pad(row(line)));
		}
		lines.push(pad(row("")));

		if (this.customMode) {
			const inputLines = this.input.render(contentWidth - 6);
			for (const line of inputLines) lines.push(pad(row(line)));
			lines.push(pad(row(this.theme.fg("dim", "Enter to submit custom answer · Esc back to options"))));
		} else {
			const selected = this.select.getSelectedItem();
			for (const line of this.select.render(boxWidth - 2)) {
				lines.push(pad(row(line)));
			}
			// multi-select check state
			if (q.multiSelect) {
				const checked = [...this.multiChecked].map((i) => q.options[i]!.label).join(", ");
				if (checked) lines.push(pad(row(this.theme.fg("success", `✓ ${checked}`))));
			}
			lines.push(pad(row("")));
			// preview pane for focused option
			const focused = selected && selected.value !== TYPE_ROW_VALUE ? q.options.find((o) => o.label === selected.value) : undefined;
			if (focused?.preview) {
				lines.push(pad(bar()));
				lines.push(pad(row(this.theme.fg("accent", "Preview"))));
				for (const line of focused.preview.split("\n").slice(0, 10)) {
					lines.push(pad(row(this.theme.fg("dim", truncateToWidth(line, contentWidth - 2)))));
				}
				lines.push(pad(bar()));
			}
		}

		lines.push(pad(bar()));
		const multi = q.multiSelect ? "Enter toggle · Ctrl+S done · " : "Enter next · ";
		const controls = dim(`${multi}↑↓ select · Type something. = custom · Esc cancel`);
		lines.push(pad(row(truncateToWidth(controls, contentWidth))));
		lines.push(pad(dim("╰" + "─".repeat(boxWidth - 2) + "╯")));
		return lines;
	}
}
