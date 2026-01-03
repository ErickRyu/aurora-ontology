/**
 * Side panel view for displaying retrieved Insights and AI-generated questions.
 */

import { ItemView, WorkspaceLeaf, MarkdownRenderer, TFile } from 'obsidian';
import type AuroraOntologyPlugin from '../main';
import { RetrievedInsight, ComparisonQuestion } from '../types/api';

export const INSIGHT_PANEL_VIEW_TYPE = 'aurora-insight-panel';

export class InsightPanelView extends ItemView {
  plugin: AuroraOntologyPlugin;
  private currentQuestion: string | null = null;
  private insights: RetrievedInsight[] = [];
  private questions: ComparisonQuestion[] = [];
  private isLoading = false;

  constructor(leaf: WorkspaceLeaf, plugin: AuroraOntologyPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return INSIGHT_PANEL_VIEW_TYPE;
  }

  getDisplayText(): string {
    return 'Aurora Ontology';
  }

  getIcon(): string {
    return 'brain';
  }

  async onOpen(): Promise<void> {
    this.render();
  }

  async onClose(): Promise<void> {
    // Cleanup if needed
  }

  setLoading(loading: boolean): void {
    this.isLoading = loading;
    this.render();
  }

  updateResults(
    question: string,
    insights: RetrievedInsight[],
    questions: ComparisonQuestion[]
  ): void {
    this.currentQuestion = question;
    this.insights = insights;
    this.questions = questions;
    this.isLoading = false;
    this.render();
  }

  clearResults(): void {
    this.currentQuestion = null;
    this.insights = [];
    this.questions = [];
    this.isLoading = false;
    this.render();
  }

  private render(): void {
    const container = this.containerEl.children[1];
    container.empty();

    container.addClass('aurora-insight-panel');

    // Header
    const header = container.createEl('div', { cls: 'aurora-panel-header' });
    header.createEl('h4', { text: 'Aurora Ontology' });

    if (this.isLoading) {
      this.renderLoading(container);
      return;
    }

    if (!this.currentQuestion) {
      this.renderEmpty(container);
      return;
    }

    // Insights Section
    this.renderInsights(container);

    // Questions Section
    this.renderQuestions(container);
  }

  private renderLoading(container: Element): void {
    const loadingEl = container.createEl('div', { cls: 'aurora-loading' });
    loadingEl.createEl('div', { cls: 'aurora-spinner' });
    loadingEl.createEl('p', { text: 'Searching for related Insights...' });
  }

  private renderEmpty(container: Element): void {
    const emptyEl = container.createEl('div', { cls: 'aurora-empty' });
    emptyEl.createEl('p', {
      text: 'Open a Question note to see related Insights.',
    });
    emptyEl.createEl('p', {
      text: 'Question notes should be in the Questions/ folder.',
      cls: 'aurora-hint',
    });
  }

  private renderInsights(container: Element): void {
    const section = container.createEl('div', { cls: 'aurora-section' });
    section.createEl('h5', { text: `Related Insights (${this.insights.length})` });

    if (this.insights.length === 0) {
      section.createEl('p', {
        text: 'No related Insights found.',
        cls: 'aurora-no-results',
      });
      return;
    }

    const list = section.createEl('div', { cls: 'aurora-insight-list' });

    for (const insight of this.insights) {
      const item = list.createEl('div', { cls: 'aurora-insight-item' });

      // Header with path and similarity
      const itemHeader = item.createEl('div', { cls: 'aurora-insight-header' });

      const pathLink = itemHeader.createEl('a', {
        cls: 'aurora-insight-path',
        text: insight.path.replace('Insights/', '').replace('.md', ''),
      });
      pathLink.addEventListener('click', () => {
        this.openInsight(insight.path);
      });

      if (this.plugin.settings.showSimilarityScores) {
        itemHeader.createEl('span', {
          cls: 'aurora-similarity',
          text: `${Math.round(insight.similarity * 100)}%`,
        });
      }

      // Content preview
      const preview = item.createEl('div', { cls: 'aurora-insight-preview' });
      const previewText = insight.content.slice(0, 200) + (insight.content.length > 200 ? '...' : '');
      preview.setText(previewText);
    }
  }

  private renderQuestions(container: Element): void {
    const section = container.createEl('div', { cls: 'aurora-section' });
    section.createEl('h5', { text: 'Reflection Questions' });

    if (this.questions.length === 0) {
      section.createEl('p', {
        text: 'No questions generated.',
        cls: 'aurora-no-results',
      });
      return;
    }

    const list = section.createEl('div', { cls: 'aurora-question-list' });

    for (const question of this.questions) {
      const item = list.createEl('div', { cls: 'aurora-question-item' });

      // Type badge
      const badge = item.createEl('span', { cls: `aurora-badge aurora-badge-${question.type}` });
      badge.setText(this.formatQuestionType(question.type));

      // Quote if present
      if (question.quote) {
        const quoteEl = item.createEl('blockquote', { cls: 'aurora-quote' });
        quoteEl.setText(question.quote);

        if (question.insight_reference) {
          const refLink = quoteEl.createEl('a', {
            cls: 'aurora-ref-link',
            text: ' [source]',
          });
          refLink.addEventListener('click', () => {
            if (question.insight_reference) {
              this.openInsight(question.insight_reference);
            }
          });
        }
      }

      // Question text
      const questionEl = item.createEl('p', { cls: 'aurora-question-text' });
      questionEl.setText(question.question);

      // Copy button
      const copyBtn = item.createEl('button', { cls: 'aurora-copy-btn' });
      copyBtn.setText('Copy');
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(question.question);
        copyBtn.setText('Copied!');
        setTimeout(() => copyBtn.setText('Copy'), 1500);
      });
    }
  }

  private formatQuestionType(type: string): string {
    switch (type) {
      case 'memory_invoke':
        return 'Memory';
      case 'conflict_detect':
        return 'Tension';
      case 'amplify':
        return 'Explore';
      default:
        return type;
    }
  }

  private async openInsight(path: string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (file instanceof TFile) {
      await this.app.workspace.getLeaf().openFile(file);
    }
  }
}
