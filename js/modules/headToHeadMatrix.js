/**
 * Head-to-Head Matrix Visualization Module
 * Creates an interactive matrix showing win/loss records between players
 */

class HeadToHeadMatrix {
  constructor() {
    this.data = {};
    this.filteredPlayers = [];
    this.matrixContainer = null;
    this.currentFormat = 'gen1ou';
    this.minGames = 10; // Minimum games for non-grey squares
    this.maxDeviation = 80; // Maximum Glicko-1 deviation (matches main leaderboard)
    this.debugCount = 0; // For debugging H2H lookups
  }

  /**
   * Detect if we're on a mobile device
   */
  isMobile() {
    return window.innerWidth <= 768;
  }

  /**
   * Calculate adaptive sizing based on viewport width
   */
  getAdaptiveSizing() {
    const width = window.innerWidth;
    const playerCount = this.filteredPlayers.length;
    
    // Much more generous base sizes
    let cellSize = 60;
    let headerWidth = 180;
    let headerHeight = 160;
    let fontSize = 0.8;
    let valueFontSize = 0.9; // numeric cell value font-size
    let headerFontSize = 0.75;
    let nameFontSize = 0.7;
    
    // Progressive scaling based on screen width, not cramming
    if (width <= 1200) {
      cellSize = 50;
      headerWidth = 160;
      headerHeight = 140;
      fontSize = 0.75;
      valueFontSize = 0.85;
      headerFontSize = 0.7;
      nameFontSize = 0.65;
    }
    
    if (width <= 900) {
      cellSize = 45;
      headerWidth = 150;
      headerHeight = 130;
      fontSize = 0.7;
      valueFontSize = 0.8;
      headerFontSize = 0.65;
      nameFontSize = 0.6;
    }
    
    if (width <= 768) {
      cellSize = 70;
      headerWidth = 70;
      headerHeight = 70;
      fontSize = 0.65;
      valueFontSize = 0.6;
      headerFontSize = 0.55;
      nameFontSize = 0.5;
    }
    
    if (width <= 600) {
      cellSize = 65;
      headerWidth = 65;
      headerHeight = 65;
      fontSize = 0.6;
      valueFontSize = 0.55;
      headerFontSize = 0.5;
      nameFontSize = 0.45;
    }
    
    if (width <= 480) {
      cellSize = 60;
      headerWidth = 60;
      headerHeight = 60;
      fontSize = 0.55;
      valueFontSize = 0.5;
      headerFontSize = 0.45;
      nameFontSize = 0.4;
    }
    
    if (width <= 400) {
      cellSize = 55;
      headerWidth = 55;
      headerHeight = 55;
      fontSize = 0.52;
      valueFontSize = 0.48;
      headerFontSize = 0.42;
      nameFontSize = 0.38;
    }
    
    if (width <= 360) {
      cellSize = 50;
      headerWidth = 50;
      headerHeight = 50;
      fontSize = 0.5;
      valueFontSize = 0.46;
      headerFontSize = 0.4;
      nameFontSize = 0.36;
    }
    
    if (width <= 320) {
      cellSize = 45;
      headerWidth = 45;
      headerHeight = 45;
      fontSize = 0.48;
      valueFontSize = 0.44;
      headerFontSize = 0.38;
      nameFontSize = 0.34;
    }
    
    // Limit visible columns on small screens for better readability
    let maxColumnsToShow = this.filteredPlayers.length;
    
    // DRASTICALLY limit columns on small screens
    if (width <= 900) {
      maxColumnsToShow = Math.min(5, this.filteredPlayers.length);
    }
    if (width <= 768) {
      maxColumnsToShow = Math.min(3, this.filteredPlayers.length);
    }
    if (width <= 600) {
      maxColumnsToShow = Math.min(2, this.filteredPlayers.length);
    }
    if (width <= 480) {
      maxColumnsToShow = Math.min(2, this.filteredPlayers.length);
    }
    if (width <= 400) {
      maxColumnsToShow = Math.min(2, this.filteredPlayers.length);
    }
    if (width <= 360) {
      maxColumnsToShow = Math.min(2, this.filteredPlayers.length);
    }

    // Use ABSOLUTE max height in pixels - not viewport-based
    // This ensures narrow windows don't show tons of rows just because they're tall
    let maxHeight = 700;
    if (width <= 1200) maxHeight = 600;
    if (width <= 900) maxHeight = 500;
    if (width <= 768) maxHeight = 400;
    if (width <= 600) maxHeight = 350;
    if (width <= 480) maxHeight = 300;
    if (width <= 400) maxHeight = 280;
    if (width <= 360) maxHeight = 260;

    return {
      cellSize,
      headerWidth,
      headerHeight,
      fontSize,
      headerFontSize,
      nameFontSize,
      valueFontSize,
      maxHeight,
      padding: Math.max(12, cellSize * 0.25),
      maxColumnsToShow
    };
  }

  async init(containerSelector = '#h2h-matrix-content') {
    this.matrixContainer = document.querySelector(containerSelector);
    if (!this.matrixContainer) {
      console.error('Head-to-head matrix content container not found');
      return;
    }

    // Expose this instance globally for navigation controls
    window.h2hMatrix = this;

    // Add resize listener to re-render matrix when screen size changes
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        if (this.filteredPlayers.length > 0) {
          this.render(this.currentFormat);
        }
      }, 300); // Debounce resize events
    });
  }


  /**
   * Load and process TSV data for head-to-head analysis
   */
  async loadData(format = 'gen1ou') {
    try {
      const response = await fetch(`leaderboard/showdown_tsvs/${format}.tsv?t=${Date.now()}`);
      if (!response.ok) throw new Error(`Failed to load ${format} TSV`);
      
      const tsvText = await response.text();
      const lines = tsvText.trim().split('\n');
      const headers = lines[0].split('\t');
      
      // Clean headers
      const cleanHeaders = headers.map(h => h.replace(/\r/g, '').trim());
      
      const h2hIndex = cleanHeaders.indexOf('H2H_Data');
      const usernameIndex = cleanHeaders.indexOf('Username');
      const eloIndex = cleanHeaders.indexOf('Elo');
      const glickoIndex = cleanHeaders.indexOf('Glicko');
      const deviationIndex = cleanHeaders.indexOf('Rating_Deviation');
      
      const players = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split('\t');
        
        if (values.length <= Math.max(h2hIndex, usernameIndex, deviationIndex)) continue;
        
        const username = values[usernameIndex];
        const ratingDeviation = parseFloat(values[deviationIndex]) || 100;
        
        // Only process players with low deviation
        if (ratingDeviation <= this.maxDeviation) {
          let h2hData = {};
          try {
            h2hData = JSON.parse(values[h2hIndex] || '{}');
          } catch (e) {
            console.error(`Error parsing H2H data for ${username}:`, e);
          }
          
          players.push({
            Username: username,
            Elo: parseFloat(values[eloIndex]) || 0,
            Glicko: parseFloat(values[glickoIndex]) || 0,
            Rating_Deviation: ratingDeviation,
            H2H_Data: h2hData
          });
        }
      }
      
      // Sort by ELO
      this.filteredPlayers = players.sort((a, b) => b.Elo - a.Elo);
      
    } catch (error) {
      console.error(`Error loading ${format} TSV:`, error);
      this.filteredPlayers = [];
    }
  }


  /**
   * Convert username to display format (like the main leaderboard)
   */
  usernameToDisplay(username) {
    // Convert based on the JSON display name patterns
    if (username.startsWith('PAC-MM-')) {
      return username.replace('PAC-MM-', 'Metamon-');
    } else if (username.startsWith('PAC-BH-')) {
      return username.replace('PAC-BH-', 'Heuristic-');
    } else if (username.startsWith('PAC-LLM-')) {
      return username.replace('PAC-LLM-', 'LLM-');
    } else if (username.startsWith('PAC-PC-')) {
      return username.replace('PAC-PC-', 'PokéChamp-');
    } else if (username.startsWith('PAC-')) {
      return username.replace('PAC-', '');
    }
    return username;
  }

  /**
   * Check if a player is an organizer baseline (matches main leaderboard logic)
   */
  isOrganizerBaseline(username) {
    // Match the main leaderboard logic: is_starter_kit OR starts with PAC-LLM-
    // Since we only have TSV data, we approximate is_starter_kit by checking prefixes
    return username.startsWith('PAC-MM-') || 
           username.startsWith('PAC-BH-') || 
           username.startsWith('PAC-PC-') ||
           username.startsWith('PAC-LLM-');
  }

  /**
   * Get the ORG badge HTML with dynamic sizing
   */
  getOrgBadge(fontSize) {
    return `<span style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 1px 3px; border-radius: 2px; font-size: ${fontSize * 0.5}rem; font-weight: 600; margin-left: 3px; vertical-align: middle; display: inline-block;">ORG</span>`;
  }

  /**
   * Convert username to H2H key format (lowercase, no spaces/special chars)
   */
  usernameToH2HKey(username) {
    // Convert full username to lowercase and remove all non-alphanumeric characters
    return username.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  /**
   * Get head-to-head record between two players
   */
  getH2HRecord(player1, player2Username) {
    const h2hData = player1.H2H_Data || {};
    const player2Key = this.usernameToH2HKey(player2Username);
    const record = h2hData[player2Key];
    
    
    if (!record) return null;
    
    const totalGames = (record.w || 0) + (record.l || 0) + (record.t || 0);
    return {
      wins: record.w || 0,
      losses: record.l || 0,
      ties: record.t || 0,
      total: totalGames
    };
  }

  /**
   * Calculate win percentage for color intensity
   */
  getWinPercentage(wins, losses) {
    const total = wins + losses;
    if (total === 0) return 0.5; // Neutral for ties only
    return wins / total;
  }

  /**
   * Get color for matrix cell based on win percentage
   */
  getCellColor(winPercentage, totalGames) {
    if (totalGames < this.minGames) {
      return '#f8f9fa'; // Light grey for insufficient data
    }
    
    if (winPercentage === 0.5) {
      return '#d1d5db'; // Grey for exactly 50%
    } else if (winPercentage > 0.51) {
      // Blue → Green gradient for wins (51% → 100%)
      const range = winPercentage - 0.51;
      const maxRange = 0.49; // 51% to 100%
      const intensity = Math.min(range / maxRange, 1); // 0 to 1
      
      // Gradual transition: light blue → teal → green → dark green
      const red = Math.floor(210 - intensity * 80); // 210 to 130
      const green = Math.floor(215 + intensity * 40); // 215 to 255
      const blue = Math.floor(235 - intensity * 135); // 235 to 100
      
      return `rgb(${red}, ${green}, ${blue})`;
    } else if (winPercentage < 0.49) {
      // Purple → Red gradient for losses (49% → 0%)
      const range = 0.49 - winPercentage;
      const maxRange = 0.49; // 49% to 0%
      const intensity = Math.min(range / maxRange, 1); // 0 to 1
      
      // Gradual transition: light purple → pink → red → dark red
      const red = Math.floor(215 + intensity * 40); // 215 to 255
      const green = Math.floor(210 - intensity * 80); // 210 to 130
      const blue = Math.floor(215 - intensity * 115); // 215 to 100
      
      return `rgb(${red}, ${green}, ${blue})`;
    } else {
      // 49% to 51% - light grey transition
      return '#e5e7eb';
    }
  }

  /**
   * Render the head-to-head matrix
   */
  render(format = 'gen1ou') {
    if (!this.matrixContainer) {
      console.error('Matrix container not found');
      return;
    }

    if (!this.filteredPlayers || this.filteredPlayers.length === 0) {
      this.matrixContainer.innerHTML = `
        <div style="text-align: center; padding: 2rem; color: #666;">
          <h3>Head-to-Head Matrix - ${format.toUpperCase()}</h3>
          <p>Loading data or no players meet the criteria (Glicko-1 deviation ≤ ${this.maxDeviation})...</p>
        </div>
      `;
      return;
    }

    // Reset debug counter for new render
    this.debugCount = 0;

    // Use adaptive sizing and column limiting for better mobile experience
    const sizing = this.getAdaptiveSizing();
    const players = this.filteredPlayers;
    
    // Show all columns but size them so only a few are visible
    const columnsToShow = players;
    const effectiveCellSize = sizing.cellSize; // use the sizing cellSize directly for consistent square cells

    // Create simple matrix HTML
    const tableMinWidth = sizing.headerWidth + (effectiveCellSize * columnsToShow.length);
    // Compute max visible rows by using container height minus header
    const maxVisibleRows = Math.max(3, Math.floor((sizing.maxHeight - sizing.headerHeight) / Math.max(36, sizing.cellSize)));
    // Scale header-name font by available header height and cell width (avoid bleed)
    // Determine header font so the username fills the available header height without overlapping
    // Column header font should match row header font (nameFontSize)
    const headerNameFontRem = sizing.nameFontSize;
    const headerNameFont = headerNameFontRem;
    let html = `
      <div class="h2h-matrix-wrapper">
        <h3 style="text-align: center; margin-bottom: 0.5rem; color: #333;">
          Head-to-Head Records
        </h3>
        <p style="text-align: center; font-size: ${sizing.fontSize}rem; color: #666; margin-bottom: 1rem;">
          Cells show row player's win rate (%, color-coded) against the column player <em> when at least ${this.minGames} games have been played.</em> Otherwise displays games played. Restricted to usernames with Glicko-1 deviation ≤ ${this.maxDeviation}. Sorted by Elo; the top-left corner shows matchups between the highest ranked players. Scroll horizontally and vertically to see all players. Hover cells for full W/L/T records. <span style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 1px 4px; border-radius: 3px; font-size: ${sizing.fontSize * 0.8}rem; font-weight: 600; margin: 0 2px;">ORG</span> = Organizer Baseline
        </p>
        <div class="matrix-scroll-container" style="overflow: auto; width: 100%; max-height: ${sizing.maxHeight}px; border: 2px solid #2d3748; border-radius: 8px; position: relative; -webkit-overflow-scrolling: touch;">
          <table class="h2h-matrix" style="border-collapse: collapse; font-size: ${sizing.fontSize}rem; margin: 0; table-layout: fixed; min-width: ${tableMinWidth}px;">
            <thead>
              <tr>
                <th style="
                  padding: 0; 
                  border: 1px solid #cbd5e0; 
                  background: #f8f9fa; 
                  width: ${sizing.headerWidth}px; 
                  height: ${sizing.headerHeight}px;
                  position: sticky; 
                  left: 0; 
                  top: 0; 
                  z-index: 3;
                ">
                  <div style="
                    position: relative;
                    width: 100%;
                    height: 100%;
                    background: linear-gradient(to bottom left, #f8f9fa 49.5%, #ddd 49.5%, #ddd 50.5%, #f8f9fa 50.5%);
                  ">
                    <div style="
                      position: absolute;
                      bottom: ${Math.max(6, sizing.headerHeight * 0.08)}px;
                      left: ${Math.max(6, sizing.headerWidth * 0.06)}px;
                      font-size: ${sizing.headerFontSize}rem;
                      font-weight: 600;
                      color: #495057;
                    ">Player ↓</div>
                    <div style="
                      position: absolute;
                      top: ${Math.max(6, sizing.headerHeight * 0.08)}px;
                      right: ${Math.max(6, sizing.headerWidth * 0.06)}px;
                      font-size: ${sizing.headerFontSize}rem;
                      font-weight: 600;
                      color: #495057;
                    ">Opponent →</div>
                  </div>
                </th>
    `;
    
    // Add column headers (opponent names, rotated) - show all, but sized so only some are visible
    columnsToShow.forEach((player, index) => {
      // Use the same display format as the main leaderboard
      const displayName = this.usernameToDisplay(player.Username);
      const isBaseline = this.isOrganizerBaseline(player.Username);
      const orgBadgeVertical = isBaseline ? `<div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 2px 1px; border-radius: 2px; font-size: ${Math.max(0.4, sizing.fontSize * 0.45)}rem; font-weight: 600; margin: 2px 0; writing-mode: vertical-rl; text-orientation: mixed; letter-spacing: 0.05em;">ORG</div>` : '';
      
      html += `
        <th style="
          padding: ${sizing.padding}px ${Math.max(2, sizing.padding * 0.7)}px; 
          border: 1px solid #ddd; 
          background: #f8f9fa; 
          writing-mode: vertical-rl; 
          text-orientation: mixed; 
          min-width: ${effectiveCellSize}px; 
          max-width: ${effectiveCellSize}px;
          font-size: ${sizing.nameFontSize}rem;
          text-align: center;
          height: ${sizing.headerHeight}px;
          cursor: default;
          position: sticky;
          top: 0;
          z-index: 2;
        " title="Opponent: ${displayName}${isBaseline ? ' (Organizer Baseline)' : ''}">
        <div style="display: flex; flex-direction: column; align-items: center; height: 100%;">
          <div style="flex: 1; display: flex; align-items: center; justify-content: center; overflow: hidden;">
            <span style="writing-mode: vertical-rl; text-orientation: mixed; font-size: ${headerNameFont}rem; line-height: 1; white-space: nowrap; text-overflow: ellipsis;">${displayName}</span>
          </div>
          ${orgBadgeVertical}
        </div>
        </th>
      `;
    });
    
    html += '</tr></thead><tbody>';
    
    // Add matrix rows
    players.forEach((rowPlayer, rowIndex) => {
      // Use the same display format as the main leaderboard
      const displayName = this.usernameToDisplay(rowPlayer.Username);
      const isBaseline = this.isOrganizerBaseline(rowPlayer.Username);
      const orgBadge = isBaseline ? this.getOrgBadge(sizing.fontSize) : '';
      
      html += `
        <tr>
        <td style="
          padding: ${sizing.padding}px ${Math.max(4, sizing.padding * 1.2)}px; 
          border: 1px solid #ddd; 
          background: #f8f9fa; 
          font-weight: 500;
          position: sticky;
          left: 0;
          z-index: 1;
          font-size: ${sizing.nameFontSize}rem;
          min-width: ${sizing.headerWidth}px;
          max-width: ${sizing.headerWidth}px;
          cursor: default;
        " title="${displayName} (ELO: ${Math.round(rowPlayer.Elo)}, Dev: ${rowPlayer.Rating_Deviation.toFixed(1)})">
            ${displayName}${orgBadge}
          </td>
      `;
      
      columnsToShow.forEach((colPlayer, colIndex) => {
        // Find the original index of this player in the full players array
        const originalColIndex = players.findIndex(p => p.Username === colPlayer.Username);
        
        if (rowIndex === originalColIndex) {
          // Diagonal - same player
          html += `
            <td style="
            padding: ${sizing.padding}px;
            border: 1px solid #ddd;
            background: #333;
            text-align: center;
            min-width: ${effectiveCellSize}px;
            max-width: ${effectiveCellSize}px;
            height: ${Math.max(50, sizing.cellSize * 1.1)}px;
            font-size: ${sizing.fontSize}rem;
            ">-</td>
          `;
        } else {
          const record = this.getH2HRecord(rowPlayer, colPlayer.Username);
          
          if (!record || record.total === 0) {
            // No games played
            html += `
              <td style="
              padding: ${sizing.padding}px;
              border: 1px solid #ddd;
              background: #f5f5f5;
              text-align: center;
              min-width: ${effectiveCellSize}px;
              max-width: ${effectiveCellSize}px;
              height: ${Math.max(50, sizing.cellSize * 1.1)}px;
              font-size: ${sizing.fontSize}rem;
              color: #999;
              " title="No games played">-</td>
            `;
          } else {
            const winPercentage = this.getWinPercentage(record.wins, record.losses);
            const cellColor = this.getCellColor(winPercentage, record.total);
            
            let displayText, textColor;
            if (record.total >= this.minGames) {
              // Show win percentage for sufficient games
              displayText = `${Math.round(winPercentage * 100)}%`;
              textColor = '#000';
            } else {
              // Show total games for insufficient data
              displayText = record.total.toString();
              textColor = '#666';
            }
            
            html += `
              <td style="
               padding: ${sizing.padding}px;
               border: 1px solid #ddd;
               background: ${cellColor};
               text-align: center;
               font-size: ${sizing.valueFontSize}rem;
               font-weight: 600;
               min-width: ${effectiveCellSize}px;
               max-width: ${effectiveCellSize}px;
               height: ${effectiveCellSize}px;
               cursor: pointer;
               color: ${textColor};
                      " title="${this.usernameToDisplay(rowPlayer.Username)} vs ${this.usernameToDisplay(colPlayer.Username)}: ${record.wins}W-${record.losses}L-${record.ties}T (${record.total} games, ${(winPercentage * 100).toFixed(1)}% win rate)">
                <span style="display: inline-flex; align-items: center; justify-content: center; width: 100%; height: 100%;">${displayText}</span>
              </td>
            `;
          }
        }
      });
      
      html += '</tr>';
    });
    
    html += `
          </tbody>
        </table>
      </div>
    </div>
    `;
    
    this.matrixContainer.innerHTML = html;
  }

  /**
   * Update the visualization for a different format
   */
  async updateFormat(format) {
    this.currentFormat = format;
    await this.loadData(format);
    this.render(format);
  }
}

export default HeadToHeadMatrix;
