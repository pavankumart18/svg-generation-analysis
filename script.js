// SVG Generation Benchmark UI Script

// Sorting state
let summarySortState = { column: null, direction: 'asc' };
let promptsSortState = { column: null, direction: 'asc' };

// Model filter state
let selectedModels = new Set();
let allModels = [];

// Judge filter state
let selectedJudges = new Set();
let allJudges = [];
let evaluationsByPrompt = null;

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

// Load evaluations by prompt data
async function loadEvaluationsByPrompt() {
  try {
    const response = await fetch('evaluations_by_prompt.json');
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

// Format judge name for display
function formatJudgeName(judgeId) {
  const names = {
    'qwen-vl-72b': 'Qwen 2.5 VL 72B',
    'gemma-27b': 'Google Gemma 3 27B',
    'molmo-8b': 'Allen AI Molmo 8B',
    'gemini-flash-lite': 'Gemini Flash Lite',
    'gemini-flash-lite-preview': 'Gemini Flash Lite Preview',
    'gemini-3-flash': 'Gemini 3 Flash',
    'gemini-flash-image': 'Gemini Flash Image'
  };
  return names[judgeId] || formatModelName(judgeId);
}

// Recalculate aggregated scores based on selected judges
function recalculateAggregatedScores(data, evaluationsData) {
  if (!evaluationsData || selectedJudges.size === 0) {
    return data; // Return original if no evaluations data or no judges selected
  }
  
  const svgModels = data.model_rankings.map(m => m.model);
  const prompts = Object.keys(evaluationsData).filter(k => k.startsWith('prompt'));
  
  // Calculate new aggregated scores
  const newModelRankings = svgModels.map(model => {
    const scores = {
      prompt_adherence: [],
      structural_correctness: [],
      physical_plausibility: [],
      completeness: [],
      visual_coherence: [],
      total_score: []
    };
    
    prompts.forEach(promptKey => {
      const promptData = evaluationsData[promptKey];
      const modelData = promptData?.svg_models?.[model];
      
      if (modelData && modelData.judges) {
        // Get scores from selected judges only
        Object.keys(modelData.judges).forEach(judgeId => {
          if (selectedJudges.has(judgeId)) {
            const judgeScore = modelData.judges[judgeId];
            scores.prompt_adherence.push(judgeScore.prompt_adherence);
            scores.structural_correctness.push(judgeScore.structural_correctness);
            scores.physical_plausibility.push(judgeScore.physical_plausibility);
            scores.completeness.push(judgeScore.completeness);
            scores.visual_coherence.push(judgeScore.visual_coherence);
            scores.total_score.push(judgeScore.total_score);
          }
        });
      }
    });
    
    // Calculate averages
    const avg = (arr) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    
    return {
      model: model,
      avg_total_score: avg(scores.total_score),
      avg_prompt_adherence: avg(scores.prompt_adherence),
      avg_structural_correctness: avg(scores.structural_correctness),
      avg_physical_plausibility: avg(scores.physical_plausibility),
      avg_completeness: avg(scores.completeness),
      avg_visual_coherence: avg(scores.visual_coherence),
      prompts_evaluated: data.model_rankings.find(m => m.model === model)?.prompts_evaluated || 0,
      rank: 0 // Will be recalculated
    };
  });
  
  // Sort by avg_total_score and assign ranks
  newModelRankings.sort((a, b) => b.avg_total_score - a.avg_total_score);
  newModelRankings.forEach((model, idx) => {
    model.rank = idx + 1;
  });
  
  // Recalculate prompt_model_scores
  const newPromptModelScores = prompts.map(promptKey => {
    const promptNum = parseInt(promptKey.replace('prompt', ''));
    const promptData = evaluationsData[promptKey];
    const result = {
      prompt: promptNum,
      prompt_text: promptData.prompt_text
    };
    
    svgModels.forEach(model => {
      const modelData = promptData?.svg_models?.[model];
      if (modelData && modelData.judges) {
        const judgeScores = Object.keys(modelData.judges)
          .filter(judgeId => selectedJudges.has(judgeId))
          .map(judgeId => modelData.judges[judgeId].total_score);
        
        if (judgeScores.length > 0) {
          result[model] = judgeScores.reduce((a, b) => a + b, 0) / judgeScores.length;
        }
      }
    });
    
    return result;
  });
  
  // Recalculate detailed_aggregated_scores for modal
  const newDetailedScores = {};
  svgModels.forEach(model => {
    newDetailedScores[model] = {};
    prompts.forEach(promptKey => {
      const promptNum = promptKey.replace('prompt', '');
      const promptData = evaluationsData[promptKey];
      const modelData = promptData?.svg_models?.[model];
      
      if (modelData && modelData.judges) {
        const selectedJudgeScores = Object.keys(modelData.judges)
          .filter(judgeId => selectedJudges.has(judgeId))
          .map(judgeId => modelData.judges[judgeId]);
        
        if (selectedJudgeScores.length > 0) {
          const avg = (field) => {
            const values = selectedJudgeScores.map(s => s[field]).filter(v => v != null);
            return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
          };
          
          newDetailedScores[model][promptNum] = {
            prompt_adherence: avg('prompt_adherence'),
            structural_correctness: avg('structural_correctness'),
            physical_plausibility: avg('physical_plausibility'),
            completeness: avg('completeness'),
            visual_coherence: avg('visual_coherence'),
            total_score: avg('total_score'),
            judge_count: selectedJudgeScores.length
          };
        }
      }
    });
  });
  
  return {
    ...data,
    model_rankings: newModelRankings,
    prompt_model_scores: newPromptModelScores,
    detailed_aggregated_scores: newDetailedScores
  };
}

// Sort summary table
function sortSummaryTable(data, column, direction) {
  const rankings = [...data.model_rankings];
  
  rankings.sort((a, b) => {
    let aVal, bVal;
    
    if (column === 'rank') {
      aVal = a.rank;
      bVal = b.rank;
    } else if (column === 'model') {
      aVal = formatModelName(a.model).toLowerCase();
      bVal = formatModelName(b.model).toLowerCase();
    } else {
      aVal = a[column] || 0;
      bVal = b[column] || 0;
    }
    
    if (aVal < bVal) return direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return direction === 'asc' ? 1 : -1;
    return 0;
  });
  
  return rankings;
}

// Sort prompts table
function sortPromptsTable(data, column, direction) {
  const prompts = [...data.prompt_model_scores];
  const models = data.model_rankings.map(m => m.model);
  
  if (column === 'prompt') {
    prompts.sort((a, b) => {
      return direction === 'asc' ? a.prompt - b.prompt : b.prompt - a.prompt;
    });
  } else {
    // Sort by model score
    const modelIndex = models.indexOf(column);
    if (modelIndex !== -1) {
      prompts.sort((a, b) => {
        const aVal = a[column] || 0;
        const bVal = b[column] || 0;
        return direction === 'asc' ? aVal - bVal : bVal - aVal;
      });
    }
  }
  
  return prompts;
}

// Update filter button badge
function updateFilterButton() {
  const button = document.querySelector('[data-bs-toggle="dropdown"]');
  if (button) {
    const count = selectedModels.size;
    const total = allModels.length;
    const badge = button.querySelector('.badge') || document.createElement('span');
    if (!button.querySelector('.badge')) {
      badge.className = 'badge bg-primary ms-2';
      button.appendChild(badge);
    }
    badge.textContent = `${count}/${total}`;
    if (count === 0) {
      badge.className = 'badge bg-danger ms-2';
    } else if (count === total) {
      badge.className = 'badge bg-success ms-2';
    } else {
      badge.className = 'badge bg-primary ms-2';
    }
  }
}

// Initialize models (filter UI removed, but we still need to track models)
function renderModelFilter(data) {
  allModels = data.model_rankings.map(m => m.model);
  
  // Always initialize all models as selected (no filter UI, so show all)
  selectedModels.clear();
  allModels.forEach(model => selectedModels.add(model));
}

// Render judge filter
function renderJudgeFilter(data) {
  const judgesList = document.getElementById('judges-list');
  if (!judgesList) return;
  
  // Get judges from metadata or default list
  allJudges = data.metadata?.judges_used || [
    'qwen-vl-72b',
    'gemma-27b',
    'molmo-8b',
    'gemini-flash-lite',
    'gemini-flash-lite-preview',
    'gemini-3-flash',
    'gemini-flash-image'
  ];
  
  // Initialize all judges as selected if not already set
  if (selectedJudges.size === 0) {
    allJudges.forEach(judge => selectedJudges.add(judge));
  }
  
  // Render judges list with checkboxes
  judgesList.innerHTML = allJudges.map(judge => `
    <div class="form-check mb-2">
      <input class="form-check-input" type="checkbox" value="${judge}" id="judge-list-${judge}" 
             ${selectedJudges.has(judge) ? 'checked' : ''}>
      <label class="form-check-label small" for="judge-list-${judge}">
        ${formatJudgeName(judge)}
      </label>
    </div>
  `).join('');
  
  // Add event listeners to list checkboxes
  allJudges.forEach(judge => {
    const checkbox = document.getElementById(`judge-list-${judge}`);
    if (checkbox) {
      checkbox.addEventListener('change', (e) => {
        if (e.target.checked) {
          selectedJudges.add(judge);
        } else {
          selectedJudges.delete(judge);
        }
        updateJudgeFilterButton();
        // Recalculate and re-render
        if (benchmarkData && evaluationsByPrompt && selectedJudges.size > 0) {
          const recalculated = recalculateAggregatedScores(benchmarkData, evaluationsByPrompt);
          renderSummaryTable(recalculated);
          renderPromptsTable(recalculated);
          renderInsights(recalculated);
        } else if (benchmarkData) {
          renderSummaryTable(benchmarkData);
          renderPromptsTable(benchmarkData);
          renderInsights(benchmarkData);
        }
      });
    }
  });
  
  updateJudgeFilterButton();
}

// Update judge count text
function updateJudgeFilterButton() {
  const countText = document.getElementById('judge-count-text');
  if (countText) {
    countText.textContent = selectedJudges.size;
  }
}

// Update judges list display (sync checkboxes)
function updateJudgesList() {
  allJudges.forEach(judge => {
    const checkbox = document.getElementById(`judge-list-${judge}`);
    if (checkbox) {
      checkbox.checked = selectedJudges.has(judge);
    }
  });
}

// Render summary table
function renderSummaryTable(data) {
  const tbody = document.getElementById('summary-body');
  tbody.innerHTML = '';

  // Filter by selected models
  let filteredRankings = data.model_rankings.filter(m => selectedModels.has(m.model));
  
  // Show message if no models selected
  if (filteredRankings.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center text-muted py-4">
          <i class="bi bi-funnel me-2"></i>No models selected. Use the filter dropdown to select models.
        </td>
      </tr>
    `;
    return;
  }
  
  // Find best and worst values for each column (using filtered rankings, before sorting)
  const scoreFields = ['avg_total_score', 'avg_prompt_adherence', 'avg_structural_correctness', 
                       'avg_physical_plausibility', 'avg_completeness', 'avg_visual_coherence'];
  
  const bestWorst = {};
  scoreFields.forEach(field => {
    const values = filteredRankings.map(m => m[field]).filter(v => v != null);
    if (values.length > 0) {
      bestWorst[field] = {
        best: Math.max(...values),
        worst: Math.min(...values)
      };
    }
  });
  
  // Use sorted data if sort is active (after calculating best/worst)
  const rankings = summarySortState.column 
    ? sortSummaryTable({ model_rankings: filteredRankings }, summarySortState.column, summarySortState.direction)
    : filteredRankings;

  rankings.forEach((model, idx) => {
    const rankClass = idx < 3 ? `rank-${idx + 1}` : '';
    const rankIcon = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : (idx + 1);

    const getCellClass = (field, value) => {
      if (value == null) return 'score-cell';
      const bw = bestWorst[field];
      if (!bw) return `score-cell ${getScoreClass(value)}`;
      
      let classes = `score-cell ${getScoreClass(value)}`;
      if (value === bw.best) classes += ' score-best';
      if (value === bw.worst) classes += ' score-worst';
      return classes;
    };

    const row = document.createElement('tr');
    row.className = rankClass;
    row.innerHTML = `
      <td class="fw-bold">${rankIcon}</td>
      <td><strong>${formatModelName(model.model)}</strong></td>
      <td class="${getCellClass('avg_total_score', model.avg_total_score)}">${(model.avg_total_score || 0).toFixed(1)}</td>
      <td class="${getCellClass('avg_prompt_adherence', model.avg_prompt_adherence)}">${(model.avg_prompt_adherence || 0).toFixed(1)}</td>
      <td class="${getCellClass('avg_structural_correctness', model.avg_structural_correctness)}">${(model.avg_structural_correctness || 0).toFixed(1)}</td>
      <td class="${getCellClass('avg_physical_plausibility', model.avg_physical_plausibility)}">${(model.avg_physical_plausibility || 0).toFixed(1)}</td>
      <td class="${getCellClass('avg_completeness', model.avg_completeness)}">${(model.avg_completeness || 0).toFixed(1)}</td>
      <td class="${getCellClass('avg_visual_coherence', model.avg_visual_coherence)}">${(model.avg_visual_coherence || 0).toFixed(1)}</td>
    `;
    tbody.appendChild(row);
  });
  
  // Add sort handlers to headers (only on first render)
  if (!document.getElementById('summary-table').hasAttribute('data-sort-initialized')) {
    document.getElementById('summary-table').setAttribute('data-sort-initialized', 'true');
    const headers = document.querySelectorAll('#summary-table thead th.sortable-header');
    headers.forEach(header => {
      header.addEventListener('click', () => {
        const column = header.getAttribute('data-sort');
        if (summarySortState.column === column) {
          summarySortState.direction = summarySortState.direction === 'asc' ? 'desc' : 'asc';
        } else {
          summarySortState.column = column;
          summarySortState.direction = 'asc';
        }
        
        // Update header classes
        headers.forEach(h => {
          h.classList.remove('sort-asc', 'sort-desc');
          if (h.getAttribute('data-sort') === summarySortState.column) {
            h.classList.add(summarySortState.direction === 'asc' ? 'sort-asc' : 'sort-desc');
          }
        });
        
        // Re-render table
        renderSummaryTable(data);
      });
    });
  }
  
  // Set sort indicator
  const headers = document.querySelectorAll('#summary-table thead th.sortable-header');
  headers.forEach(h => {
    h.classList.remove('sort-asc', 'sort-desc');
    if (h.getAttribute('data-sort') === summarySortState.column) {
      h.classList.add(summarySortState.direction === 'asc' ? 'sort-asc' : 'sort-desc');
    }
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
      text: `<strong>${formatModelName(top.model)}</strong> leads with an average score of <strong>${(top.avg_total_score || 0).toFixed(1)}</strong>, excelling in prompt adherence (${(top.avg_prompt_adherence || 0).toFixed(1)}) and completeness (${(top.avg_completeness || 0).toFixed(1)}).`
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
      text: `<strong>${formatModelName(bottom.model)}</strong> scored lowest at <strong>${(bottom.avg_total_score || 0).toFixed(1)}</strong>, struggling particularly with physics (${(bottom.avg_physical_plausibility || 0).toFixed(1)}) and structure (${(bottom.avg_structural_correctness || 0).toFixed(1)}).`
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
  
  // Use sorted data if sort is active
  const prompts = promptsSortState.column
    ? sortPromptsTable(data, promptsSortState.column, promptsSortState.direction)
    : data.prompt_model_scores;

  // Header
  const header = document.getElementById('prompts-header');
  header.innerHTML = `<th class="sortable-header" data-sort="prompt">Prompt</th>` + models.map(m => `<th class="sortable-header text-center small" data-sort="${m}">${formatModelName(m).split(' ')[0]}</th>`).join('');

  // Body
  const tbody = document.getElementById('prompts-body');
  tbody.innerHTML = '';

  prompts.forEach(prompt => {
    // Find best and worst scores for this prompt
    const scores = models.map(m => prompt[m]).filter(s => s != null);
    const bestScore = scores.length > 0 ? Math.max(...scores) : null;
    const worstScore = scores.length > 0 ? Math.min(...scores) : null;
    
    const row = document.createElement('tr');
    row.className = 'clickable-row';
    row.setAttribute('data-prompt', prompt.prompt);
    row.innerHTML = `
      <td><strong>Prompt ${prompt.prompt}</strong></td>
      ${models.map(m => {
        const score = prompt[m];
        if (score == null) return '<td class="text-center text-muted">-</td>';
        
        let classes = `score-cell ${getScoreClass(score)}`;
        if (score === bestScore) classes += ' score-best';
        if (score === worstScore) classes += ' score-worst';
        
        return `<td class="text-center ${classes}">${score.toFixed(1)}</td>`;
      }).join('')}
    `;
    row.addEventListener('click', () => showPromptDetail(data, prompt.prompt));
    tbody.appendChild(row);
  });
  
  // Add sort handlers to headers (only on first render)
  if (!document.getElementById('prompts-table').hasAttribute('data-sort-initialized')) {
    document.getElementById('prompts-table').setAttribute('data-sort-initialized', 'true');
    const headers = document.querySelectorAll('#prompts-table thead th.sortable-header');
    headers.forEach(header => {
      header.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent row click
        const column = header.getAttribute('data-sort');
        if (promptsSortState.column === column) {
          promptsSortState.direction = promptsSortState.direction === 'asc' ? 'desc' : 'asc';
        } else {
          promptsSortState.column = column;
          promptsSortState.direction = 'asc';
        }
        
        // Update header classes
        headers.forEach(h => {
          h.classList.remove('sort-asc', 'sort-desc');
          if (h.getAttribute('data-sort') === promptsSortState.column) {
            h.classList.add(promptsSortState.direction === 'asc' ? 'sort-asc' : 'sort-desc');
          }
        });
        
        // Re-render table
        renderPromptsTable(data);
      });
    });
  }
  
  // Set sort indicator
  const headers = document.querySelectorAll('#prompts-table thead th.sortable-header');
  headers.forEach(h => {
    h.classList.remove('sort-asc', 'sort-desc');
    if (h.getAttribute('data-sort') === promptsSortState.column) {
      h.classList.add(promptsSortState.direction === 'asc' ? 'sort-asc' : 'sort-desc');
    }
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
        <div class="d-flex justify-content-between align-items-center small mb-1">
          <span>${c.label} <span class="text-muted">(${c.weight})</span></span>
          <span class="score-cell ${getScoreClass(c.value)}" style="padding: 0.25rem 0.5rem; font-size: 0.85rem;">${(c.value || 0).toFixed(1)}</span>
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
              ${(scores.total_score || 0).toFixed(1)}
            </span>
          </div>
          <div class="card-body">
            <div class="mb-3 text-center">
              <div class="position-relative d-inline-block" id="img-container-${model}-${promptNum}">
                <div class="image-loading" id="loading-${model}-${promptNum}" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 10; pointer-events: none;"></div>
                <a href="${imageUrl}" target="_blank" rel="noopener noreferrer" class="d-inline-block" title="View full size">
                  <img src="${imageUrl}" 
                       alt="${formatModelName(model)} - Prompt ${promptNum}" 
                       class="img-fluid rounded border" 
                       style="max-height: 200px; width: auto; cursor: pointer; background: #f8f9fa; position: relative; display: block;"
                       loading="lazy"
                       onload="const loader = document.getElementById('loading-${model}-${promptNum}'); if(loader) loader.style.display='none';"
                       onerror="const loader = document.getElementById('loading-${model}-${promptNum}'); if(loader) loader.style.display='none'; console.error('Failed to load image:', '${imageUrl}'); this.onerror=null; this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2Y4ZjlmYSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM2Yzc1N2QiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5JbWFnZSBub3QgYXZhaWxhYmxlPC90ZXh0Pjwvc3ZnPg==';">
                </a>
              </div>
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

  // Hide loading indicators for images that are already loaded (cached images)
  setTimeout(() => {
    models.forEach(model => {
      const loaderId = `loading-${model}-${promptNum}`;
      const loader = document.getElementById(loaderId);
      if (loader) {
        const img = loader.parentElement.querySelector('img');
        if (img && img.complete && img.naturalHeight !== 0) {
          loader.style.display = 'none';
        }
      }
    });
  }, 200);

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
                <div class="position-relative d-inline-block" id="img-winner-${p.prompt_num}">
                  <div class="image-loading" id="loading-winner-${p.prompt_num}" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 10; pointer-events: none;"></div>
                  <a href="${winnerImageUrl}" target="_blank" rel="noopener noreferrer" class="d-inline-block" title="View full size">
                    <img src="${winnerImageUrl}" 
                         alt="Winner: ${formatModelName(p.winner)}" 
                         class="img-fluid rounded border" 
                         style="max-height: 120px; width: auto; cursor: pointer; background: #f8f9fa; position: relative; display: block;"
                         loading="lazy"
                         onload="const loader = document.getElementById('loading-winner-${p.prompt_num}'); if(loader) loader.style.display='none';"
                         onerror="const loader = document.getElementById('loading-winner-${p.prompt_num}'); if(loader) loader.style.display='none'; console.error('Failed to load winner image:', '${winnerImageUrl}'); this.onerror=null; this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjEyMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTIwIiBoZWlnaHQ9IjEyMCIgZmlsbD0iI2Y4ZjlmYSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTIiIGZpbGw9IiM2Yzc1N2QiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5Ob3QgYXZhaWxhYmxlPC90ZXh0Pjwvc3ZnPg==';">
                    </a>
                </div>
                <div class="small text-success mt-1">
                  <i class="bi bi-trophy me-1"></i>Winner
                </div>
              </div>
            </div>
            <div class="col-6">
              <div class="text-center">
                <div class="position-relative d-inline-block" id="img-loser-${p.prompt_num}">
                  <div class="image-loading" id="loading-loser-${p.prompt_num}" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 10; pointer-events: none;"></div>
                  <a href="${loserImageUrl}" target="_blank" rel="noopener noreferrer" class="d-inline-block" title="View full size">
                    <img src="${loserImageUrl}" 
                         alt="Loser: ${formatModelName(p.loser)}" 
                         class="img-fluid rounded border" 
                         style="max-height: 120px; width: auto; cursor: pointer; background: #f8f9fa; position: relative; display: block;"
                         loading="lazy"
                         onload="const loader = document.getElementById('loading-loser-${p.prompt_num}'); if(loader) loader.style.display='none';"
                         onerror="const loader = document.getElementById('loading-loser-${p.prompt_num}'); if(loader) loader.style.display='none'; console.error('Failed to load loser image:', '${loserImageUrl}'); this.onerror=null; this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjEyMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTIwIiBoZWlnaHQ9IjEyMCIgZmlsbD0iI2Y4ZjlmYSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTIiIGZpbGw9IiM2Yzc1N2QiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5Ob3QgYXZhaWxhYmxlPC90ZXh0Pjwvc3ZnPg==';">
                    </a>
                </div>
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
    evaluationsByPrompt = await loadEvaluationsByPrompt();
    const insights = await loadInsightsData();
    
    renderJudgeFilter(benchmarkData);
    renderModelFilter(benchmarkData);
    
    // Use recalculated data if judges are filtered
    const displayData = (selectedJudges.size > 0 && selectedJudges.size < allJudges.length && evaluationsByPrompt)
      ? recalculateAggregatedScores(benchmarkData, evaluationsByPrompt)
      : benchmarkData;
    
    renderSummaryTable(displayData);
    renderKeyFindings(insights);
    renderPromptBreakdowns(insights);
    renderInsights(displayData);
    renderPromptsTable(displayData);
    
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

