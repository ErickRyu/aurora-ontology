# Aurora Ontology - Personal Ontology System

**Question-centered RAG for personal knowledge management**

Obsidian 기반의 개인 온톨로지 시스템으로, Question을 중심으로 과거 Insight를 Retrieval하여 사고를 촉진하는 AI 파트너 시스템입니다.

## Core Concepts

| Entity | 정의 |
|--------|------|
| **Thought** | 현재 시점의 주장, 느낌, 가설 |
| **Question** | Thought에서 발생한 균열, 설명 불가능 지점 |
| **Insight** | Question을 통해 관계가 재구성된 이해 |

## AI Behavior

AI는 **답변 생성기**가 아니라 **사고 촉진 파트너**로 동작합니다:

- **Memory Invoker**: "과거에 이런 Insight가 있었습니다"
- **Conflict Detector**: "이 Insight와 지금 질문은 이 지점에서 어긋납니다"
- **Question Amplifier**: "이 차이를 설명할 수 있나요?"

## Architecture

```
┌─────────────────────┐         HTTP REST          ┌─────────────────────┐
│   Obsidian Plugin   │ <───────────────────────>  │   Python Server     │
│   (TypeScript)      │                            │   (FastAPI)         │
└─────────────────────┘                            └─────────────────────┘
         │                                                  │
         v                                                  v
┌─────────────────────┐                            ┌─────────────────────┐
│   Vault Files       │                            │   ChromaDB          │
│   (.md notes)       │                            │   (Vector Store)    │
└─────────────────────┘                            └─────────────────────┘
                                                           │
                                                           v
                                                   ┌─────────────────────┐
                                                   │   OpenAI API        │
                                                   └─────────────────────┘
```

## Quick Start

### 1. Python Server Setup

```bash
cd python-server

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and add your OpenAI API key

# Run server
python run.py
```

### 2. Obsidian Plugin Setup

```bash
cd obsidian-plugin

# Install dependencies
npm install

# Build plugin
npm run build

# Link to your vault
ln -s $(pwd) /path/to/your/vault/.obsidian/plugins/aurora-ontology
```

### 3. Vault Structure

Create the following folders in your Obsidian vault:

```
vault/
├── Thoughts/     # Your thoughts, claims, hypotheses
├── Questions/    # Questions that arise from thoughts
└── Insights/     # Understanding gained through exploration
```

## Usage

1. Write notes in the `Thoughts/` folder
2. When a question arises, create a note in `Questions/`
3. The plugin will automatically find related `Insights`
4. AI generates comparison questions to deepen your thinking
5. Write new Insights or modify existing ones

## Vault Note Templates

### Question Template

```yaml
---
type: question
created: 2025-01-03
status: open
triggered_by: "[[Related Thought]]"
---

Your question here...
```

### Insight Template

```yaml
---
type: insight
created: 2025-01-03
confidence: low
source_questions: []
---

Your insight here...
```

## Configuration

### Plugin Settings

- **Server URL**: Python backend URL (default: `http://127.0.0.1:8742`)
- **Number of Results**: Max Insights to retrieve (1-10)
- **Minimum Similarity**: Threshold for relevance (0.0-1.0)
- **Auto Query**: Automatically query when opening Question notes

### Environment Variables

```bash
# .env file
OPENAI_API_KEY=your-api-key
HOST=127.0.0.1
PORT=8742
VAULT_PATH=/path/to/vault
CHROMA_PERSIST_DIR=./chroma_data
```

## Development

### Python Server

```bash
cd python-server
python run.py  # Auto-reload enabled
```

### Obsidian Plugin

```bash
cd obsidian-plugin
npm run dev  # Watch mode
```

## Tech Stack

- **Plugin**: TypeScript + Obsidian API
- **Backend**: Python + FastAPI
- **Vector DB**: ChromaDB
- **Embedding**: OpenAI text-embedding-3-small
- **LLM**: OpenAI GPT-4

## License

MIT
