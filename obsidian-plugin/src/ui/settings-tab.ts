/**
 * Settings tab for Aurora Ontology plugin configuration.
 */

import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import type AuroraOntologyPlugin from '../main';

export interface AuroraOntologySettings {
  serverUrl: string;
  topK: number;
  minSimilarity: number;
  autoQuery: boolean;
  autoSync: boolean;
  showSimilarityScores: boolean;
}

export const DEFAULT_SETTINGS: AuroraOntologySettings = {
  serverUrl: 'http://127.0.0.1:8742',
  topK: 5,
  minSimilarity: 0.3,
  autoQuery: true,
  autoSync: true,
  showSimilarityScores: true,
};

export class AuroraOntologySettingTab extends PluginSettingTab {
  plugin: AuroraOntologyPlugin;

  constructor(app: App, plugin: AuroraOntologyPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Aurora Ontology Settings' });

    // Server Connection Section
    containerEl.createEl('h3', { text: 'Server Connection' });

    new Setting(containerEl)
      .setName('Server URL')
      .setDesc('URL of the Python backend server')
      .addText((text) =>
        text
          .setPlaceholder('http://127.0.0.1:8742')
          .setValue(this.plugin.settings.serverUrl)
          .onChange(async (value) => {
            this.plugin.settings.serverUrl = value;
            this.plugin.apiClient.updateServerUrl(value);
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Test Connection')
      .setDesc('Check if the server is running and accessible')
      .addButton((button) =>
        button.setButtonText('Test').onClick(async () => {
          try {
            const health = await this.plugin.apiClient.healthCheck();
            new Notice(
              `Connected! ${health.indexed_insights} insights indexed.`
            );
          } catch (error) {
            new Notice(`Connection failed: ${error}`);
          }
        })
      );

    new Setting(containerEl)
      .setName('Sync All Insights')
      .setDesc('Upload all Insight notes to the server')
      .addButton((button) =>
        button.setButtonText('Sync Now').onClick(async () => {
          if (this.plugin.syncService) {
            await this.plugin.syncService.syncAllInsights(true);
          }
        })
      );

    // Query Settings Section
    containerEl.createEl('h3', { text: 'Query Settings' });

    new Setting(containerEl)
      .setName('Number of Results')
      .setDesc('Maximum number of related Insights to retrieve (1-10)')
      .addSlider((slider) =>
        slider
          .setLimits(1, 10, 1)
          .setValue(this.plugin.settings.topK)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.topK = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Minimum Similarity')
      .setDesc('Minimum similarity threshold for results (0.0-1.0)')
      .addSlider((slider) =>
        slider
          .setLimits(0, 1, 0.05)
          .setValue(this.plugin.settings.minSimilarity)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.minSimilarity = value;
            await this.plugin.saveSettings();
          })
      );

    // Behavior Section
    containerEl.createEl('h3', { text: 'Behavior' });

    new Setting(containerEl)
      .setName('Auto Query')
      .setDesc('Automatically query for related Insights when opening Question notes')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.autoQuery)
          .onChange(async (value) => {
            this.plugin.settings.autoQuery = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Auto Sync')
      .setDesc('Automatically sync Insight notes to the server when modified (requires restart)')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.autoSync)
          .onChange(async (value) => {
            this.plugin.settings.autoSync = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Show Similarity Scores')
      .setDesc('Display similarity scores in the Insight panel')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showSimilarityScores)
          .onChange(async (value) => {
            this.plugin.settings.showSimilarityScores = value;
            await this.plugin.saveSettings();
          })
      );

    // About Section
    containerEl.createEl('h3', { text: 'About' });
    containerEl.createEl('p', {
      text: 'Aurora Ontology is a Personal Ontology System that uses Question-centered RAG to help you explore connections between your Insights.',
    });
    containerEl.createEl('p', {
      text: 'Version: 0.1.0',
      cls: 'setting-item-description',
    });
  }
}
