// SVG Generation Benchmark UI Script

// Load benchmark data
async function loadBenchmarkData() {
  const response = await fetch('benchmark_final.json');
  return await response.json();
}

// Load insights data
async function loadInsightsData() {
  try {
    const response = await fetch('benchmark_insights.json');
    return await response.json();
  } catch (e) {
    return null;
  }
}

// Score color helper
function getScoreClass(score) {
  if (score >= 75) return 'score-high';
  if (score >= 50) return 'score-mid';
  return 'score-low';
}

// Format model name for display
function formatModelName(name) {
  return name
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// Render summary table
function renderSummaryTable(data) {
  const tbody = document.getElementById('summary-body');
  tbody.innerHTML = '';

  data.model_rankings.forEach((model, idx) => {
    const rankClass = idx < 3 ? `rank-${idx + 1}` : '';
    const rankIcon = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : model.rank;

    const row = document.createElement('tr');
    row.className = rankClass;
    row.innerHTML = `
      <td class="fw-bold">${rankIcon}</td>
      <td><strong>${formatModelName(model.model)}</strong></td>
      <td class="score-cell ${getScoreClass(model.avg_total_score)}">${model.avg_total_score}</td>
      <td class="score-cell ${getScoreClass(model.avg_prompt_adherence)}">${model.avg_prompt_adherence}</td>
      <td class="score-cell ${getScoreClass(model.avg_structural_correctness)}">${model.avg_structural_correctness}</td>
      <td class="score-cell ${getScoreClass(model.avg_physical_plausibility)}">${model.avg_physical_plausibility}</td>
      <td class="score-cell ${getScoreClass(model.avg_completeness)}">${model.avg_completeness}</td>
      <td class="score-cell ${getScoreClass(model.avg_visual_coherence)}">${model.avg_visual_coherence}</td>
    `;
    tbody.appendChild(row);
  });
}

// Generate insights from data
function generateInsights(data) {
  const rankings = data.model_rankings;
  const top = rankings[0];
  const bottom = rankings[rankings.length - 1];

  // Find best/worst per criterion
  const criteria = ['avg_prompt_adherence', 'avg_structural_correctness', 'avg_physical_plausibility', 'avg_completeness', 'avg_visual_coherence'];
  const criteriaLabels = {
    avg_prompt_adherence: 'Prompt Adherence',
    avg_structural_correctness: 'Structural Correctness',
    avg_physical_plausibility: 'Physical Plausibility',
    avg_completeness: 'Completeness',
    avg_visual_coherence: 'Visual Coherence'
  };

  // Find lowest average criterion
  let lowestCriterion = criteria[0];
  let lowestAvg = 100;
  criteria.forEach(c => {
    const avg = rankings.reduce((sum, m) => sum + (m[c] || 0), 0) / rankings.length;
    if (avg < lowestAvg) {
      lowestAvg = avg;
      lowestCriterion = c;
    }
  });

  // Find highest variance criterion
  let highestVariance = 0;
  let varianceCriterion = criteria[0];
  criteria.forEach(c => {
    const values = rankings.map(m => m[c]).filter(v => v != null);
    const max = Math.max(...values);
    const min = Math.min(...values);
    const variance = max - min;
    if (variance > highestVariance) {
      highestVariance = variance;
      varianceCriterion = c;
    }
  });

  const insights = [
    {
      icon: 'bi-trophy-fill',
      color: 'success',
      title: 'Top Performer',
      text: `<strong>${formatModelName(top.model)}</strong> leads with an average score of <strong>${top.avg_total_score}</strong>, excelling in prompt adherence (${top.avg_prompt_adherence}) and completeness (${top.avg_completeness}).`
    },
    {
      icon: 'bi-exclamation-triangle-fill',
      color: 'warning',
      title: 'Biggest Challenge',
      text: `<strong>${criteriaLabels[lowestCriterion]}</strong> is the hardest criterion with an average of only <strong>${lowestAvg.toFixed(1)}</strong> across all models.`
    },
    {
      icon: 'bi-graph-up',
      color: 'info',
      title: 'Most Variance',
      text: `<strong>${criteriaLabels[varianceCriterion]}</strong> shows the widest performance gap (<strong>${highestVariance.toFixed(1)} points</strong>), indicating models differ most in this area.`
    },
    {
      icon: 'bi-arrow-down-circle-fill',
      color: 'danger',
      title: 'Needs Improvement',
      text: `<strong>${formatModelName(bottom.model)}</strong> scored lowest at <strong>${bottom.avg_total_score}</strong>, struggling particularly with physics (${bottom.avg_physical_plausibility}) and structure (${bottom.avg_structural_correctness}).`
    },
    {
      icon: 'bi-check-circle-fill',
      color: 'primary',
      title: 'Strong Across Board',
      text: `Most models score well on <strong>Completeness</strong> (avg ${(rankings.reduce((s, m) => s + m.avg_completeness, 0) / rankings.length).toFixed(1)}), suggesting they include all requested elements.`
    },
    {
      icon: 'bi-lightbulb-fill',
      color: 'secondary',
      title: 'Recommendation',
      text: `For best results, use <strong>${formatModelName(top.model)}</strong>. For cost-effective options, consider models ranked 2-4 which offer good balance.`
    }
  ];

  return insights;
}

// Render insights
function renderInsights(data) {
  const container = document.getElementById('insights-container');
  const insights = generateInsights(data);

  container.innerHTML = insights.map(insight => `
    <div class="col-md-6 col-lg-4">
      <div class="card insight-card h-100 model-card" style="border-left-color: var(--bs-${insight.color});">
        <div class="card-body">
          <h6 class="card-title">
            <i class="bi ${insight.icon} text-${insight.color} me-2"></i>${insight.title}
          </h6>
          <p class="card-text small mb-0">${insight.text}</p>
        </div>
      </div>
    </div>
  `).join('');
}

// Render per-prompt table
function renderPromptsTable(data) {
  const models = data.model_rankings.map(m => m.model);
  const prompts = data.prompt_model_scores;

  // Header
  const header = document.getElementById('prompts-header');
  header.innerHTML = `<th>Prompt</th>` + models.map(m => `<th class="text-center small">${formatModelName(m).split(' ')[0]}</th>`).join('');

  // Body
  const tbody = document.getElementById('prompts-body');
  tbody.innerHTML = '';

  prompts.forEach(prompt => {
    const row = document.createElement('tr');
    row.className = 'clickable-row';
    row.setAttribute('data-prompt', prompt.prompt);
    row.innerHTML = `
      <td><strong>Prompt ${prompt.prompt}</strong></td>
      ${models.map(m => {
        const score = prompt[m];
        if (score == null) return '<td class="text-center text-muted">-</td>';
        return `<td class="text-center score-cell ${getScoreClass(score)}">${score}</td>`;
      }).join('')}
    `;
    row.addEventListener('click', () => showPromptDetail(data, prompt.prompt));
    tbody.appendChild(row);
  });
}

// Show prompt detail modal
function showPromptDetail(data, promptNum) {
  const prompt = data.prompt_model_scores.find(p => p.prompt === promptNum);
  const detailedScores = data.detailed_aggregated_scores;

  const modalTitle = document.getElementById('promptModalTitle');
  modalTitle.innerHTML = `<i class="bi bi-chat-quote me-2"></i>Prompt ${promptNum}`;

  const modalBody = document.getElementById('promptModalBody');

  // Get prompt text
  const promptText = prompt.prompt_text || `Prompt ${promptNum}`;

  // Build model cards
  const models = data.model_rankings.map(m => m.model);
  const modelCards = models.map(model => {
    const scores = detailedScores[model]?.[promptNum];
    if (!scores) return '';

    const criteriaHtml = [
      { label: 'Prompt Adherence', value: scores.prompt_adherence, weight: '30%' },
      { label: 'Structural Correctness', value: scores.structural_correctness, weight: '20%' },
      { label: 'Physical Plausibility', value: scores.physical_plausibility, weight: '20%' },
      { label: 'Completeness', value: scores.completeness, weight: '15%' },
      { label: 'Visual Coherence', value: scores.visual_coherence, weight: '15%' }
    ].map(c => `
      <div class="mb-2">
        <div class="d-flex justify-content-between small">
          <span>${c.label} <span class="text-muted">(${c.weight})</span></span>
          <span class="fw-bold ${getScoreClass(c.value)}">${c.value}</span>
        </div>
        <div class="progress" style="height: 6px;">
          <div class="progress-bar ${c.value >= 75 ? 'bg-success' : c.value >= 50 ? 'bg-warning' : 'bg-danger'}" 
               style="width: ${c.value}%"></div>
        </div>
      </div>
    `).join('');

    const imageUrl = getImageUrl(model, promptNum);
    
    return `
      <div class="col-md-6 col-lg-4">
        <div class="card h-100 model-card">
          <div class="card-header d-flex justify-content-between align-items-center">
            <strong>${formatModelName(model)}</strong>
            <span class="badge ${scores.total_score >= 75 ? 'bg-success' : scores.total_score >= 50 ? 'bg-warning' : 'bg-danger'} fs-6">
              ${scores.total_score}
            </span>
          </div>
          <div class="card-body">
            <div class="mb-3 text-center">
              <a href="${imageUrl}" target="_blank" rel="noopener noreferrer" class="d-inline-block" title="View full size">
                <img src="${imageUrl}" 
                     alt="${formatModelName(model)} - Prompt ${promptNum}" 
                     class="img-fluid rounded border" 
                     style="max-height: 200px; width: auto; cursor: pointer; background: #f8f9fa;"
                     loading="lazy"
                     onerror="console.error('Failed to load image:', '${imageUrl}'); this.onerror=null; this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2Y4ZjlmYSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM2Yzc1N2QiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5JbWFnZSBub3QgYXZhaWxhYmxlPC90ZXh0Pjwvc3ZnPg==';">
              </a>
              <div class="small text-muted mt-1">
                <i class="bi bi-zoom-in me-1"></i>Click to view full size
              </div>
            </div>
            ${criteriaHtml}
          </div>
        </div>
      </div>
    `;
  }).filter(c => c).join('');

  modalBody.innerHTML = `
    <div class="alert alert-primary mb-4">
      <h6 class="alert-heading"><i class="bi bi-chat-quote me-2"></i>Original Prompt</h6>
      <p class="mb-0 fw-bold">"${promptText}"</p>
    </div>
    <div class="alert alert-light border mb-4">
      <small class="text-muted">
        <i class="bi bi-info-circle me-1"></i>
        Each model generated an SVG image for this prompt. The images were then scored by 7 vision AI judges 
        and their scores were averaged to produce the final scores below. Click on any image to view it in full size.
        <br>
        <i class="bi bi-exclamation-triangle me-1"></i>
        <strong>Note:</strong> If images don't load, check the browser console (F12) for errors. Images are loaded from: 
        <code>https://gally.net/temp/20251107pelican-alternatives/svgs/</code>
      </small>
    </div>
    <h6 class="mb-3"><i class="bi bi-grid-3x3-gap me-2"></i>Model Comparison (sorted by score)</h6>
    <div class="row g-3">
      ${modelCards}
    </div>
  `;

  const modal = new bootstrap.Modal(document.getElementById('promptModal'));
  modal.show();
}

// Helper function to get image URL
// Handles both prompt numbering formats: prompt01 and prompt1
function getImageUrl(modelName, promptNum) {
  const baseUrl = 'https://gally.net/temp/20251107pelican-alternatives/svgs/';
  
  // Models that use leading zero format (prompt01, prompt02, etc.)
  const leadingZeroModels = [
    'google_gemini-3.0-pro',
    'openai-gpt-5.1',
    'openai-gpt-5.2-pro'
  ];
  
  // Format prompt number based on model
  const promptStr = leadingZeroModels.includes(modelName) 
    ? `prompt${String(promptNum).padStart(2, '0')}`  // prompt01, prompt02, etc.
    : `prompt${promptNum}`;  // prompt1, prompt2, etc.
  
  const url = `${baseUrl}${modelName}_${promptStr}.svg`;
  
  // Debug logging (can be removed in production)
  if (window.DEBUG_IMAGES) {
    console.log(`Image URL for ${modelName} prompt ${promptNum}:`, url);
  }
  
  return url;
}

// Render key findings from GPT analysis
function renderKeyFindings(insights) {
  if (!insights || !insights.key_findings) return;
  
  const list = document.getElementById('key-findings-list');
  list.innerHTML = insights.key_findings.map(finding => 
    `<li class="mb-2">${finding}</li>`
  ).join('');
}

// Render prompt breakdowns
function renderPromptBreakdowns(insights) {
  if (!insights || !insights.prompt_breakdowns) return;
  
  const container = document.getElementById('prompt-breakdowns-container');
  container.innerHTML = insights.prompt_breakdowns.map(p => {
    const winnerImageUrl = getImageUrl(p.winner, p.prompt_num);
    const loserImageUrl = getImageUrl(p.loser, p.prompt_num);
    
    return `
    <div class="col-md-6 col-lg-4">
      <div class="card h-100">
        <div class="card-header">
          <strong>Prompt ${p.prompt_num}</strong>
        </div>
        <div class="card-body">
          <p class="small text-muted fst-italic mb-2">"${p.prompt_text}"</p>
          
          <div class="row g-2 mb-2">
            <div class="col-6">
              <div class="text-center">
                <a href="${winnerImageUrl}" target="_blank" rel="noopener noreferrer" class="d-inline-block" title="View full size">
                  <img src="${winnerImageUrl}" 
                       alt="Winner: ${formatModelName(p.winner)}" 
                       class="img-fluid rounded border" 
                       style="max-height: 120px; width: auto; cursor: pointer; background: #f8f9fa;"
                       loading="lazy"
                       onerror="console.error('Failed to load winner image:', '${winnerImageUrl}'); this.onerror=null; this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjEyMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTIwIiBoZWlnaHQ9IjEyMCIgZmlsbD0iI2Y4ZjlmYSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTIiIGZpbGw9IiM2Yzc1N2QiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5Ob3QgYXZhaWxhYmxlPC90ZXh0Pjwvc3ZnPg==';">
                </a>
                <div class="small text-success mt-1">
                  <i class="bi bi-trophy me-1"></i>Winner
                </div>
              </div>
            </div>
            <div class="col-6">
              <div class="text-center">
                <a href="${loserImageUrl}" target="_blank" rel="noopener noreferrer" class="d-inline-block" title="View full size">
                  <img src="${loserImageUrl}" 
                       alt="Loser: ${formatModelName(p.loser)}" 
                       class="img-fluid rounded border" 
                       style="max-height: 120px; width: auto; cursor: pointer; background: #f8f9fa;"
                       loading="lazy"
                       onerror="console.error('Failed to load loser image:', '${loserImageUrl}'); this.onerror=null; this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjEyMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTIwIiBoZWlnaHQ9IjEyMCIgZmlsbD0iI2Y4ZjlmYSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTIiIGZpbGw9IiM2Yzc1N2QiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5Ob3QgYXZhaWxhYmxlPC90ZXh0Pjwvc3ZnPg==';">
                </a>
                <div class="small text-danger mt-1">
                  <i class="bi bi-arrow-down me-1"></i>Lowest
                </div>
              </div>
            </div>
          </div>
          
          <p class="small mb-2">${p.analysis}</p>
          <div class="d-flex justify-content-between small mb-2">
            <span class="text-success"><strong>${formatModelName(p.winner).split(' ').slice(0, 2).join(' ')}</strong></span>
            <span class="text-danger"><strong>${formatModelName(p.loser).split(' ').slice(0, 2).join(' ')}</strong></span>
          </div>
          <div class="mt-2 p-2 bg-body-secondary rounded small">
            <i class="bi bi-lightbulb text-warning me-1"></i>
            <strong>Key:</strong> ${p.key_observation}
          </div>
        </div>
      </div>
    </div>
  `;
  }).join('');
}

// Render prompts list
function renderPromptsList(data) {
  const container = document.getElementById('prompts-list-container');
  const prompts = data.prompt_model_scores;

  container.innerHTML = prompts.map(p => `
    <div class="col-md-6 mb-2">
      <div class="d-flex align-items-start">
        <span class="badge bg-secondary me-2">${p.prompt}</span>
        <small class="text-muted">${p.prompt_text}</small>
      </div>
    </div>
  `).join('');
}

// Evaluation prompt template (matches evaluate.js)
function getEvaluationPromptTemplate() {
  return `You are evaluating an image generated from an SVG.

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
}`;
}

// Render prompts in modal
function renderPromptsModal(data) {
  const container = document.getElementById('prompts-modal-container');
  const countElement = document.getElementById('prompts-count');
  const evalPromptElement = document.getElementById('evaluation-prompt-text');
  const prompts = data.prompt_model_scores;

  if (countElement) {
    countElement.textContent = prompts.length;
  }

  // Display evaluation prompt template
  if (evalPromptElement) {
    evalPromptElement.textContent = getEvaluationPromptTemplate();
  }

  container.innerHTML = prompts.map(p => `
    <div class="card mb-2 border">
      <div class="card-body py-3">
        <div class="d-flex align-items-start">
          <span class="badge bg-primary me-3 flex-shrink-0 d-flex align-items-center justify-content-center" 
                style="font-size: 0.9rem; padding: 0.4rem 0.6rem; min-width: 45px; height: 32px;">
            ${p.prompt}
          </span>
          <p class="mb-0 fw-medium" style="line-height: 1.6;">${p.prompt_text}</p>
        </div>
      </div>
    </div>
  `).join('');
}

// Initialize
let benchmarkData = null;

async function init() {
  try {
    benchmarkData = await loadBenchmarkData();
    const insights = await loadInsightsData();
    
    renderSummaryTable(benchmarkData);
    renderKeyFindings(insights);
    renderPromptBreakdowns(insights);
    renderInsights(benchmarkData);
    renderPromptsTable(benchmarkData);
    
    // Set up modal event listener
    const promptsModal = document.getElementById('promptsModal');
    if (promptsModal) {
      promptsModal.addEventListener('show.bs.modal', () => {
        if (benchmarkData) {
          renderPromptsModal(benchmarkData);
        }
      });
    }
  } catch (error) {
    console.error('Failed to load benchmark data:', error);
    document.getElementById('summary-body').innerHTML = `
      <tr><td colspan="8" class="text-center text-danger">
        <i class="bi bi-exclamation-triangle me-2"></i>Failed to load benchmark data
      </td></tr>
    `;
  }
}

init();

