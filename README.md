# SVG Generation Benchmark - UI Documentation

## Overview

This benchmark evaluates **10 AI models** on their ability to generate SVG images from text prompts. Each model was tested across **30 creative prompts**, and the generated SVGs were evaluated by **7 independent vision AI models** acting as judges.

## Benchmark Results Summary

- **Total Models Evaluated**: 10 SVG-generating models
- **Total Prompts**: 30 creative text prompts
- **Total Evaluations**: 273 SVG images (some models had incomplete coverage)
- **Vision Judges**: 7 independent vision AI models
- **Evaluation Date**: January 2026

## Methodology

### 1. SVG Generation Phase

Each of the 10 models was asked to generate an SVG image for each of the 30 prompts:

1. `anthropic_claude-opus-4.5`
2. `anthropic_claude-sonnet-4.5`
3. `deepseek_deepseek-v3.2-exp`
4. `google_gemini-2.5-pro`
5. `google_gemini-3.0-pro`
6. `openai-gpt-5.1`
7. `openai-gpt-5.2-pro`
8. `qwen_qwen3-vl-235b-a22b-thinking`
9. `x-ai_grok-code-fast-1`
10. `z-ai_glm-4.6`

### 2. Image Conversion

All generated SVG files were converted to AVIF format for evaluation:
- **Format**: AVIF (chosen over WebP for 29% smaller file size)
- **Quality**: 80% quality at 150 DPI
- **Total Size**: ~4 MB (vs 5.62 MB for WebP)

### 3. Evaluation Phase

Each AVIF image was evaluated by **7 vision AI models** acting as independent judges:

1. **Qwen 2.5 VL 72B** (`qwen/qwen2.5-vl-72b-instruct`)
2. **Google Gemma 3 27B** (`google/gemma-3-27b-it`)
3. **Allen AI Molmo 8B** (`allenai/molmo-2-8b:free`)
4. **Google Gemini Flash Lite** (`google/gemini-2.5-flash-lite`)
5. **Google Gemini Flash Lite Preview** (`google/gemini-2.5-flash-lite-preview-09-2025`)
6. **Google Gemini 3 Flash** (`google/gemini-3-flash-preview`)
7. **Google Gemini Flash Image** (`google/gemini-2.5-flash-image`)

### 4. Evaluation Prompt

Each judge received the following prompt (with the original SVG prompt inserted):

```
You are evaluating an image generated from an SVG.

The original prompt was:
"{PROMPT_TEXT}"

Score the image from 0 to 100 on each criterion:
- Prompt adherence (30% weight): How well does the image match the prompt?
- Structural correctness (20% weight): Are objects drawn correctly and recognizably?
- Physical plausibility (20% weight): Does the scene make physical/spatial sense?
- Completeness (15% weight): Are all requested elements present?
- Visual coherence (15% weight): Is the style consistent and clear?

Return ONLY valid JSON with this exact structure:
{
  "prompt_adherence": <number 0-100>,
  "structural_correctness": <number 0-100>,
  "physical_plausibility": <number 0-100>,
  "completeness": <number 0-100>,
  "visual_coherence": <number 0-100>,
  "total_score": <weighted average>,
  "notes": "<brief explanation>"
}
```

### 5. Scoring Rubric

Each image was scored from 0-100 based on 5 weighted criteria:

| Criterion              | Weight | Description                                      |
|------------------------|--------|--------------------------------------------------|
| Prompt adherence       | 30%    | How well the image matches the prompt content    |
| Structural correctness | 20%    | Objects are drawn correctly and recognizably     |
| Physical plausibility  | 20%    | The scene makes physical/spatial sense           |
| Completeness           | 15%    | All requested elements are present               |
| Visual coherence       | 15%    | Style consistency and overall clarity            |

**Total Score** = Weighted sum of all criteria (max 100)

### 6. Score Aggregation

For each (SVG model, prompt) combination:
- All 7 judges provided independent scores
- Scores were averaged across all judges to produce a single robust score
- This aggregation reduces individual model bias and provides more reliable results

## Data Files

### `benchmark_final.json`

Contains the final aggregated benchmark results:

- **`metadata`**: Information about the benchmark (models, prompts, judges, aggregation method)
- **`model_rankings`**: Overall rankings of all SVG models with average scores across all criteria
- **`prompt_model_scores`**: Per-prompt scores for each model
- **`detailed_aggregated_scores`**: Detailed scores broken down by criterion for each (model, prompt) combination

### `benchmark_insights.json`

Contains AI-generated analysis and insights:

- **`key_findings`**: 6 key insights about model performance patterns
- **`prompt_breakdowns`**: Detailed analysis of 5 representative prompts showing why models scored differently

## UI Features

### 1. Model Rankings Table

Shows overall performance of all models ranked by average total score, with breakdowns by criterion.

### 2. Key Findings

Displays AI-generated insights about model performance, common weaknesses, and recommendations.

### 3. Example Prompt Breakdowns

Shows side-by-side comparisons of winner vs. lowest-scoring models for 5 representative prompts, with images and analysis.

### 4. Per-Prompt Comparison

Interactive table showing scores for all models across all 30 prompts. Click any row to see detailed breakdown.

### 5. Prompt Detail Modal

When clicking a prompt in the comparison table:
- Shows all model scores for that prompt
- Displays generated SVG images for each model
- Shows detailed criterion breakdowns
- Images are clickable to view full size

### 6. Prompts Used for Evaluation Modal

Accessible via the button in the navbar:
- Shows the evaluation prompt template used
- Lists all 30 creative prompts used in the benchmark

## Image URLs

All SVG images are hosted at:
```
https://gally.net/temp/20251107pelican-alternatives/svgs/{model_name}_{prompt_format}.svg
```

**Note**: Some models use `prompt01`, `prompt02` format (with leading zeros), while others use `prompt1`, `prompt2` format.

## Technical Implementation

### Evaluation Script

The evaluation was performed using `evaluate.js`, which:
1. Loads prompts from `prompts.json`
2. Reads AVIF images from the `avif/` directory
3. Sends each image + prompt to vision judges via OpenRouter API
4. Parses JSON responses and saves individual evaluation files
5. Implements retry logic for API rate limits and errors

### Data Aggregation Pipeline

1. **Individual Evaluations**: Each judge's scores saved as separate JSON files
2. **Consolidation**: All evaluations per judge combined into `all_evaluations.json`
3. **Combination**: All judge evaluations merged into `all_evaluations_combined.json`
4. **Grouping**: Data restructured by prompt in `evaluations_by_prompt.json`
5. **Final Aggregation**: Scores averaged across judges to produce `benchmark_final.json`

### UI Implementation

- **Framework**: Bootstrap 5.3.8
- **Icons**: Bootstrap Icons 1.13.1
- **Theme**: Dark mode support via @gramex/ui
- **Data Loading**: Fetch API for JSON files
- **Image Loading**: Lazy loading with error handling

## How to Use

1. **Open `index.html`** in a web browser
2. **View Model Rankings** to see overall performance
3. **Read Key Findings** for insights
4. **Explore Example Breakdowns** to see detailed comparisons
5. **Click any prompt** in the comparison table for detailed analysis
6. **Click "Prompts Used for Evaluation"** button to see all prompts and evaluation methodology

## Key Results

### Top Performers

1. **OpenAI GPT-5.2 Pro**: 83.1 average score
2. **Google Gemini 3.0 Pro**: 77.4 average score
3. **OpenAI GPT-5.1**: 76.5 average score

### Common Findings

- **Physics is the hardest criterion**: All models struggle with physical plausibility
- **Completeness is strongest**: Most models include all requested elements
- **Creative prompts are challenging**: Whimsical or abstract prompts show wider score variance
- **Multi-judge evaluation**: Using 7 independent judges provides robust, unbiased scores

## File Structure

```
ui/
├── index.html              # Main UI page
├── script.js               # UI logic and data rendering
├── benchmark_final.json    # Final aggregated benchmark results
├── benchmark_insights.json # AI-generated insights and analysis
└── README.md              # This file
```

## Notes

- All images are loaded from external URLs (gally.net)
- Missing scores (`-`) indicate model output unavailable or excluded from aggregation
- The UI is fully self-contained in the `ui/` folder
- All data files are local for offline viewing capability

## Evaluation Date

January 2026

---

For questions or issues, refer to the main project documentation or the evaluation scripts in the parent directory.

