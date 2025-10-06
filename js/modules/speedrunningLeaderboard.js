/**
 * Speedrunning Leaderboard Module
 * Handles Track 2 RPG speedrunning leaderboard functionality
 */

class SpeedrunningLeaderboard {
  constructor() {
    this.data = [];
    this.currentViewMode = 'overall';
    // Teams that should show ORG badge
    this.organizerTeams = ['Avg Human', 'PokeAgent'];
    // Teams that use duration (split times) instead of endTime (cumulative)
    this.splitTimeTeams = ['Avg Human'];
    
    this.phaseNames = {
      'Phase_1_Game_Initialization': 'Milestone 1: Game Start',
      'Phase_2_Tutorial_Starting_Town': 'Milestone 2: Littleroot Town',
      'Phase_3_Professor_Birch_Starter': 'Milestone 3: Starter Pokemon',
      'Phase_4_Rival': 'Milestone 4: Rival Battle',
      'Phase_5_Route_102_Petalburg': 'Milestone 5: Petalburg City',
      'Phase_6_Road_to_Rustboro_City': 'Milestone 6: Route to Rustboro',
      'Phase_7_First_Gym_Challenge': 'Milestone 7: First Gym'
    };
    
    this.phaseMilestones = {
      'Phase_1_Game_Initialization': [
        { key: 'GAME_RUNNING', name: 'Game Running' },
        { key: 'PLAYER_NAME_SET', name: 'Player Name Set' },
        { key: 'INTRO_CUTSCENE_COMPLETE', name: 'Intro Complete' }
      ],
      'Phase_2_Tutorial_Starting_Town': [
        { key: 'LITTLEROOT_TOWN', name: 'Littleroot Town' },
        { key: 'PLAYER_HOUSE_ENTERED', name: 'Player House' },
        { key: 'PLAYER_BEDROOM', name: 'Player Bedroom' },
        { key: 'RIVAL_HOUSE', name: 'Rival House' },
        { key: 'RIVAL_BEDROOM', name: 'Rival Bedroom' }
      ],
      'Phase_3_Professor_Birch_Starter': [
        { key: 'ROUTE_101', name: 'Route 101' },
        { key: 'STARTER_CHOSEN', name: 'Starter Chosen' },
        { key: 'BIRCH_LAB_VISITED', name: 'Birch Lab' }
      ],
      'Phase_4_Rival': [
        { key: 'OLDALE_TOWN', name: 'Oldale Town' },
        { key: 'ROUTE_103', name: 'Route 103' },
        { key: 'RECEIVED_POKEDEX', name: 'Received Pokedex' }
      ],
      'Phase_5_Route_102_Petalburg': [
        { key: 'ROUTE_102', name: 'Route 102' },
        { key: 'PETALBURG_CITY', name: 'Petalburg City' },
        { key: 'DAD_FIRST_MEETING', name: 'Dad First Meeting' },
        { key: 'GYM_EXPLANATION', name: 'Gym Explanation' }
      ],
      'Phase_6_Road_to_Rustboro_City': [
        { key: 'ROUTE_104_SOUTH', name: 'Route 104 South' },
        { key: 'PETALBURG_WOODS', name: 'Petalburg Woods' },
        { key: 'TEAM_AQUA_GRUNT_DEFEATED', name: 'Team Aqua Defeated' },
        { key: 'ROUTE_104_NORTH', name: 'Route 104 North' },
        { key: 'RUSTBORO_CITY', name: 'Rustboro City' }
      ],
      'Phase_7_First_Gym_Challenge': [
        { key: 'RUSTBORO_GYM_ENTERED', name: 'Rustboro Gym' },
        { key: 'ROXANNE_DEFEATED', name: 'Roxanne Defeated' },
        { key: 'FIRST_GYM_COMPLETE', name: 'First Gym Complete' }
      ]
    };
    
    this.elements = {
      tableBody: document.getElementById('speedrunning-leaderboard'),
      tableHeader: document.getElementById('speedrunning-header'),
      viewModeSelect: document.getElementById('view-mode-select'),
      milestoneSelect: document.getElementById('milestone-select'),
      milestoneLabel: document.getElementById('milestone-filter-label'),
      viewDescription: document.getElementById('view-description')
    };
  }

  async init() {
    await this.loadData();
    this.bindEvents();
    this.render();
  }

  async loadData() {
    try {
      // Load both speedrunning.json and human.json
      const [speedrunResponse, humanResponse] = await Promise.all([
        fetch(`leaderboard/speedrunning.json?t=${Date.now()}`),
        fetch(`leaderboard/human.json?t=${Date.now()}`)
      ]);
      
      if (!speedrunResponse.ok) throw new Error('Failed to load speedrunning leaderboard');
      if (!humanResponse.ok) throw new Error('Failed to load human leaderboard');
      
      const speedrunData = await speedrunResponse.json();
      const humanData = await humanResponse.json();
      
      // Replace "Human" entry with "Avg Human" from human.json
      this.data = speedrunData.map(entry => {
        if (entry.team === 'Human' && humanData.length > 0) {
          // Find Avg Human entry in human.json
          const avgHuman = humanData.find(h => h.team === 'Avg Human');
          if (avgHuman) {
            // Keep the rank from original position
            return { ...avgHuman, rank: entry.rank };
          }
        }
        return entry;
      });
    } catch (error) {
      console.error('Error loading speedrunning leaderboard:', error);
      this.showError();
    }
  }

  bindEvents() {
    if (this.elements.viewModeSelect) {
      this.elements.viewModeSelect.addEventListener('change', () => {
        this.changeViewMode();
      });
    }

    if (this.elements.milestoneSelect) {
      this.elements.milestoneSelect.addEventListener('change', () => {
        this.render();
      });
    }
  }

  changeViewMode() {
    this.currentViewMode = this.elements.viewModeSelect.value;
    
    if (this.currentViewMode === 'milestones') {
      this.elements.milestoneSelect.style.display = 'inline-block';
      this.elements.milestoneLabel.style.display = 'inline-block';
      this.elements.viewDescription.innerHTML = '<strong>Milestone Splits View:</strong> Shows detailed progress through each milestone with sub-milestone completion. Teams that reach later milestones rank higher.';
    } else {
      this.elements.milestoneSelect.style.display = 'none';
      this.elements.milestoneLabel.style.display = 'none';
      this.elements.viewDescription.innerHTML = '<strong>Overall Progress View:</strong> Shows completion percentage and total runtime summed across completed milestones. Teams with multiple submissions show their best combined milestone times.';
    }
    
    this.render();
  }

  render(filterMilestone = 'all') {
    if (!this.elements.tableBody) return;
    
    if (!this.data || this.data.length === 0) {
      this.elements.tableBody.innerHTML = this.getNoDataRow();
      return;
    }

    // Get filter value from select element
    if (this.elements.milestoneSelect && this.currentViewMode === 'milestones') {
      filterMilestone = this.elements.milestoneSelect.value;
    }

    // Update headers
    this.updateHeaders();
    
    // Process and render data based on view mode
    const processedData = this.currentViewMode === 'overall' ? 
      this.processOverallData() : 
      this.processMilestoneData(filterMilestone);
    
    // Render rows
    this.elements.tableBody.innerHTML = processedData.length > 0 ?
      processedData.map((entry, index) => 
        this.currentViewMode === 'overall' ?
          this.renderOverallRow(entry, index + 1) :
          this.renderMilestoneRow(entry, index + 1)
      ).join('') :
      this.getEmptyResultRow();
  }

  updateHeaders() {
    if (!this.elements.tableHeader) return;
    
    if (this.currentViewMode === 'overall') {
      this.elements.tableHeader.innerHTML = `
        <tr>
          <th style="padding: 12px 15px; font-size: 0.9rem; font-weight: 600; color: #4a5568; text-align: left;">Rank</th>
          <th style="padding: 12px 15px; font-size: 0.9rem; font-weight: 600; color: #4a5568; text-align: left;">Team</th>
          <th style="padding: 12px 15px; font-size: 0.9rem; font-weight: 600; color: #4a5568; text-align: center;">Progress (First Gym)</th>
          <th style="padding: 12px 15px; font-size: 0.9rem; font-weight: 600; color: #4a5568; text-align: center;">Total Runtime</th>
          <th style="padding: 12px 15px; font-size: 0.9rem; font-weight: 600; color: #4a5568; text-align: center;">Details</th>
        </tr>`;
    } else {
      const filterMilestone = this.elements.milestoneSelect ? this.elements.milestoneSelect.value : 'all';
      const timeColumnHeader = filterMilestone === 'all' ? 'Total Runtime' : 'Split Time';
      this.elements.tableHeader.innerHTML = `
        <tr>
          <th style="padding: 12px 15px; font-size: 0.9rem; font-weight: 600; color: #4a5568; text-align: left;">Rank</th>
          <th style="padding: 12px 15px; font-size: 0.9rem; font-weight: 600; color: #4a5568; text-align: left;">Team</th>
          <th style="padding: 12px 15px; font-size: 0.9rem; font-weight: 600; color: #4a5568; text-align: center;">Milestone Progress</th>
          <th style="padding: 12px 15px; font-size: 0.9rem; font-weight: 600; color: #4a5568; text-align: center;">${timeColumnHeader}</th>
          <th style="padding: 12px 15px; font-size: 0.9rem; font-weight: 600; color: #4a5568; text-align: center;">Video</th>
        </tr>`;
    }
  }

  processOverallData() {
    return this.data.map(entry => {
      let totalDurationMs = 0;
      let phasesCompleted = 0;
      let totalPhases = 7;
      const phaseOrder = Object.keys(this.phaseNames);
      const useSplitTimes = this.splitTimeTeams.includes(entry.team);

      if (entry.phase_splits) {
        if (useSplitTimes) {
          // For teams using split times (Avg Human), duration represents split times that need to be summed
          phaseOrder.forEach(phaseKey => {
            const phase = entry.phase_splits[phaseKey];
            if (phase && phase.completed > 0) {
              // Use duration for baselines (split times), not endTime
              const timeToUse = phase.duration;
              if (timeToUse && timeToUse !== '-') {
                const seconds = this.parseTimeToSeconds(timeToUse);
                if (!isNaN(seconds) && isFinite(seconds) && seconds > 0) {
                  totalDurationMs += seconds * 1000;
                }
              }
              if (phase.completed === phase.total) {
                phasesCompleted++;
              }
            }
          });
        } else {
          // For regular entries, endTime is cumulative, so use the latest one
          let latestEndTime = null;
          phaseOrder.forEach(phaseKey => {
            const phase = entry.phase_splits[phaseKey];
            if (phase && phase.completed > 0) {
              const timeToUse = phase.endTime || phase.duration;
              if (timeToUse && timeToUse !== '-') {
                latestEndTime = timeToUse;
              }
              if (phase.completed === phase.total) {
                phasesCompleted++;
              }
            }
          });

          // Convert latest endTime to milliseconds
          if (latestEndTime) {
            const seconds = this.parseTimeToSeconds(latestEndTime);
            if (!isNaN(seconds) && isFinite(seconds) && seconds > 0) {
              totalDurationMs = seconds * 1000;
            }
          }
        }
      }

      // Calculate more granular completion percentage based on milestones
      let totalMilestonesCompleted = 0;
      // Calculate total possible milestones across ALL phases (not just completed ones)
      let totalMilestonesPossible = 0;

      // First, calculate the total possible milestones from the phase structure
      phaseOrder.forEach(phaseKey => {
        const milestones = this.phaseMilestones[phaseKey];
        totalMilestonesPossible += milestones ? milestones.length : 0;
      });

      // Then count how many milestones were actually completed
      if (entry.phase_splits) {
        phaseOrder.forEach(phaseKey => {
          const phase = entry.phase_splits[phaseKey];
          if (phase) {
            totalMilestonesCompleted += phase.completed || 0;
          }
        });
      }

      const granularCompletionPercent = totalMilestonesPossible > 0 ?
        (totalMilestonesCompleted / totalMilestonesPossible) * 100 : 0;

      return {
        team: entry.team,
        completionPercent: entry.completion_percent,
        granularCompletionPercent: granularCompletionPercent,
        runtime: this.formatDuration(totalDurationMs),
        timeInSeconds: totalDurationMs / 1000,
        video: entry.video,
        submissionCount: entry.submission_count || 1,
        phaseSplits: entry.phase_splits || {},
        phasesCompleted: phasesCompleted,
        totalPhases: totalPhases,
        totalMilestonesCompleted: totalMilestonesCompleted,
        totalMilestonesPossible: totalMilestonesPossible
      };
    }).sort((a, b) => {
      // Primary sort: by granular completion percentage (milestones completed)
      if (b.granularCompletionPercent !== a.granularCompletionPercent) {
        return b.granularCompletionPercent - a.granularCompletionPercent;
      }
      // Secondary sort: by time (lower is better)
      // Handle cases where time might be 0 or invalid
      if (a.timeInSeconds === 0 && b.timeInSeconds === 0) return 0;
      if (a.timeInSeconds === 0) return 1; // entries with no time go to the bottom
      if (b.timeInSeconds === 0) return -1;
      return a.timeInSeconds - b.timeInSeconds;
    });
  }

  processMilestoneData(filterMilestone) {
    const phaseOrder = Object.keys(this.phaseNames);
    const processedData = [];
    
    this.data.forEach(entry => {
      if (!entry.phase_splits || Object.keys(entry.phase_splits).length === 0) return;
      
      if (filterMilestone === 'all') {
        // Process for furthest phase reached
        let latestPhase = null;
        let latestPhaseIndex = -1;
        let totalTimeMs = 0;
        let submilestoneDetails = {};
        const useSplitTimes = this.splitTimeTeams.includes(entry.team);

        for (let i = 0; i < phaseOrder.length; i++) {
          const phase = phaseOrder[i];
          const milestones = this.phaseMilestones[phase];
          submilestoneDetails[phase] = [];

          for (const milestone of milestones) {
            let splitTime = entry.milestone_splits && entry.milestone_splits[milestone.key] || null;
            submilestoneDetails[phase].push({
              name: milestone.name,
              key: milestone.key,
              time: splitTime,
              completed: splitTime !== null
            });
          }

          if (entry.phase_splits[phase] && entry.phase_splits[phase].completed > 0) {
            latestPhase = phase;
            latestPhaseIndex = i;

            if (useSplitTimes) {
              // For teams using split times, use duration and sum them
              const timeToUse = entry.phase_splits[phase].duration;
              if (timeToUse && timeToUse !== '-') {
                const seconds = this.parseTimeToSeconds(timeToUse);
                if (!isNaN(seconds) && isFinite(seconds) && seconds > 0) {
                  totalTimeMs += seconds * 1000;
                }
              }
            } else {
              // For regular entries, use endTime (cumulative), take the latest
              const timeToUse = entry.phase_splits[phase].endTime || entry.phase_splits[phase].duration;
              if (timeToUse && timeToUse !== '-') {
                const seconds = this.parseTimeToSeconds(timeToUse);
                if (!isNaN(seconds) && isFinite(seconds) && seconds > 0) {
                  totalTimeMs = seconds * 1000;
                }
              }
            }
          }
        }

        if (latestPhase) {
          const phaseSplit = entry.phase_splits[latestPhase];

          processedData.push({
            team: entry.team,
            phase: this.phaseNames[latestPhase],
            phaseKey: latestPhase,
            phaseIndex: latestPhaseIndex,
            phaseSplits: entry.phase_splits,
            submilestoneDetails: submilestoneDetails,
            completed: phaseSplit.completed,
            total: phaseSplit.total,
            splitTime: this.formatDuration(totalTimeMs),
            timeInSeconds: totalTimeMs / 1000,
            video: entry.video
          });
        }
      } else {
        // Process for specific phase
        const phaseIndex = phaseOrder.indexOf(filterMilestone);
        const phaseSplit = entry.phase_splits[filterMilestone];
        
        if (phaseSplit && phaseSplit.completed > 0) {
          let submilestoneDetails = {};
          submilestoneDetails[filterMilestone] = [];
          
          const milestones = this.phaseMilestones[filterMilestone];
          for (const milestone of milestones) {
            let splitTime = entry.milestone_splits && entry.milestone_splits[milestone.key] || null;
            submilestoneDetails[filterMilestone].push({
              name: milestone.name,
              key: milestone.key,
              time: splitTime,
              completed: splitTime !== null
            });
          }
          
          const phaseDuration = phaseSplit.duration || '-';
          const phaseDurationSeconds = phaseDuration !== '-' ? this.parseTimeToSeconds(phaseDuration) : 0;
          
          processedData.push({
            team: entry.team,
            phase: this.phaseNames[filterMilestone],
            phaseKey: filterMilestone,
            phaseIndex: phaseIndex,
            phaseSplits: entry.phase_splits,
            submilestoneDetails: submilestoneDetails,
            completed: phaseSplit.completed,
            total: phaseSplit.total,
            splitTime: phaseDuration,
            timeInSeconds: phaseDurationSeconds,
            video: entry.video
          });
        }
      }
    });
    
    return processedData.sort((a, b) => {
      if (filterMilestone === 'all' && a.phaseIndex !== b.phaseIndex) {
        return b.phaseIndex - a.phaseIndex;
      }
      if (a.completed !== b.completed) {
        return b.completed - a.completed;
      }
      return a.timeInSeconds - b.timeInSeconds;
    });
  }

  renderOverallRow(entry, rank) {
    const isOrgBaseline = this.organizerTeams.includes(entry.team);
    const orgBadge = isOrgBaseline ? this.getOrgBadge() : '';

    // Use granularCompletionPercent for both display and bar width
    const displayPercent = entry.granularCompletionPercent || entry.completionPercent || 0;

    const progressBar = `
      <div style="width: 100%; background: #e2e8f0; border-radius: 4px; overflow: hidden; height: 20px;">
        <div style="width: ${displayPercent}%; background: linear-gradient(90deg, #48bb78, #2f855a); height: 100%; display: flex; align-items: center; padding-left: 5px;">
          <span style="color: white; font-size: 0.8rem; font-weight: 600;">${displayPercent.toFixed(1)}%</span>
        </div>
      </div>`;
    
    const detailsCell = entry.video ? 
      `<a href="${entry.video}" target="_blank" style="color: #007bff; text-decoration: none;"><i class="fab fa-youtube"></i> Video</a>` : 
      `<span style="color: #666; font-size: 0.85rem;">${entry.submissionCount} run${entry.submissionCount > 1 ? 's' : ''}</span>`;
    
    return `<tr style="border-bottom: 1px solid #e2e8f0;">
      <td style="padding: 15px; font-size: 0.9rem; color: #2d3748; font-weight: 600;">${rank}</td>
      <td style="padding: 15px; font-size: 0.9rem; color: #2d3748; font-weight: 500;">${entry.team}${orgBadge}</td>
      <td style="padding: 15px;">${progressBar}</td>
      <td style="padding: 15px; font-size: 0.9rem; color: #2d3748; text-align: center; font-weight: 600;">${entry.runtime}</td>
      <td style="padding: 15px; font-size: 0.9rem; text-align: center;">${detailsCell}</td>
    </tr>`;
  }

  renderMilestoneRow(entry, rank) {
    const isOrgBaseline = this.organizerTeams.includes(entry.team);
    const orgBadge = isOrgBaseline ? this.getOrgBadge() : '';
    
    const phaseDisplay = this.renderPhaseProgress(entry);
    const videoCell = entry.video ? 
      `<a href="${entry.video}" target="_blank" style="color: #007bff; text-decoration: none;">Watch</a>` : 
      '-';
    
    return `<tr style="border-bottom: 1px solid #e2e8f0;">
      <td style="padding: 15px; font-size: 0.9rem; color: #2d3748; font-weight: 600;">${rank}</td>
      <td style="padding: 15px; font-size: 0.9rem; color: #2d3748; font-weight: 500;">${entry.team}${orgBadge}</td>
      <td style="padding: 15px;">${phaseDisplay}</td>
      <td style="padding: 15px; font-size: 0.9rem; color: #2d3748; text-align: center; font-weight: 600;">${entry.splitTime || '-'}</td>
      <td style="padding: 15px; font-size: 0.9rem; color: #2d3748; text-align: center;">${videoCell}</td>
    </tr>`;
  }

  renderPhaseProgress(entry) {
    const phaseOrder = Object.keys(this.phaseNames);
    let html = '<div style="width: 100%;">';
    
    // Main milestone progress circles
    html += '<div style="display: flex; gap: 4px; justify-content: center; align-items: center; margin-bottom: 8px;">';
    for (const phase of phaseOrder) {
      const phaseSplit = entry.phaseSplits[phase];
      let phaseColor = '#e2e8f0'; // Default gray
      let phaseTitle = this.phaseNames[phase];
      
      if (phaseSplit && phaseSplit.completed > 0) {
        const completionRatio = phaseSplit.completed / phaseSplit.total;
        phaseColor = completionRatio === 1 ? '#48bb78' : '#f6ad55';
        phaseTitle += ` (${phaseSplit.completed}/${phaseSplit.total})`;
      }
      
      const phaseNum = phaseOrder.indexOf(phase) + 1;
      html += `<div style="width: 30px; height: 30px; background: ${phaseColor}; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 0.8rem;" title="${phaseTitle}">${phaseNum}</div>`;
    }
    html += '</div>';
    
    // Sub-milestone progress if applicable
    const filterMilestone = this.elements.milestoneSelect ? this.elements.milestoneSelect.value : 'all';
    if (filterMilestone !== 'all' || entry.phaseIndex >= 0) {
      const targetPhase = filterMilestone !== 'all' ? filterMilestone : entry.phaseKey;
      const submilestones = entry.submilestoneDetails[targetPhase];
      
      if (submilestones && submilestones.length > 0) {
        const completedCount = submilestones.filter(s => s.completed).length;
        html += '<div style="font-size: 0.75rem; color: #666; text-align: center;">';
        html += '<div style="display: flex; gap: 2px; justify-content: center; margin-top: 4px;">';
        
        for (const submilestone of submilestones) {
          const bgColor = submilestone.completed ? '#48bb78' : '#e2e8f0';
          const tooltip = `${submilestone.name}: ${submilestone.time || 'not reached'}`;
          html += `<div style="width: 8px; height: 8px; background: ${bgColor}; border-radius: 2px;" title="${tooltip}"></div>`;
        }
        
        html += '</div>';
        html += `<span style="margin-top: 2px; display: block;">${this.phaseNames[targetPhase]} Progress: ${completedCount}/${submilestones.length}</span>`;
        html += '</div>';
      }
    }
    
    html += '</div>';
    return html;
  }

  getOrgBadge() {
    return '<span style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 1px 4px; border-radius: 3px; font-size: 0.6rem; font-weight: 600; margin-left: 4px; vertical-align: middle; display: inline-block;">ORG</span>';
  }

  parseTimeToSeconds(timeStr) {
    if (!timeStr || timeStr === '-') return Infinity;
    
    const parts = timeStr.split(':').map(p => parseInt(p) || 0);
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    } else {
      return parts[0] || 0;
    }
  }

  formatDuration(durationMs) {
    if (durationMs <= 0) return '-';
    
    const totalSeconds = Math.floor(durationMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else {
      return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
  }

  getNoDataRow() {
    return `<tr style="border-bottom: 1px solid #e2e8f0;">
      <td style="padding: 15px; color: #718096;" colspan="5">No leaderboard data available</td>
    </tr>`;
  }

  getEmptyResultRow() {
    const message = this.currentViewMode === 'milestones' && this.elements.milestoneSelect?.value !== 'all' ? 
                   'No entries found for selected phase' :
                   'No entries found';
    return `<tr style="border-bottom: 1px solid #e2e8f0;">
      <td style="padding: 15px; color: #718096;" colspan="5">${message}</td>
    </tr>`;
  }

  showError() {
    if (this.elements.tableBody) {
      this.elements.tableBody.innerHTML = `<tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 15px; color: #718096;" colspan="5">Error loading speedrunning leaderboard data</td>
      </tr>`;
    }
  }
}

export default SpeedrunningLeaderboard;