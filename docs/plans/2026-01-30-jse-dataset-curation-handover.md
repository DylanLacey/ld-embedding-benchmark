# Japanese StackExchange Dataset Curation — Handover

**Date:** 2026-01-30
**Updated:** 2026-02-02
**Status:** In progress — notebook polished, ready for labelling

## Goal

Curate the `p1atdev/japanese-stackexchange` dataset to create high-quality training data for a **grammar-relevance classifier**. This classifier will identify StackExchange questions that are useful for Japanese grammar learning.

**End goal:** A labelled dataset suitable for SetFit few-shot training, enabling automatic classification of grammar-relevant content.

## The Big Picture

We want to build a system that can automatically identify "good" Japanese grammar questions from StackExchange. The workflow:

1. **Load** ~28k questions into Argilla for human review
2. **Label** a small seed set manually (few-shot: ~50-100 examples)
3. **Train** SetFit on the seed set
4. **Predict** labels for remaining ~28k records
5. **Review** predictions in Argilla (accept/correct)
6. **Iterate** until quality is sufficient
7. **Export** final curated dataset

## Current Infrastructure

| Component | Location | Status |
|-----------|----------|--------|
| Source dataset | `p1atdev/japanese-stackexchange` | Pinned to `4d65476f8b1d9a140a15e01a4c21e3a39d7b12d9` |
| Argilla Space | `https://dylantonic-lingodingo-annotation.hf.space` | Running (unlisted, persistent storage enabled) |
| Colab notebook | `notebooks/argilla_filter_jse.ipynb` | Committed to git, production-ready |
| Argilla dataset | `jse-full` | Loaded (~28k records) |

## Notebook Features (2026-02-02 Update)

The notebook received significant polish:

### Colab Form UI
All configuration is now editable via Colab's form interface:
- **Argilla Connection**: URL, API key, HF token (with Secrets fallback)
- **Filter Config**: TAG_MODE dropdown, quality thresholds
- **Dataset Names**: Source and output dataset configuration

### Two Tag Modes
```python
TAG_MODE = "comprehensive"  # @param ["suggested", "comprehensive"]
```
- **suggested** (16 tags): Broad, high-frequency grammar tags
- **comprehensive** (137 tags): Full grammar construct list from tag analysis

### Robustness Improvements
- Guards for out-of-order cell execution (`if 'client' not in dir()`)
- W&B logging disabled (no account needed)
- `model_head.pkl` warning suppressed (expected behaviour)
- Error handling with troubleshooting tips
- Shared schema definition (no duplication)
- `HF_SPACE_REPO_ID` derived automatically from Argilla URL

### Simplified Schema
Single question for initial labelling pass:
```python
rg.LabelQuestion(
    name="grammar_relevance",
    labels=["yes_high_quality", "yes_needs_editing", "no_off_topic", "no_too_simple", "no_too_complex"]
)
```

## Label Schema

**Primary question:** `grammar_relevance`

| Label | Meaning |
|-------|---------|
| `yes_high_quality` | Excellent grammar question, include as-is |
| `yes_needs_editing` | Good topic but needs cleanup |
| `no_off_topic` | Not about grammar (vocabulary, culture, etc.) |
| `no_too_simple` | Too basic to be useful |
| `no_too_complex` | Too niche or advanced |

## Quick Start (Resuming Work)

### Option 1: Open from GitHub
1. Go to GitHub repo → `notebooks/argilla_filter_jse.ipynb`
2. Click "Open in Colab" badge (or use File → Open in Colab)
3. Fill in form fields OR set Colab Secrets:
   - `ARGILLA_API_URL`: `https://dylantonic-lingodingo-annotation.hf.space`
   - `ARGILLA_API_KEY`: (from Argilla user settings)
   - `HF_TOKEN`: (from HuggingFace settings)
4. Run cells sequentially

### Option 2: Label in Argilla
1. Open: https://dylantonic-lingodingo-annotation.hf.space
2. Dataset: `jse-full`
3. Label records (aim for balanced classes across all 5 labels)

### Running SetFit Loop
1. Label ~50-100 examples in Argilla
2. Run SetFit cells in notebook (export → train → predict → push suggestions)
3. Return to Argilla to review suggestions
4. Accept good predictions, correct bad ones
5. Repeat until quality is sufficient

## Key Learnings / Gotchas

### Argilla HF Space Authentication
- **Unlisted** Spaces work with API access (private Spaces don't)
- Connection requires both `HF_TOKEN` (Space auth) and `ARGILLA_API_KEY` (Argilla auth)
- Token passed in headers: `headers={"Authorization": f"Bearer {HF_TOKEN}"}`

### SetFit
- Needs ~8+ labelled examples minimum, ideally 2+ per class
- W&B disabled to avoid login prompts
- Base models don't have classification head (trained from scratch)
- Batch size 256 for inference, reduce if GPU OOM

### Argilla v2 API
- Export via `dataset.records.to_datasets()` for clean HF dataset format
- Response columns named `{question_name}.responses`
- Suggestions pushed via `rg.Suggestion(question_name=..., value=..., agent=...)`

## Outstanding Items

- [ ] Label initial seed set (~50-100 examples) in Argilla
- [ ] Run first SetFit training iteration
- [ ] Review prediction distribution and quality
- [ ] Iterate until accuracy is acceptable
- [ ] Export final curated dataset to HF Hub
- [ ] Create `data/sets/sources.yaml` manifest

## Files

```
notebooks/
└── argilla_filter_jse.ipynb    # Main Colab notebook (committed)

docs/plans/
└── 2026-01-30-jse-dataset-curation-handover.md  # This file

tmp/
├── grammar-construct-tags      # Curated tag list (documentation)
└── grammar-construct-tags.py   # Python list for copy-paste
```

## Git Commits (This Session)

```
1fbda28 feat: add Argilla JSE curation notebook
b5e5385 fix(notebook): address code review issues
2800b5d feat(notebook): merge updates from argilla_update.ipynb
beb4e48 refactor(notebook): dedupe schema, add guards, derive Space ID
003d6c7 simplify(notebook): single question schema for initial labelling
4161601 feat(notebook): add TAG_MODE toggle for suggested vs comprehensive tags
50c6b4f feat(notebook): add Colab form UI for filter config
292afcc feat(notebook): add form fields for all config options
d3c0454 fix(notebook): disable W&B prompt and suppress model_head warning
```
