/**
 * Aurora Ontology - Personal Ontology System
 * Question-centered RAG for personal knowledge management
 */

import {
  Plugin,
  TFile,
  WorkspaceLeaf,
  Notice,
  debounce,
} from 'obsidian';

import { ApiClient } from './services/api-client';
import { isQuestionNote, parseFrontmatter } from './services/note-classifier';
import {
  AuroraOntologySettings,
  AuroraOntologySettingTab,
  DEFAULT_SETTINGS,
} from './ui/settings-tab';
import {
  InsightPanelView,
  INSIGHT_PANEL_VIEW_TYPE,
} from './ui/insight-panel';

export default class AuroraOntologyPlugin extends Plugin {
  settings: AuroraOntologySettings = DEFAULT_SETTINGS;
  apiClient: ApiClient = new ApiClient(DEFAULT_SETTINGS.serverUrl);
  private insightPanel: InsightPanelView | null = null;

  async onload(): Promise<void> {
    console.log('Loading Aurora Ontology plugin');

    // Load settings
    await this.loadSettings();

    // Initialize API client with saved settings
    this.apiClient = new ApiClient(this.settings.serverUrl);

    // Register view
    this.registerView(
      INSIGHT_PANEL_VIEW_TYPE,
      (leaf) => {
        this.insightPanel = new InsightPanelView(leaf, this);
        return this.insightPanel;
      }
    );

    // Add ribbon icon
    this.addRibbonIcon('brain', 'Aurora Ontology', () => {
      this.activatePanel();
    });

    // Add commands
    this.addCommand({
      id: 'open-insight-panel',
      name: 'Open Insight Panel',
      callback: () => {
        this.activatePanel();
      },
    });

    this.addCommand({
      id: 'query-related-insights',
      name: 'Query Related Insights',
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (file && isQuestionNote(file)) {
          if (!checking) {
            this.queryForCurrentNote();
          }
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: 'reindex-insights',
      name: 'Re-index All Insights',
      callback: async () => {
        await this.reindexInsights();
      },
    });

    // Add settings tab
    this.addSettingTab(new AuroraOntologySettingTab(this.app, this));

    // Register file events for auto-query
    this.registerEvent(
      this.app.workspace.on('file-open', (file) => {
        if (file && this.settings.autoQuery && isQuestionNote(file)) {
          this.debouncedQuery();
        }
      })
    );

    this.registerEvent(
      this.app.vault.on('modify', (file) => {
        if (
          file instanceof TFile &&
          this.settings.autoQuery &&
          isQuestionNote(file) &&
          this.app.workspace.getActiveFile()?.path === file.path
        ) {
          this.debouncedQuery();
        }
      })
    );

    // Activate panel on startup if it was open
    this.app.workspace.onLayoutReady(() => {
      this.initializePanel();
    });
  }

  async onunload(): Promise<void> {
    console.log('Unloading Aurora Ontology plugin');
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  private async initializePanel(): Promise<void> {
    // Check if panel is already open
    const existing = this.app.workspace.getLeavesOfType(INSIGHT_PANEL_VIEW_TYPE);
    if (existing.length === 0) {
      // Don't auto-open, let user open it
    }
  }

  async activatePanel(autoQuery: boolean = true): Promise<void> {
    const { workspace } = this.app;

    let leaf: WorkspaceLeaf | null = null;
    const leaves = workspace.getLeavesOfType(INSIGHT_PANEL_VIEW_TYPE);

    if (leaves.length > 0) {
      leaf = leaves[0];
    } else {
      leaf = workspace.getRightLeaf(false);
      if (leaf) {
        await leaf.setViewState({
          type: INSIGHT_PANEL_VIEW_TYPE,
          active: true,
        });
      }
    }

    if (leaf) {
      workspace.revealLeaf(leaf);
    }

    // Query for current file if it's a question (only if autoQuery is true)
    if (autoQuery) {
      const activeFile = this.app.workspace.getActiveFile();
      if (activeFile && isQuestionNote(activeFile)) {
        await this.doQuery(activeFile);
      }
    }
  }

  private debouncedQuery = debounce(
    async () => {
      await this.queryForCurrentNote();
    },
    1000,
    true
  );

  async queryForCurrentNote(): Promise<void> {
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile || !isQuestionNote(activeFile)) {
      return;
    }

    // Ensure panel is open (without triggering another query)
    await this.activatePanel(false);

    await this.doQuery(activeFile);
  }

  private async doQuery(file: TFile): Promise<void> {
    if (!this.insightPanel) {
      return;
    }

    // Show loading state
    this.insightPanel.setLoading(true);

    try {
      // Read file content
      const content = await this.app.vault.read(file);
      const { body } = parseFrontmatter(content);

      // Query for related insights
      const queryResult = await this.apiClient.queryInsights({
        question_content: body,
        top_k: this.settings.topK,
        min_similarity: this.settings.minSimilarity,
      });

      if (queryResult.insights.length === 0) {
        this.insightPanel.updateResults(body, [], [
          {
            type: 'amplify',
            question:
              'No related Insights found. What new understanding are you seeking with this question?',
          },
        ]);
        return;
      }

      // Generate comparison questions
      const questionsResult = await this.apiClient.generateQuestions({
        current_question: body,
        retrieved_insights: queryResult.insights,
      });

      // Update panel with results
      this.insightPanel.updateResults(
        body,
        queryResult.insights,
        questionsResult.questions
      );
    } catch (error) {
      console.error('Query failed:', error);
      new Notice(`Query failed: ${error}`);
      this.insightPanel.clearResults();
    }
  }

  async reindexInsights(): Promise<void> {
    new Notice('Starting re-index...');

    try {
      const vaultPath = (this.app.vault.adapter as any).basePath;
      const result = await this.apiClient.reindexInsights({
        vault_path: vaultPath,
      });

      if (result.success) {
        new Notice(
          `Indexed ${result.indexed_count} Insights. ${result.errors.length} errors.`
        );
      } else {
        new Notice('Re-index failed. Check server connection.');
      }
    } catch (error) {
      console.error('Re-index failed:', error);
      new Notice(`Re-index failed: ${error}`);
    }
  }
}
