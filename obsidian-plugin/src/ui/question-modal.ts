/**
 * Modal for displaying detailed AI-generated questions and creating new Insights.
 */

import { Modal, App, TFile, Setting, TextAreaComponent } from 'obsidian';
import type AuroraOntologyPlugin from '../main';
import { ComparisonQuestion, RetrievedInsight } from '../types/api';

export class QuestionDetailModal extends Modal {
  private plugin: AuroraOntologyPlugin;
  private question: ComparisonQuestion;
  private insights: RetrievedInsight[];

  constructor(
    app: App,
    plugin: AuroraOntologyPlugin,
    question: ComparisonQuestion,
    insights: RetrievedInsight[]
  ) {
    super(app);
    this.plugin = plugin;
    this.question = question;
    this.insights = insights;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('aurora-question-modal');

    // Header
    contentEl.createEl('h2', { text: 'Reflection Question' });

    // Question type badge
    const badge = contentEl.createEl('span', {
      cls: `aurora-badge aurora-badge-${this.question.type}`,
    });
    badge.setText(this.formatQuestionType(this.question.type));

    // Quote section
    if (this.question.quote) {
      contentEl.createEl('h4', { text: 'Referenced Insight' });
      const quoteEl = contentEl.createEl('blockquote', { cls: 'aurora-modal-quote' });
      quoteEl.setText(this.question.quote);

      if (this.question.insight_reference) {
        const refPath = this.question.insight_reference;
        new Setting(contentEl)
          .setName('Source')
          .setDesc(refPath)
          .addButton((btn) =>
            btn.setButtonText('Open').onClick(async () => {
              const file = this.app.vault.getAbstractFileByPath(refPath);
              if (file instanceof TFile) {
                await this.app.workspace.getLeaf().openFile(file);
                this.close();
              }
            })
          );
      }
    }

    // Question text
    contentEl.createEl('h4', { text: 'Question' });
    const questionEl = contentEl.createEl('p', { cls: 'aurora-modal-question' });
    questionEl.setText(this.question.question);

    // Actions
    contentEl.createEl('h4', { text: 'Actions' });

    new Setting(contentEl)
      .setName('Copy Question')
      .setDesc('Copy this question to clipboard')
      .addButton((btn) =>
        btn.setButtonText('Copy').onClick(() => {
          navigator.clipboard.writeText(this.question.question);
          btn.setButtonText('Copied!');
          setTimeout(() => btn.setButtonText('Copy'), 1500);
        })
      );

    new Setting(contentEl)
      .setName('Create New Insight')
      .setDesc('Start a new Insight note based on this question')
      .addButton((btn) =>
        btn
          .setButtonText('Create Insight')
          .setCta()
          .onClick(() => {
            this.close();
            new CreateInsightModal(
              this.app,
              this.plugin,
              this.question.question
            ).open();
          })
      );

    // Close button
    new Setting(contentEl).addButton((btn) =>
      btn.setButtonText('Close').onClick(() => this.close())
    );
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }

  private formatQuestionType(type: string): string {
    switch (type) {
      case 'memory_invoke':
        return 'Memory Invoker';
      case 'conflict_detect':
        return 'Conflict Detector';
      case 'amplify':
        return 'Question Amplifier';
      default:
        return type;
    }
  }
}

export class CreateInsightModal extends Modal {
  private plugin: AuroraOntologyPlugin;
  private promptQuestion: string;
  private titleInput: string = '';
  private contentInput: string = '';

  constructor(app: App, plugin: AuroraOntologyPlugin, promptQuestion: string) {
    super(app);
    this.plugin = plugin;
    this.promptQuestion = promptQuestion;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('aurora-create-insight-modal');

    contentEl.createEl('h2', { text: 'Create New Insight' });

    // Show the prompt question
    const promptEl = contentEl.createEl('div', { cls: 'aurora-prompt-section' });
    promptEl.createEl('h4', { text: 'Prompted by:' });
    promptEl.createEl('p', { text: this.promptQuestion, cls: 'aurora-prompt-text' });

    // Title input
    new Setting(contentEl)
      .setName('Title')
      .setDesc('Name for the new Insight note')
      .addText((text) =>
        text
          .setPlaceholder('My new insight...')
          .onChange((value) => {
            this.titleInput = value;
          })
      );

    // Content input
    contentEl.createEl('h4', { text: 'Your Insight' });
    const textArea = new TextAreaComponent(contentEl);
    textArea.setPlaceholder(
      'Write your insight here...\n\nRemember: An Insight is understanding that emerges from exploring a Question. What new understanding have you gained?'
    );
    textArea.inputEl.rows = 10;
    textArea.inputEl.style.width = '100%';
    textArea.onChange((value) => {
      this.contentInput = value;
    });

    // Actions
    new Setting(contentEl)
      .addButton((btn) =>
        btn.setButtonText('Cancel').onClick(() => this.close())
      )
      .addButton((btn) =>
        btn
          .setButtonText('Create')
          .setCta()
          .onClick(async () => {
            await this.createInsight();
          })
      );
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }

  private async createInsight(): Promise<void> {
    if (!this.titleInput.trim()) {
      // Show error
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    const frontmatter = `---
type: insight
created: ${today}
confidence: low
source_questions: []
---

`;

    const content =
      frontmatter + (this.contentInput || `> ${this.promptQuestion}\n\n`);
    const fileName = `Insights/${this.titleInput.trim()}.md`;

    try {
      const file = await this.app.vault.create(fileName, content);
      await this.app.workspace.getLeaf().openFile(file);
      this.close();
    } catch (error) {
      console.error('Failed to create Insight:', error);
    }
  }
}
