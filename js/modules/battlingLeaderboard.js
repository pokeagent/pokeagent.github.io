/**
 * Battling Leaderboard Module
 * Handles Track 1 competitive battling leaderboard functionality
 */

import HeadToHeadMatrix from './headToHeadMatrix.js';

class BattlingLeaderboard {
  constructor() {
    this.data = {};
    this.currentSortBy = 'elo';
    this.hideBaselines = true;
    this.showLLMOnly = false;
    this.h2hMatrix = new HeadToHeadMatrix();
    this.showH2HMatrix = false;
    this.elements = {
      gen1Table: document.getElementById('gen1ou-leaderboard'),
      gen9Table: document.getElementById('gen9ou-leaderboard'),
      sortSelect: document.getElementById('sort-select'),
      hideBaselinesCheckbox: document.getElementById('hide-baselines'),
      showLLMCheckbox: document.getElementById('show-llm-only'),
      baselineExplanation: document.getElementById('baseline-explanation'),
      lastUpdated: document.getElementById('last-updated'),
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

  async loadData() {
    try {
      const response = await fetch(`leaderboard/track1.json?t=${Date.now()}`);
      if (!response.ok) throw new Error('Failed to load Track 1 leaderboard');
      this.data = await response.json();
    } catch (error) {
      console.error('Error loading Track 1 leaderboard:', error);
      this.showError();
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
    
    if (this.data.last_updated && this.elements.lastUpdated) {
      const lastUpdated = new Date(this.data.last_updated).toLocaleString('en-US', {
        timeZone: 'America/Chicago',
        year: 'numeric',
        month: 'numeric', 
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
      this.elements.lastUpdated.textContent = `Last updated: ${lastUpdated} CT`;
    }

    // Update HR minimum games display
    this.updateHRMinGamesDisplay();

    // Update H2H matrix visibility
    if (this.elements.h2hContainer) {
      this.elements.h2hContainer.style.display = this.showH2HMatrix ? 'block' : 'none';
    }
  }

  extractHRMinGames() {
    // Extract HR min_games_threshold from the data
    // Check all players across all formats and verify they all have the same value
    const minGamesValues = new Set();
    
    for (const formatName in this.data.formats) {
      const players = this.data.formats[formatName];
      for (const player of players) {
        if (player.whr && player.whr.min_games_threshold !== undefined) {
          minGamesValues.add(player.whr.min_games_threshold);
        }
      }
    }
    
    // If all values are the same (set size = 1), return that value
    if (minGamesValues.size === 1) {
      return Array.from(minGamesValues)[0];
    } else if (minGamesValues.size > 1) {
      console.warn('Inconsistent HR min_games_threshold values found:', Array.from(minGamesValues));
      return null;
    }
    
    // No HR data found
    return null;
  }

  updateHRMinGamesDisplay() {
    // Update the HR min games display element (now inline with Glicko text)
    const hrMinGamesElement = document.getElementById('hr-min-games-display');
    
    if (hrMinGamesElement) {
      const minGames = this.extractHRMinGames();
      if (minGames !== null) {
        hrMinGamesElement.textContent = `HR requires ${minGames}+ games.`;
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

  renderFormatLeaderboard(format, tableElement) {
    if (!tableElement || !this.data.formats || !this.data.formats[format]) {
      if (tableElement) {
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
    
    // Render table
    tableElement.innerHTML = players.map((player, index) => 
      this.renderPlayerRow(player, index + 1, qualPlayers)
    ).join('');
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
    
    const formattedGxe = player.gxe && player.gxe !== '-' ? 
      parseFloat(player.gxe.toString().replace('%', '')).toFixed(1) + '%' : 
      '-';
    
    const wlRatio = `${player.wins || '0'}/${player.losses || '0'}`;
    
    // Format HR with uncertainty
    let hrDisplay = '-';
    if (player.whr && player.whr.whr_elo) {
      const hrElo = parseFloat(player.whr.whr_elo).toFixed(0);
      const hrStd = parseFloat(player.whr.whr_std).toFixed(0);
      hrDisplay = `<span title="HR: ${hrElo} ± ${hrStd} (95% CI: ${parseFloat(player.whr.whr_ci_lower).toFixed(0)}-${parseFloat(player.whr.whr_ci_upper).toFixed(0)})">${hrElo}<span style="font-size: 0.7rem; color: #718096;">±${hrStd}</span></span>`;
    }
    
    return `<tr style="border-bottom: 1px solid #e2e8f0; transition: background-color 0.2s;" onmouseover="this.style.backgroundColor='#f8fafc'" onmouseout="this.style.backgroundColor='white'">
      <td style="padding: 10px; font-weight: 600; color: #2d3748;">${rank}</td>
      <td style="padding: 10px; font-weight: 500; white-space: nowrap;"><span style="display: inline-block; vertical-align: middle;">${username.display}</span>${baselineBadge}${qualBadge}</td>
      <td style="padding: 10px; text-align: center; font-weight: 500; color: #2d3748;">${hrDisplay}</td>
      <td style="padding: 10px; text-align: center; font-weight: 500; color: #2d3748;">${player.elo || '-'}</td>
      <td style="padding: 10px; text-align: center; font-weight: 500; color: #2d3748;">${formattedGxe}</td>
      <td style="padding: 10px; text-align: center; font-weight: 500; color: #2d3748;">${wlRatio}</td>
    </tr>`;
  }

  getNoDataRow() {
    return `<tr style="border-bottom: 1px solid #e2e8f0;">
      <td style="padding: 10px; color: #718096;">-</td>
      <td style="padding: 10px; color: #718096;">No data available</td>
      <td style="padding: 10px; text-align: center; color: #718096;">-</td>
      <td style="padding: 10px; text-align: center; color: #718096;">-</td>
      <td style="padding: 10px; text-align: center; color: #718096;">-</td>
      <td style="padding: 10px; text-align: center; color: #718096;">-</td>
    </tr>`;
  }

  async toggleH2HMatrix() {
    this.showH2HMatrix = !this.showH2HMatrix;
    
    // Update button text
    if (this.elements.h2hToggleBtn) {
      this.elements.h2hToggleBtn.textContent = this.showH2HMatrix ? 'Hide Head-to-Head Matrix' : 'Show Head-to-Head Matrix';
    }
    
    if (this.showH2HMatrix) {
      // Load and render H2H matrix for Gen1OU by default
      await this.h2hMatrix.loadData('gen1ou');
      this.h2hMatrix.render('gen1ou');
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
      <td style="padding: 10px; color: #718096;">-</td>
      <td style="padding: 10px; color: #718096;">Error loading data</td>
      <td style="padding: 10px; text-align: center; color: #718096;">-</td>
      <td style="padding: 10px; text-align: center; color: #718096;">-</td>
      <td style="padding: 10px; text-align: center; color: #718096;">-</td>
      <td style="padding: 10px; text-align: center; color: #718096;">-</td>
    </tr>`;
    
    if (this.elements.gen1Table) this.elements.gen1Table.innerHTML = errorRow;
    if (this.elements.gen9Table) this.elements.gen9Table.innerHTML = errorRow;
  }
}

export default BattlingLeaderboard;