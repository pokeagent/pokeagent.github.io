/**
 * Battling Leaderboard Module
 * Handles Track 1 competitive battling leaderboard functionality
 */

import HeadToHeadMatrix from './headToHeadMatrix.js';
import { API_CONFIG } from '../config.js';

class BattlingLeaderboard {
  constructor() {
    this.data = {};
    this.currentSortBy = 'elo';
    this.hideBaselines = true;
    this.showLLMOnly = false;
    this.h2hMatrix = new HeadToHeadMatrix();
    this.showH2HMatrix = false;
    this.usingLiveData = false; // Track which data source we're using
    this.elements = {
      gen1Table: document.getElementById('gen1ou-leaderboard'),
      gen9Table: document.getElementById('gen9ou-leaderboard'),
      sortSelect: document.getElementById('sort-select'),
      hideBaselinesCheckbox: document.getElementById('hide-baselines'),
      showLLMCheckbox: document.getElementById('show-llm-only'),
      baselineExplanation: document.getElementById('baseline-explanation'),
      gen1ouLastUpdated: document.getElementById('gen1ou-last-updated'),
      gen9ouLastUpdated: document.getElementById('gen9ou-last-updated'),
      gen1ouHRMinGames: document.getElementById('gen1ou-hr-min-games'),
      gen9ouHRMinGames: document.getElementById('gen9ou-hr-min-games'),
      h2hContainer: document.getElementById('h2h-matrix-container'),
      h2hToggleBtn: document.getElementById('h2h-toggle-btn')
    };
  }

  async init() {
    await this.loadData();
    await this.h2hMatrix.init('#h2h-matrix-content');
    this.bindEvents();
    this.render();
  }

  /**
   * Load leaderboard data from live API or static JSON fallback
   */
  async loadData() {
    // Try live API first if enabled
    if (API_CONFIG.USE_LIVE_DATA) {
      try {
        await this.loadLiveData();
        return;
      } catch (error) {
        console.warn('[Leaderboard] Failed to load live data, falling back to static JSON:', error);
        // Fall through to static JSON
      }
    }
    
    // Fallback to static JSON
    await this.loadStaticData();
  }

  /**
   * Fetch data from live API
   */
  async loadLiveData() {
    const url = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.LEADERBOARD}`;
    console.log('[Leaderboard] Fetching live data from:', url);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT_MS);
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`API responded with status ${response.status}: ${response.statusText}`);
      }
      
      this.data = await response.json();
      this.usingLiveData = true;
      console.log('[Leaderboard] ✓ Successfully loaded live data');
      
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('API request timed out');
      }
      throw error;
    }
  }

  /**
   * Fetch data from static JSON (fallback)
   */
  async loadStaticData() {
    console.log('[Leaderboard] Loading static JSON fallback');
    try {
      const response = await fetch(`${API_CONFIG.FALLBACK.LEADERBOARD_JSON}?t=${Date.now()}`);
      if (!response.ok) throw new Error('Failed to load static leaderboard data');
      this.data = await response.json();
      this.usingLiveData = false;
      console.log('[Leaderboard] ✓ Loaded static JSON');
    } catch (error) {
      console.error('[Leaderboard] Error loading static data:', error);
      this.showError();
      throw error;
    }
  }

  bindEvents() {
    if (this.elements.sortSelect) {
      this.elements.sortSelect.addEventListener('change', () => {
        this.currentSortBy = this.elements.sortSelect.value;
        this.render();
      });
    }

    if (this.elements.hideBaselinesCheckbox) {
      this.elements.hideBaselinesCheckbox.addEventListener('change', () => {
        this.toggleBaselines();
      });
    }

    if (this.elements.showLLMCheckbox) {
      this.elements.showLLMCheckbox.addEventListener('change', () => {
        this.toggleLLMOnly();
      });
    }

    if (this.elements.h2hToggleBtn) {
      this.elements.h2hToggleBtn.addEventListener('click', () => {
        this.toggleH2HMatrix();
      });
    }
  }

  toggleBaselines() {
    this.hideBaselines = this.elements.hideBaselinesCheckbox.checked;
    
    if (this.hideBaselines && this.showLLMOnly) {
      this.elements.showLLMCheckbox.checked = false;
      this.showLLMOnly = false;
    }
    
    this.elements.showLLMCheckbox.disabled = this.hideBaselines;
    this.elements.baselineExplanation.style.display = this.hideBaselines ? 'none' : 'block';
    
    this.render();
  }

  toggleLLMOnly() {
    this.showLLMOnly = this.elements.showLLMCheckbox.checked;
    
    if (this.showLLMOnly && this.hideBaselines) {
      this.elements.hideBaselinesCheckbox.checked = false;
      this.hideBaselines = false;
      this.elements.baselineExplanation.style.display = 'block';
    }
    
    this.render();
  }

  render() {
    this.renderFormatLeaderboard('gen1ou', this.elements.gen1Table);
    this.renderFormatLeaderboard('gen9ou', this.elements.gen9Table);
    
    // Update per-format timestamps and HR info
    this.updateFormatInfo('gen1ou');
    this.updateFormatInfo('gen9ou');

    // Update H2H matrix visibility
    if (this.elements.h2hContainer) {
      this.elements.h2hContainer.style.display = this.showH2HMatrix ? 'block' : 'none';
    }
  }

  extractHRMinGames(format) {
    // Extract HR min_games_threshold from the data for a specific format
    const players = this.data.formats?.[format] || [];
    
    for (const player of players) {
      if (player.whr && player.whr.min_games_threshold !== undefined) {
        return player.whr.min_games_threshold;
      }
    }
    
    return null;
  }

  updateFormatInfo(format) {
    const formatKey = format === 'gen1ou' ? 'gen1ou' : 'gen9ou';
    const lastUpdatedElement = this.elements[`${formatKey}LastUpdated`];
    const hrMinGamesElement = this.elements[`${formatKey}HRMinGames`];
    
    // Update last updated timestamp
    if (lastUpdatedElement) {
      let timestamp;
      
      // Check for per-format timestamp first, then fall back to global
      if (this.data.format_timestamps && this.data.format_timestamps[format]) {
        timestamp = this.data.format_timestamps[format];
      } else if (this.data.last_updated) {
        timestamp = this.data.last_updated;
      }
      
      // Hardcoded fallback for gen1ou until we have per-format timestamps in the data
      if (format === 'gen1ou' && !this.data.format_timestamps?.[format]) {
        // Backfill: gen1ou was last updated 10/19/2025, 11:00:53 PM CT
        // Convert to ISO format: CT is UTC-5, so 11:00:53 PM CT = 4:00:53 AM UTC next day
        timestamp = '2025-10-20T04:00:53+00:00';
      }
      
      if (timestamp) {
        const lastUpdated = new Date(timestamp).toLocaleString('en-US', {
          timeZone: 'America/Chicago',
          year: 'numeric',
          month: 'numeric', 
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        });
        lastUpdatedElement.textContent = `Last updated: ${lastUpdated} CT`;
      }
    }
    
    // Update HR min games requirement
    if (hrMinGamesElement) {
      const minGames = this.extractHRMinGames(format);
      if (minGames !== null) {
        hrMinGamesElement.textContent = `HR requires ${minGames}+ games`;
      } else {
        hrMinGamesElement.textContent = '';
      }
    }
  }

  computeQualBadges(players) {
    // Compute QUAL badges: top 2 by ELO + top 6 by HR (excluding those top 2)
    // Returns a Map with username -> {isQual: boolean, hasAsterisk: boolean}
    
    const qualMap = new Map();
    
    // Filter to non-organizer players only
    const nonOrgPlayers = players.filter(player => {
      const username = player.username.original || player.username.display;
      return !player.username.is_starter_kit && !username.startsWith('PAC-LLM-');
    });
    
    if (nonOrgPlayers.length === 0) {
      return qualMap;
    }
    
    // Sort by ELO (descending) and take top 2
    const sortedByELO = [...nonOrgPlayers].sort((a, b) => {
      const aELO = parseFloat(a.elo) || 0;
      const bELO = parseFloat(b.elo) || 0;
      return bELO - aELO;
    });
    
    const top2ELO = sortedByELO.slice(0, 2);
    const top2ELOUsernames = new Set(top2ELO.map(p => p.username.original || p.username.display));
    
    // Add top 2 ELO players to QUAL
    top2ELO.forEach(player => {
      const username = player.username.original || player.username.display;
      qualMap.set(username, {isQual: true, hasAsterisk: false});
    });
    
    // Filter to players with HR data, excluding the top 2 ELO players
    const remainingPlayers = nonOrgPlayers.filter(p => {
      const username = p.username.original || p.username.display;
      return !top2ELOUsernames.has(username) && p.whr && p.whr.whr_elo;
    });
    
    if (remainingPlayers.length === 0) {
      return qualMap;
    }
    
    // Sort remaining players by HR (descending) and take top 6
    const sortedByHR = [...remainingPlayers].sort((a, b) => {
      const aHR = parseFloat(a.whr.whr_elo);
      const bHR = parseFloat(b.whr.whr_elo);
      return bHR - aHR;
    });
    
    const top6HR = sortedByHR.slice(0, 6);
    
    // Add top 6 HR players to QUAL
    top6HR.forEach(player => {
      const username = player.username.original || player.username.display;
      qualMap.set(username, {isQual: true, hasAsterisk: false});
    });
    
    return qualMap;
  }

  /**
   * Calculate qualifying window progress percentage
   */
  calculateProgress(formatKey) {
    if (!this.data.qualifying_status || !this.data.qualifying_status[formatKey]) {
      return null;
    }
    
    const status = this.data.qualifying_status[formatKey];
    const now = new Date();
    // status.start_date and status.end_date are like "2025-10-13 00:01"
    const start = new Date(status.start_date + ':00-05:00'); // CT timezone, add seconds
    const end = new Date(status.end_date + ':00-05:00');
    
    const totalDuration = end - start;
    const elapsed = now - start;
    const percentage = Math.max(0, Math.min(100, (elapsed / totalDuration) * 100));
    
    return {
      percentage: percentage,
      isActive: status.active,
      isCompleted: !status.active && now > end,
      startDate: start,
      endDate: end,
      daysRemaining: Math.ceil((end - now) / (1000 * 60 * 60 * 24)),
      daysTotal: Math.ceil(totalDuration / (1000 * 60 * 60 * 24))
    };
  }
  
  /**
   * Render progress bar HTML
   */
  renderProgressBar(formatKey) {
    const progress = this.calculateProgress(formatKey);
    if (!progress) return '';
    
    const percentage = Math.round(progress.percentage);
    const statusClass = progress.isCompleted ? 'completed' : '';
    const statusText = progress.isCompleted ? 
      'Qualifier Completed' : 
      progress.isActive ? 
        `Live Qualifying - ${progress.daysRemaining} day${progress.daysRemaining !== 1 ? 's' : ''} remaining` :
        'Qualifier Not Started';
    
    const startFormatted = progress.startDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'America/Chicago'
    });
    const endFormatted = progress.endDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'America/Chicago'
    });
    
    return `
      <tr class="progress-bar-row">
        <td colspan="6" style="padding: 0;">
          <div class="qualifying-progress-container">
            <div class="progress-label">
              <span><i class="fas fa-trophy" style="color: #667eea; margin-right: 0.5rem;"></i>Qualifying Window</span>
              <span class="status">
                <span class="progress-status-icon ${statusClass}"></span>
                <span>${statusText}</span>
              </span>
            </div>
            <div class="progress-bar-track">
              <div class="progress-bar-fill ${statusClass}" style="width: ${percentage}%"></div>
              <div class="progress-bar-percentage">${percentage}%</div>
            </div>
            <div class="progress-dates">
              <span class="date"><i class="fas fa-play-circle"></i> ${startFormatted}</span>
              <span class="date">${endFormatted} <i class="fas fa-flag-checkered"></i></span>
            </div>
          </div>
        </td>
      </tr>
    `;
  }

  renderFormatLeaderboard(format, tableElement) {
    if (!tableElement) {
      return;
    }

    // Check if this format hasn't started yet (show placeholder)
    if (this.data.qualifying_status) {
      const status = this.data.qualifying_status[format];
      if (status && !status.active) {
        // Check if it's before start date (hasn't started) or after end date (completed)
        const now = new Date();
        // Parse datetime strings as Central Time (UTC-5)
        const start = new Date(status.start_date + ':00-05:00');
        
        // Only show "Begins" overlay if qualifier hasn't started yet
        if (now < start) {
          this.showInactiveOverlay(tableElement, format, status.start_date);
          return;
        }
        // If after start date, it's completed - show the final standings (fall through)
      }
    }

    if (!this.data.formats || !this.data.formats[format] || this.data.formats[format].length === 0) {
      // No data - might be inactive
      const status = this.data.qualifying_status?.[format];
      if (status) {
        this.showInactiveOverlay(tableElement, format, status.start_date);
      } else {
        tableElement.innerHTML = this.getNoDataRow();
      }
      return;
    }

    let players = [...this.data.formats[format]];
    
    // Apply filters
    players = this.filterPlayers(players, format);
    
    // Sort players
    players = this.sortPlayers(players);
    
    // Compute QUAL badges
    const qualPlayers = this.computeQualBadges(players);
    
    // Render progress bar + table
    const progressBarHTML = this.renderProgressBar(format);
    const playersHTML = players.map((player, index) => 
      this.renderPlayerRow(player, index + 1, qualPlayers)
    ).join('');
    
    tableElement.innerHTML = progressBarHTML + playersHTML;
  }

  showInactiveOverlay(tableElement, format, startDatetime) {
    const formatName = format === 'gen1ou' ? 'Gen 1 OU' : 'Gen 9 OU';
    // startDatetime is like "2025-10-13 00:01"
    const date = new Date(startDatetime + ':00-05:00'); // Add seconds and CT timezone
    const dateFormatted = date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'America/Chicago'
    });
    
    tableElement.innerHTML = `
      <tr>
        <td colspan="6" style="padding: 0; height: 300px; position: relative;">
          <div style="
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            display: flex;
            align-items: center;
            justify-content: center;
            flex-direction: column;
            z-index: 10;
          ">
            <i class="fas fa-calendar-alt" style="font-size: 3rem; color: #cbd5e0; margin-bottom: 1rem;"></i>
            <h3 style="color: #4a5568; margin: 0 0 0.5rem 0; font-size: 1.5rem;">
              ${formatName} Qualifier
            </h3>
            <p style="color: #718096; margin: 0; font-size: 1.1rem;">
              Begins ${dateFormatted}
            </p>
          </div>
        </td>
      </tr>
    `;
  }

  filterPlayers(players, format) {
    if (this.hideBaselines) {
      players = players.filter(player => {
        const username = player.username.original || player.username.display;
        return !player.username.is_starter_kit && !username.startsWith('PAC-LLM-');
      });
    }
    
    if (this.showLLMOnly && format === 'gen9ou' && !this.hideBaselines) {
      players = players.filter(player => {
        const username = (player.username.original || player.username.display).normalize('NFD');
        const nonLLMPacPC = ['PAC-PC-ABYSSAL', 'PAC-PC-DC', 'PAC-PC-FAST', 'PAC-PC-MAX-POWER'];
        
        return username.startsWith('PAC-PokeChamp-') || 
               username.startsWith('PAC-PokéChamp-'.normalize('NFD')) || 
               username.startsWith('PAC-LLM-') ||
               (username.startsWith('PAC-PC-') && !nonLLMPacPC.includes(username));
      });
    }
    
    return players;
  }

  sortPlayers(players) {
    return players.sort((a, b) => {
      // Handle HR sorting specially - need to extract from whr object
      let aVal, bVal;
      if (this.currentSortBy === 'whr') {
        aVal = a.whr && a.whr.whr_elo ? parseFloat(a.whr.whr_elo) : -Infinity;
        bVal = b.whr && b.whr.whr_elo ? parseFloat(b.whr.whr_elo) : -Infinity;
      } else {
        aVal = this.getNumericValue(a[this.currentSortBy]);
        bVal = this.getNumericValue(b[this.currentSortBy]);
      }
      
      return this.currentSortBy === 'losses' ? aVal - bVal : bVal - aVal;
    });
  }

  getNumericValue(value) {
    if (!value || value === '-') return 0;
    const numStr = value.toString().replace('%', '');
    const num = parseFloat(numStr);
    return isNaN(num) ? 0 : num;
  }

  renderPlayerRow(player, rank, qualPlayers = new Map()) {
    const username = player.username;
    const originalUsername = username.original || username.display;
    const isBaseline = username.is_starter_kit || originalUsername.startsWith('PAC-LLM-');
    
    const baselineBadge = isBaseline ? 
      '<span style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 1px 4px; border-radius: 3px; font-size: 0.6rem; font-weight: 600; margin-left: 4px; vertical-align: middle; display: inline-block; white-space: nowrap;">ORG</span>' : 
      '';
    
    // QUAL badge (pink themed)
    const qualInfo = qualPlayers.get(originalUsername);
    let qualBadge = '';
    if (qualInfo && qualInfo.isQual) {
      qualBadge = `<span style="background: linear-gradient(135deg, #ec4899 0%, #db2777 100%); color: white; padding: 1px 4px; border-radius: 3px; font-size: 0.6rem; font-weight: 600; margin-left: 4px; vertical-align: middle; display: inline-block; white-space: nowrap;">QUAL</span>`;
    }
    
    // Format GXE - handle missing values and map < 5% to "-"
    let formattedGxe = '-';
    if (player.gxe && player.gxe !== '-' && player.gxe !== 'Unknown') {
      const gxeValue = parseFloat(player.gxe.toString().replace('%', ''));
      if (!isNaN(gxeValue) && gxeValue >= 5) {
        formattedGxe = gxeValue.toFixed(1) + '%';
      }
    }
    
    const wlRatio = `${player.wins || '0'}/${player.losses || '0'}`;
    
    // Format HR with uncertainty
    let hrDisplay = '-';
    if (player.whr && player.whr.whr_elo) {
      const hrElo = parseFloat(player.whr.whr_elo).toFixed(0);
      const hrStd = parseFloat(player.whr.whr_std).toFixed(0);
      hrDisplay = `<span title="HR: ${hrElo} ± ${hrStd} (95% CI: ${parseFloat(player.whr.whr_ci_lower).toFixed(0)}-${parseFloat(player.whr.whr_ci_upper).toFixed(0)})">${hrElo}<span style="font-size: 0.7rem; color: #718096;">±${hrStd}</span></span>`;
    }
    
    // Format ELO - handle missing/unknown values
    const formattedElo = (player.elo && player.elo !== 'Unknown' && player.elo !== '-') ? player.elo : '-';
    
    return `<tr style="border-bottom: 1px solid #e2e8f0; transition: background-color 0.2s;" onmouseover="this.style.backgroundColor='#f8fafc'" onmouseout="this.style.backgroundColor='white'">
      <td style="padding: 8px; font-weight: 600; color: #2d3748; font-size: 0.9rem;">${rank}</td>
      <td style="padding: 8px; font-weight: 500; white-space: nowrap; font-size: 0.9rem;"><span style="display: inline-block; vertical-align: middle;">${username.display}</span>${baselineBadge}${qualBadge}</td>
      <td style="padding: 8px; text-align: center; font-weight: 500; color: #2d3748; font-size: 0.9rem;">${hrDisplay}</td>
      <td style="padding: 8px; text-align: center; font-weight: 500; color: #2d3748; font-size: 0.9rem;">${formattedElo}</td>
      <td style="padding: 8px; text-align: center; font-weight: 500; color: #2d3748; font-size: 0.9rem;">${formattedGxe}</td>
      <td style="padding: 8px; text-align: center; font-weight: 500; color: #2d3748; font-size: 0.9rem;">${wlRatio}</td>
    </tr>`;
  }

  getNoDataRow() {
    return `<tr style="border-bottom: 1px solid #e2e8f0;">
      <td style="padding: 8px; color: #718096; font-size: 0.9rem;">-</td>
      <td style="padding: 8px; color: #718096; font-size: 0.9rem;">No data available</td>
      <td style="padding: 8px; text-align: center; color: #718096; font-size: 0.9rem;">-</td>
      <td style="padding: 8px; text-align: center; color: #718096; font-size: 0.9rem;">-</td>
      <td style="padding: 8px; text-align: center; color: #718096; font-size: 0.9rem;">-</td>
      <td style="padding: 8px; text-align: center; color: #718096; font-size: 0.9rem;">-</td>
    </tr>`;
  }

  async toggleH2HMatrix() {
    this.showH2HMatrix = !this.showH2HMatrix;
    
    // Update button text
    if (this.elements.h2hToggleBtn) {
      this.elements.h2hToggleBtn.textContent = this.showH2HMatrix ? 'Hide Head-to-Head Matrix' : 'Show Head-to-Head Matrix';
    }
    
    if (this.showH2HMatrix) {
      // Load and render H2H matrix for Gen1OU
      const format = document.getElementById('h2h-format-select')?.value || 'gen1ou';
      await this.h2hMatrix.loadData(format);
      this.h2hMatrix.render(format);
    }
    
    this.render();
  }

  async switchH2HFormat(format) {
    if (this.showH2HMatrix) {
      await this.h2hMatrix.loadData(format);
      this.h2hMatrix.render(format);
    }
  }

  showError() {
    const errorRow = `<tr style="border-bottom: 1px solid #e2e8f0;">
      <td style="padding: 8px; color: #718096; font-size: 0.9rem;">-</td>
      <td style="padding: 8px; color: #718096; font-size: 0.9rem;">Error loading data</td>
      <td style="padding: 8px; text-align: center; color: #718096; font-size: 0.9rem;">-</td>
      <td style="padding: 8px; text-align: center; color: #718096; font-size: 0.9rem;">-</td>
      <td style="padding: 8px; text-align: center; color: #718096; font-size: 0.9rem;">-</td>
      <td style="padding: 8px; text-align: center; color: #718096; font-size: 0.9rem;">-</td>
    </tr>`;
    
    if (this.elements.gen1Table) this.elements.gen1Table.innerHTML = errorRow;
    if (this.elements.gen9Table) this.elements.gen9Table.innerHTML = errorRow;
  }
}

export default BattlingLeaderboard;