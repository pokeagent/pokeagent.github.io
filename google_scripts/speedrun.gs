function generateLeaderboardJSON() {
  Logger.log("=== Starting generateLeaderboardJSON ===");
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Form Responses 1");
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const rows = data.slice(1);
  Logger.log(`Found ${rows.length} rows to process`);

  const teamCol = headers.indexOf("Team Name");
  const runtimeCol = headers.indexOf("Runtime");
  const pctCol = headers.indexOf("Completion Percentage (%)");
  const logFileCol = headers.indexOf("Log File (submission.log)");
  const videoCol = headers.indexOf("YouTube Video Link (full run)");
  const tsCol = headers.indexOf("Timestamp");

  // Team display name mapping
  const TEAM_DISPLAY_NAMES = {
    'human': 'Avg Human',
    'pokeagent': 'PokeAgent'
  };

  function getDisplayName(teamName) {
    return TEAM_DISPLAY_NAMES[teamName.toLowerCase()] || teamName;
  }

  // Group rows by team name first to combine multiple submissions
  const teamSubmissions = {};

  rows.forEach((row, index) => {
    const teamName = row[teamCol];
    if (!teamName) return;

    const hasLog = !!row[logFileCol];
    const hasVideo = !!row[videoCol];

    // Initialize team entry if not exists
    if (!teamSubmissions[teamName]) {
      teamSubmissions[teamName] = {
        team: getDisplayName(teamName),
        submissions: [],
        bestRuntime: null,
        bestRuntimeMs: Infinity,
        bestCompletion: 0,
        combinedMilestoneSplits: {},
        latestVideo: null,
        latestTimestamp: null
      };
    }
    
    // Add this submission to the team's list
    teamSubmissions[teamName].submissions.push({
      row: row,
      index: index,
      timestamp: new Date(row[tsCol])
    });
  });
  
  // Define phases for split-based combining
  const PHASE_DEFINITIONS = {
    'Phase_1_Game_Initialization': ['GAME_RUNNING', 'PLAYER_NAME_SET', 'INTRO_CUTSCENE_COMPLETE'],
    'Phase_2_Tutorial_Starting_Town': ['LITTLEROOT_TOWN', 'PLAYER_HOUSE_ENTERED', 'PLAYER_BEDROOM', 'RIVAL_HOUSE', 'RIVAL_BEDROOM'],
    'Phase_3_Professor_Birch_Starter': ['ROUTE_101', 'STARTER_CHOSEN', 'BIRCH_LAB_VISITED'],
    'Phase_4_Rival': ['OLDALE_TOWN', 'ROUTE_103', 'RECEIVED_POKEDEX'],
    'Phase_5_Route_102_Petalburg': ['ROUTE_102', 'PETALBURG_CITY', 'DAD_FIRST_MEETING', 'GYM_EXPLANATION'],
    'Phase_6_Road_to_Rustboro_City': ['ROUTE_104_SOUTH', 'PETALBURG_WOODS', 'TEAM_AQUA_GRUNT_DEFEATED', 'ROUTE_104_NORTH', 'RUSTBORO_CITY'],
    'Phase_7_First_Gym_Challenge': ['RUSTBORO_GYM_ENTERED', 'ROXANNE_DEFEATED', 'FIRST_GYM_COMPLETE']
  };

  // Process each team's submissions to find best splits
  const leaderboard = Object.values(teamSubmissions)
    .map(teamData => {
      let latestVideo = null;
      let latestTimestamp = null;

      // Store parsed data for each submission
      const parsedSubmissions = [];

      // Process all submissions for this team
      teamData.submissions.forEach(submission => {
        const row = submission.row;
        let runtimeStr = row[runtimeCol];
        let completion = row[pctCol] ? parseFloat(row[pctCol]) : 0;
        let milestoneSplits = {};
        let phaseSplits = {};

        // Update latest video and timestamp
        if (row[videoCol] && (row[videoCol].includes('youtube.com') || row[videoCol].includes('youtu.be'))) {
          if (!latestTimestamp || submission.timestamp > latestTimestamp) {
            latestVideo = row[videoCol];
            latestTimestamp = submission.timestamp;
          }
        }

        if (row[logFileCol]) {
          try {
            let logContent = '';
            const fileUrl = row[logFileCol].toString().trim();
            Logger.log(`Processing log file for ${row[teamCol]}: ${fileUrl}`);

            if (fileUrl.includes('drive.google.com') || fileUrl.includes('docs.google.com')) {
              Logger.log(`Fetching from Google Drive...`);
              logContent = getGoogleDriveFileContent(fileUrl);
            } else {
              Logger.log(`Fetching from URL...`);
              logContent = UrlFetchApp.fetch(fileUrl).getContentText();
            }

            Logger.log(`Log content length: ${logContent.length} characters`);
            const logData = parseSubmissionLog(logContent);
            Logger.log(`Parsed log data: runtime="${logData.runtime}", completion=${logData.completionPercent}%`);

            if (logData.runtime && !runtimeStr) {
              runtimeStr = logData.runtime;
            }

            if (logData.completionPercent > 0 && (!completion || logData.completionPercent > completion)) {
              completion = logData.completionPercent;
            }

            if (logData.milestoneSplits) {
              milestoneSplits = logData.milestoneSplits;
            }

            if (logData.phaseSplits) {
              phaseSplits = logData.phaseSplits;
            }
          } catch (e) {
            Logger.log(`Error parsing log file for ${row[teamCol]}: ${e}`);
          }
        }

        parsedSubmissions.push({
          submissionId: submission.index, // Track which submission this is
          runtimeStr: runtimeStr,
          completion: completion,
          milestoneSplits: milestoneSplits,
          phaseSplits: phaseSplits
        });
      });

      // Now combine using best split per phase, tracking which submission was used
      let combinedMilestoneSplits = {};
      let combinedPhaseSplits = {};
      let phaseSourceSubmissions = {}; // Track which submission was used for each phase
      let bestCompletion = 0;
      let bestRuntimeStr = null;
      let bestRuntimeMs = Infinity;

      // For each phase, find the submission that completed it fastest
      Object.entries(PHASE_DEFINITIONS).forEach(([phaseName, phaseMilestones]) => {
        let bestPhaseSubmission = null;
        let bestPhaseCompletionTime = Infinity;
        let bestPhaseProgress = 0;

        // Find the last milestone in this phase
        const lastMilestone = phaseMilestones[phaseMilestones.length - 1];

        parsedSubmissions.forEach(subm => {
          // Count how many milestones from this phase were completed
          const completedCount = phaseMilestones.filter(m => subm.milestoneSplits[m]).length;

          if (completedCount > 0) {
            // Get the completion time (time at the last milestone reached in this phase)
            let phaseCompletionTime = Infinity;
            for (let i = phaseMilestones.length - 1; i >= 0; i--) {
              if (subm.milestoneSplits[phaseMilestones[i]]) {
                phaseCompletionTime = parseRuntime(subm.milestoneSplits[phaseMilestones[i]]);
                break;
              }
            }

            // Pick this submission if it progressed further, or same progress but faster
            if (completedCount > bestPhaseProgress ||
                (completedCount === bestPhaseProgress && phaseCompletionTime < bestPhaseCompletionTime)) {
              bestPhaseSubmission = subm;
              bestPhaseCompletionTime = phaseCompletionTime;
              bestPhaseProgress = completedCount;
            }
          }
        });

        // Use milestones from the best submission for this phase
        if (bestPhaseSubmission) {
          phaseSourceSubmissions[phaseName] = bestPhaseSubmission.submissionId; // Track source
          phaseMilestones.forEach(milestone => {
            if (bestPhaseSubmission.milestoneSplits[milestone]) {
              combinedMilestoneSplits[milestone] = bestPhaseSubmission.milestoneSplits[milestone];
            }
          });

          // Phase splits will be calculated after cumulative times are computed
        }
      });

      // Fill in missing milestones between completed ones
      Logger.log(`\n=== Filling missing milestones ===`);
      const MILESTONE_ORDER_LIST = Object.values(PHASE_DEFINITIONS).flat();

      for (let i = 0; i < MILESTONE_ORDER_LIST.length; i++) {
        const currentMilestone = MILESTONE_ORDER_LIST[i];

        // If this milestone is missing, check if there's a later milestone
        if (!combinedMilestoneSplits[currentMilestone]) {
          // Find the next completed milestone
          for (let j = i + 1; j < MILESTONE_ORDER_LIST.length; j++) {
            const laterMilestone = MILESTONE_ORDER_LIST[j];
            if (combinedMilestoneSplits[laterMilestone]) {
              // Found a later completed milestone - fill in the gap
              combinedMilestoneSplits[currentMilestone] = combinedMilestoneSplits[laterMilestone];
              Logger.log(`Filled ${currentMilestone} with time from ${laterMilestone}: ${combinedMilestoneSplits[laterMilestone]}`);
              break;
            }
          }
        }
      }

      // Calculate cumulative times by adding delta between consecutive milestones
      Logger.log(`\n=== Calculating cumulative times from milestone deltas ===`);
      let cumulativeTimeMs = 0;
      let previousMilestoneSubmissionId = null;
      let previousMilestoneTimeInFile = 0;

      // Track actual time added per phase for phase splits
      const phaseActualDurations = {};
      for (const phaseName in PHASE_DEFINITIONS) {
        phaseActualDurations[phaseName] = 0;
      }

      // Process each milestone in sequence (MILESTONE_ORDER_LIST already defined above)
      MILESTONE_ORDER_LIST.forEach((milestone, index) => {
        if (!combinedMilestoneSplits[milestone]) return;

        const originalTimeMs = parseRuntime(combinedMilestoneSplits[milestone]);

        // Special case: GAME_RUNNING is always 00:00
        if (milestone === 'GAME_RUNNING') {
          combinedMilestoneSplits[milestone] = '00:00';
          Logger.log(`${milestone}: 00:00 (starting point)`);
          return;
        }

        // Find which phase and submission this milestone belongs to
        let currentMilestoneSubmissionId = null;
        let currentPhaseName = null;
        for (const phaseName in PHASE_DEFINITIONS) {
          const phaseMilestones = PHASE_DEFINITIONS[phaseName];
          if (phaseMilestones.indexOf(milestone) >= 0) {
            currentMilestoneSubmissionId = phaseSourceSubmissions[phaseName];
            currentPhaseName = phaseName;
            break;
          }
        }

        // Special case: LITTLEROOT_TOWN marks phase transition
        if (milestone === 'LITTLEROOT_TOWN') {
          combinedMilestoneSplits[milestone] = formatMsToTime(cumulativeTimeMs);
          Logger.log(`${milestone}: ${formatMsToTime(cumulativeTimeMs)} (phase transition)`);
          previousMilestoneSubmissionId = currentMilestoneSubmissionId;
          previousMilestoneTimeInFile = originalTimeMs;
          return;
        }

        // Check if we're continuing from the same submission or switching
        const sameSubmission = (previousMilestoneSubmissionId === currentMilestoneSubmissionId);

        if (sameSubmission && index > 0) {
          // Same submission: add the delta from previous milestone
          const deltaMs = originalTimeMs - previousMilestoneTimeInFile;

          // Only add positive deltas (milestones can be out of order due to gap filling or inference)
          if (deltaMs >= 0) {
            // Delta is 0 or positive - this is normal progression
            if (deltaMs > 0) {
              cumulativeTimeMs += deltaMs;
              if (currentPhaseName) phaseActualDurations[currentPhaseName] += deltaMs;
              Logger.log(`${milestone}: ${combinedMilestoneSplits[milestone]} → ${formatMsToTime(cumulativeTimeMs)} (same submission, +${formatMsToTime(deltaMs)})`);
            } else {
              // Delta is exactly 0 - same time as previous milestone
              Logger.log(`${milestone}: ${combinedMilestoneSplits[milestone]} → ${formatMsToTime(cumulativeTimeMs)} (same submission, same time as previous)`);
            }
            // Update tracking for both zero and positive deltas
            previousMilestoneTimeInFile = originalTimeMs;
          } else {
            // Milestone appeared earlier than previous - use current cumulative time
            // Don't update previousMilestoneTimeInFile to maintain the correct reference point
            Logger.log(`${milestone}: ${combinedMilestoneSplits[milestone]} → ${formatMsToTime(cumulativeTimeMs)} (same submission, out of order, delta=${formatMsToTime(deltaMs)})`);
          }
        } else {
          // Different submission: this is a fresh start, add the full time
          cumulativeTimeMs += originalTimeMs;
          if (currentPhaseName) phaseActualDurations[currentPhaseName] += originalTimeMs;
          Logger.log(`${milestone}: ${combinedMilestoneSplits[milestone]} → ${formatMsToTime(cumulativeTimeMs)} (new submission, +${formatMsToTime(originalTimeMs)})`);
          previousMilestoneTimeInFile = originalTimeMs;
        }

        // Update the milestone to its cumulative time
        combinedMilestoneSplits[milestone] = formatMsToTime(cumulativeTimeMs);

        // Track submission for next iteration
        previousMilestoneSubmissionId = currentMilestoneSubmissionId;
      });

      Logger.log(`\nFinal cumulative time: ${formatMsToTime(cumulativeTimeMs)}`);

      // Calculate phase splits using actual durations
      Logger.log(`\n=== Calculating phase splits ===`);
      Object.entries(PHASE_DEFINITIONS).forEach(([phaseName, phaseMilestones]) => {
        const completedCount = phaseMilestones.filter(m => combinedMilestoneSplits[m]).length;

        if (completedCount > 0) {
          // Find the end time for this phase (max cumulative time among completed milestones)
          let phaseEndTime = null;

          phaseMilestones.forEach(milestone => {
            if (combinedMilestoneSplits[milestone]) {
              const timeMs = parseRuntime(combinedMilestoneSplits[milestone]);
              if (phaseEndTime === null || timeMs > phaseEndTime) {
                phaseEndTime = timeMs;
              }
            }
          });

          if (phaseEndTime !== null) {
            // Use the actual duration tracked during cumulative calculation
            const phaseDurationMs = phaseActualDurations[phaseName] || 0;
            combinedPhaseSplits[phaseName] = {
              completed: completedCount,
              total: phaseMilestones.length,
              duration: formatMsToTime(phaseDurationMs),
              endTime: formatMsToTime(phaseEndTime)
            };
            Logger.log(`${phaseName}: ${completedCount}/${phaseMilestones.length} milestones, duration=${formatMsToTime(phaseDurationMs)}, endTime=${formatMsToTime(phaseEndTime)}`);
          }
        }
      });

      // Calculate completion and runtime based on COMBINED milestones
      const totalMilestones = Object.values(PHASE_DEFINITIONS).flat().length;
      const completedMilestones = Object.keys(combinedMilestoneSplits).filter(m =>
        Object.values(PHASE_DEFINITIONS).flat().includes(m)
      ).length;
      const calculatedCompletion = Math.round((completedMilestones / totalMilestones) * 100);

      // Find the furthest runtime reached in combined splits
      let furthestRuntimeMs = 0;
      let furthestRuntimeStr = null;
      Object.values(combinedMilestoneSplits).forEach(timeStr => {
        const timeMs = parseRuntime(timeStr);
        if (timeMs > furthestRuntimeMs) {
          furthestRuntimeMs = timeMs;
          furthestRuntimeStr = timeStr;
        }
      });

      Logger.log(`Team ${teamData.team}: ${teamData.submissions.length} submissions`);
      Logger.log(`  Combined: ${completedMilestones}/${totalMilestones} milestones (${calculatedCompletion}%)`);
      Logger.log(`  Furthest time: ${furthestRuntimeStr}`);

      return {
        team: teamData.team,
        runtimeStr: furthestRuntimeStr,
        runtimeMs: furthestRuntimeMs,
        completion: calculatedCompletion,
        video: latestVideo,
        timestamp: latestTimestamp ? latestTimestamp.toISOString() : new Date().toISOString(),
        milestoneSplits: combinedMilestoneSplits,
        phaseSplits: combinedPhaseSplits,
        submissionCount: teamData.submissions.length
      };
    })
    .filter(entry => {
      const valid = entry.runtimeStr && entry.runtimeMs > 0 && entry.completion > 0;
      Logger.log(`Final filter for ${entry.team}: runtime="${entry.runtimeStr}" (${entry.runtimeMs}ms), completion=${entry.completion}%, valid=${valid}`);
      return valid;
    })
    .sort((a, b) => {
      if (b.completion !== a.completion) {
        return b.completion - a.completion; // sort by completion DESC
      }
      return a.runtimeMs - b.runtimeMs; // then runtime ASC
    })
    .map((entry, index) => {
      const result = {
        rank: index + 1,
        team: entry.team,
        completion_percent: entry.completion,
        runtime: entry.runtimeStr || formatMsToTime(entry.runtimeMs), // Use original format or convert
        last_updated: entry.timestamp
      };
      
      // Only include video if it's a valid YouTube link
      if (entry.video && (entry.video.includes('youtube.com') || entry.video.includes('youtu.be'))) {
        result.video = entry.video;
      }
      // If no valid video, explicitly set to null so JSON includes the field
      if (!result.video) {
        result.video = null;
      }
      
      // Add ALL milestone splits from MILESTONES.md organized by phase
      const allMilestones = [
        // Phase 1: Game Initialization
        'GAME_RUNNING', 'PLAYER_NAME_SET', 'INTRO_CUTSCENE_COMPLETE',
        // Phase 2: Tutorial & Starting Town
        'LITTLEROOT_TOWN', 'PLAYER_HOUSE_ENTERED', 'PLAYER_BEDROOM', 'RIVAL_HOUSE', 'RIVAL_BEDROOM',
        // Phase 3: Professor Birch & Starter
        'ROUTE_101', 'STARTER_CHOSEN', 'BIRCH_LAB_VISITED',
        // Phase 4: Rival
        'OLDALE_TOWN', 'ROUTE_103', 'RECEIVED_POKEDEX',
        // Phase 5: Route 102 & Petalburg
        'ROUTE_102', 'PETALBURG_CITY', 'DAD_FIRST_MEETING', 'GYM_EXPLANATION',
        // Phase 6: Road to Rustboro City
        'ROUTE_104_SOUTH', 'PETALBURG_WOODS', 'TEAM_AQUA_GRUNT_DEFEATED', 'ROUTE_104_NORTH', 'RUSTBORO_CITY',
        // Phase 7: First Gym Challenge
        'RUSTBORO_GYM_ENTERED', 'ROXANNE_DEFEATED', 'FIRST_GYM_COMPLETE'
      ];
      
      // Add all milestone splits - initialize to null first
      result.milestone_splits = {};
      allMilestones.forEach(milestone => {
        result.milestone_splits[milestone] = null;
      });
      
      // Then populate with actual data if available
      allMilestones.forEach(milestone => {
        if (entry.milestoneSplits[milestone]) {
          result.milestone_splits[milestone] = entry.milestoneSplits[milestone];
        }
      });
      
      // Add phase splits if available
      if (entry.phaseSplits) {
        result.phase_splits = entry.phaseSplits;
      }
      
      // Add submission count for transparency
      if (entry.submissionCount) {
        result.submission_count = entry.submissionCount;
      }
      
      return result;
    });

  Logger.log(`=== Final leaderboard has ${leaderboard.length} entries ===`);
  const result = JSON.stringify(leaderboard, null, 2);
  Logger.log(`JSON output:\n${result}`);
  return result;
}

function updateLeaderboardAndPush() {
  const repo = PropertiesService.getScriptProperties().getProperty("GITHUB_REPO");
  const branch = PropertiesService.getScriptProperties().getProperty("GITHUB_BRANCH");
  const token = PropertiesService.getScriptProperties().getProperty("GITHUB_TOKEN");

  const leaderboard = generateLeaderboardJSON();  // <-- from prior message
  // GitHub API expects standard base64 encoding (not web-safe)
  const content = Utilities.base64Encode(leaderboard);

  const path = "leaderboard/speedrunning.json";
  const sha = getFileSha(repo, path, branch, token); // get previous SHA for commit

  const payload = {
    message: "Update speedrunning leaderboard",
    content: content,
    branch: branch,
    committer: {
      name: "Leaderboard Bot",
      email: "pokeagentchallenge@gmail.com"
    }
  };
  if (sha) payload.sha = sha;

  const url = `https://api.github.com/repos/${repo}/contents/${path}`;
  const options = {
    method: "put",
    contentType: "application/json",
    headers: {
      Authorization: `Bearer ${token}`
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const res = UrlFetchApp.fetch(url, options);
  Logger.log(res.getContentText());
}

function getFileSha(repo, path, branch, token) {
  const url = `https://api.github.com/repos/${repo}/contents/${path}?ref=${branch}`;
  const res = UrlFetchApp.fetch(url, {
    method: "get",
    headers: { Authorization: `Bearer ${token}` },
    muteHttpExceptions: true
  });
  if (res.getResponseCode() === 200) {
    const json = JSON.parse(res.getContentText());
    return json.sha;
  }
  return null;
}

function parseRuntime(str) {
  if (!str || typeof str !== 'string') {
    return 0;
  }
  const parts = str.split(':').reverse();
  let ms = 0;
  if (parts.length >= 1) ms += parseFloat(parts[0]) * 1000;
  if (parts.length >= 2) ms += parseInt(parts[1]) * 60 * 1000;
  if (parts.length >= 3) ms += parseInt(parts[2]) * 60 * 60 * 1000;
  return ms;
}

function formatMsToTime(ms) {
  // Return '-' for null, undefined, or negative values
  if (ms == null || ms < 0) return '-';

  // Handle 0 and positive values
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  } else {
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
}

function getGoogleDriveFileContent(url) {
  Logger.log(`getGoogleDriveFileContent called with URL: ${url}`);
  let fileId = '';
  
  if (url.includes('drive.google.com/open?id=')) {
    fileId = url.split('id=')[1].split('&')[0];
    Logger.log(`Extracted fileId from open?id format: ${fileId}`);
  } else if (url.includes('drive.google.com/file/d/')) {
    fileId = url.split('/d/')[1].split('/')[0];
    Logger.log(`Extracted fileId from file/d/ format: ${fileId}`);
  } else if (url.includes('docs.google.com/')) {
    const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match) {
      fileId = match[1];
      Logger.log(`Extracted fileId from docs.google format: ${fileId}`);
    }
  }
  
  if (!fileId) {
    throw new Error('Could not extract file ID from Google Drive URL');
  }
  
  try {
    const file = DriveApp.getFileById(fileId);
    const content = file.getBlob().getDataAsString();
    Logger.log(`Successfully retrieved file content from Drive (${content.length} chars)`);
    return content;
  } catch (e) {
    Logger.log(`ERROR accessing Google Drive file: ${e.message}`);
    throw new Error(`Error accessing Google Drive file: ${e.message}`);
  }
}

function parseSubmissionLog(logContent) {
  /*
   * Parse a submission log file and extract milestone splits.
   *
   * IMPORTANT FIX: This function now handles cases where the MILESTONE field is not updating
   * but the MAP field has advanced. It infers milestones from the MAP field using location
   * mappings and ensures milestones are completed in the correct order.
   *
   * For example, if MILESTONE=LITTLEROOT_TOWN but MAP=LITTLEROOT TOWN BRENDANS HOUSE 1F,
   * we infer that PLAYER_HOUSE_ENTERED has been reached.
   */
  Logger.log(`parseSubmissionLog: Processing ${logContent.length} characters`);
  const lines = logContent.split('\n');
  Logger.log(`Found ${lines.length} lines in log file`);

  let model = '';
  let startTime = '';
  let runtime = '';
  let completionPercent = 0;
  let milestoneSplits = {};
  let phaseSplits = {};

  // Define phase milestones for tracking - exact names from MILESTONES.md
  const PHASE_DEFINITIONS = {
    'Phase_1_Game_Initialization': ['GAME_RUNNING', 'PLAYER_NAME_SET', 'INTRO_CUTSCENE_COMPLETE'],
    'Phase_2_Tutorial_Starting_Town': ['LITTLEROOT_TOWN', 'PLAYER_HOUSE_ENTERED', 'PLAYER_BEDROOM', 'RIVAL_HOUSE', 'RIVAL_BEDROOM'],
    'Phase_3_Professor_Birch_Starter': ['ROUTE_101', 'STARTER_CHOSEN', 'BIRCH_LAB_VISITED'],
    'Phase_4_Rival': ['OLDALE_TOWN', 'ROUTE_103', 'RECEIVED_POKEDEX'],
    'Phase_5_Route_102_Petalburg': ['ROUTE_102', 'PETALBURG_CITY', 'DAD_FIRST_MEETING', 'GYM_EXPLANATION'],
    'Phase_6_Road_to_Rustboro_City': ['ROUTE_104_SOUTH', 'PETALBURG_WOODS', 'TEAM_AQUA_GRUNT_DEFEATED', 'ROUTE_104_NORTH', 'RUSTBORO_CITY'],
    'Phase_7_First_Gym_Challenge': ['RUSTBORO_GYM_ENTERED', 'ROXANNE_DEFEATED', 'FIRST_GYM_COMPLETE']
  };

  const LOCATION_TO_MILESTONE = {
    'MOVING_VAN': 'INTRO_CUTSCENE_COMPLETE',
    'LITTLEROOT': 'LITTLEROOT_TOWN',
    'BRENDANS_HOUSE_1F': 'PLAYER_HOUSE_ENTERED',
    'BRENDANS_HOUSE_2F': 'PLAYER_BEDROOM',
    'MAYS_HOUSE_1F': 'RIVAL_HOUSE',
    'MAYS_HOUSE_2F': 'RIVAL_BEDROOM',
    'ROUTE_101': 'ROUTE_101',
    'ROUTE101': 'ROUTE_101',
    'BIRCHS_LAB': 'BIRCH_LAB_VISITED',
    'PROFESSOR_BIRCHS_LAB': 'BIRCH_LAB_VISITED',
    'OLDALE': 'OLDALE_TOWN',
    'ROUTE_103': 'ROUTE_103',
    'ROUTE103': 'ROUTE_103',
    'ROUTE_102': 'ROUTE_102',
    'ROUTE102': 'ROUTE_102',
    'PETALBURG_CITY_GYM': 'DAD_FIRST_MEETING',
    'PETALBURG_GYM': 'DAD_FIRST_MEETING',
    'PETALBURG': 'PETALBURG_CITY',
    'ROUTE_104': 'ROUTE_104_SOUTH',
    'ROUTE104': 'ROUTE_104_SOUTH',
    'PETALBURG_WOODS': 'PETALBURG_WOODS',
    'RUSTBORO_GYM': 'RUSTBORO_GYM_ENTERED',
    'RUSTBORO_CITY_GYM': 'RUSTBORO_GYM_ENTERED',
    'RUSTBORO': 'RUSTBORO_CITY'
  };

  function inferMilestoneFromMap(mapValue) {
    if (!mapValue) return null;

    // Normalize: uppercase and replace spaces with underscores for matching
    const upperMap = mapValue.toUpperCase().replace(/\s+/g, '_');

    // Check each location pattern in order of specificity (most specific first)
    const orderedLocations = [
      'BRENDANS_HOUSE_2F', 'BRENDANS_HOUSE_1F',
      'MAYS_HOUSE_2F', 'MAYS_HOUSE_1F',
      'PROFESSOR_BIRCHS_LAB', 'BIRCHS_LAB',
      'PETALBURG_CITY_GYM', 'PETALBURG_GYM',
      'RUSTBORO_CITY_GYM', 'RUSTBORO_GYM',
      'PETALBURG_WOODS',
      'ROUTE_101', 'ROUTE101',
      'ROUTE_102', 'ROUTE102',
      'ROUTE_103', 'ROUTE103',
      'ROUTE_104', 'ROUTE104',
      'MOVING_VAN',
      'OLDALE',
      'PETALBURG',
      'RUSTBORO',
      'LITTLEROOT'
    ];

    for (let i = 0; i < orderedLocations.length; i++) {
      const locationKey = orderedLocations[i];
      if (upperMap.includes(locationKey)) {
        return LOCATION_TO_MILESTONE[locationKey];
      }
    }
    return null;
  }

  // Find the header line first (looking for Format: line)
  let headerLine = null;
  let headerIndex = -1;
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    if (lines[i] && lines[i].includes('Format:') && lines[i].includes('RUNTIME') && lines[i].includes('MILESTONE')) {
      headerLine = lines[i].replace('Format: ', '');
      headerIndex = i;
      Logger.log(`Found header line at index ${i}: ${headerLine}`);
      break;
    }
  }
  
  if (!headerLine) {
    Logger.log('No Format header line found with RUNTIME and MILESTONE columns');
  }

  // Detect runtime resets (multiple runs in one log file)
  // If we detect a reset, we should only use milestones from the FIRST complete run
  let firstResetLineIndex = -1;
  let previousRuntimeMs = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('RUNTIME=')) {
      const rtMatch = line.match(/RUNTIME=([^\s]+)/);
      if (rtMatch) {
        const currentRuntimeMs = parseRuntime(rtMatch[1]);
        // If current runtime is significantly less than previous (went backwards), it's a reset
        if (previousRuntimeMs > 0 && currentRuntimeMs < previousRuntimeMs - 60000) { // More than 1 minute backwards
          Logger.log(`  Detected runtime reset at line ${i + 1}: ${formatMsToTime(previousRuntimeMs)} -> ${formatMsToTime(currentRuntimeMs)}`);
          if (firstResetLineIndex === -1) {
            firstResetLineIndex = i;
          }
        }
        previousRuntimeMs = currentRuntimeMs;
      }
    }
  }

  // If we found a reset, only parse lines BEFORE the first reset (use the first complete run)
  const linesToParse = firstResetLineIndex >= 0 ? lines.slice(0, firstResetLineIndex) : lines;
  if (firstResetLineIndex >= 0) {
    Logger.log(`  Using only lines before first reset (${linesToParse.length} lines, stopping at line ${firstResetLineIndex})`);
  }

  for (let i = 0; i < linesToParse.length; i++) {
    const line = linesToParse[i];
    
    if (line.includes('Model:')) {
      Logger.log(`Found model line at ${i}: ${line.substring(0, 100)}`);
      const match = line.match(/Model:\s*([^\|]+)\s*\|\s*Start Time:\s*(.+)/);
      if (match) {
        model = match[1].trim();
        startTime = match[2].trim();
        Logger.log(`Extracted model: ${model}, startTime: ${startTime}`);
      }
    }
    
    // Extract runtime from data lines (keep updating to get the latest)
    if (line.includes('STEP=') && line.includes('RUNTIME=') && headerLine) {
      const parts = line.split('|').map(p => p.trim());
      const headers = headerLine.split('|').map(h => h.trim());
      const runtimeIndex = headers.findIndex(h => h === 'RUNTIME');
      
      if (runtimeIndex >= 0 && runtimeIndex < parts.length) {
        const runtimeCell = parts[runtimeIndex];
        const runtimeMatch = runtimeCell.match(/RUNTIME=([^\s]+)/);
        if (runtimeMatch) {
          runtime = runtimeMatch[1].trim(); // Keep updating to get final runtime
        }
      }
    }
    
    // Skip header lines and process data lines
    if (line.includes('STEP=') && line.includes('MILESTONE=') && line.includes('RUNTIME=') && headerLine) {
      const headers = headerLine.split('|').map(h => h.trim());
      const parts = line.split('|').map(p => p.trim());

      // Extract milestone, map, and runtime
      const milestoneIndex = headers.findIndex(h => h === 'MILESTONE');
      const runtimeIndex = headers.findIndex(h => h === 'RUNTIME');
      const mapIndex = headers.findIndex(h => h === 'MAP');

      if (milestoneIndex >= 0 && runtimeIndex >= 0 &&
          milestoneIndex < parts.length && runtimeIndex < parts.length) {

        const milestoneCell = parts[milestoneIndex];
        const runtimeCell = parts[runtimeIndex];
        const mapCell = mapIndex >= 0 && mapIndex < parts.length ? parts[mapIndex] : null;

        // Extract milestone name from MILESTONE=VALUE format
        const milestoneMatch = milestoneCell.match(/MILESTONE=([^\s]+)/);
        const runtimeMatch = runtimeCell.match(/RUNTIME=([^\s]+)/);

        // Extract MAP value (capture everything after MAP=, including spaces)
        let mapValue = null;
        if (mapCell) {
          const mapMatch = mapCell.match(/MAP=(.+)/);
          if (mapMatch) {
            mapValue = mapMatch[1].trim();
          }
        }

        if (milestoneMatch && runtimeMatch) {
          const milestone = milestoneMatch[1].trim();
          const runtimeValue = runtimeMatch[1].trim();

          // Only record first occurrence of each milestone from MILESTONE field
          if (milestone !== 'NONE' && !milestoneSplits[milestone]) {
            milestoneSplits[milestone] = runtimeValue;
          }

          // Try to infer milestone from MAP field ONLY if the MILESTONE field is NONE
          // This prevents location inference from overriding explicit milestone markers
          if (milestone === 'NONE') {
            const inferredMilestone = inferMilestoneFromMap(mapValue);
            if (inferredMilestone && !milestoneSplits[inferredMilestone]) {
              milestoneSplits[inferredMilestone] = runtimeValue;
            }
          }
        }
      }
    }
    
    // Also check if STATE column contains percentage
    if (line.includes('STATE') && !line.includes('Format:') && lines[2]) {
      const parts = line.split('|').map(p => p.trim());
      const stateIndex = lines[2].split('|').findIndex(h => h.trim() === 'STATE');
      if (stateIndex >= 0 && parts[stateIndex]) {
        const stateMatch = parts[stateIndex].match(/(\d+(?:\.\d+)?)\s*%/);
        if (stateMatch) {
          const pct = parseFloat(stateMatch[1]);
          if (pct > completionPercent) {
            completionPercent = pct;
            Logger.log(`Found completion percentage in STATE at line ${i}: ${pct}%`);
          }
        }
      }
    }
  }
  
  // Calculate phase splits based on collected milestones
  for (const [phaseName, phaseMilestones] of Object.entries(PHASE_DEFINITIONS)) {
    let phaseStartTime = null;
    let phaseEndTime = null;
    let completedCount = 0;
    
    phaseMilestones.forEach(milestone => {
      if (milestoneSplits[milestone]) {
        completedCount++;
        const timeMs = parseRuntime(milestoneSplits[milestone]);
        
        if (phaseStartTime === null || timeMs < phaseStartTime) {
          phaseStartTime = timeMs;
        }
        if (phaseEndTime === null || timeMs > phaseEndTime) {
          phaseEndTime = timeMs;
        }
      }
    });
    
    if (completedCount > 0) {
      const phaseDuration = phaseEndTime - phaseStartTime;
      phaseSplits[phaseName] = {
        completed: completedCount,
        total: phaseMilestones.length,
        duration: formatMsToTime(phaseDuration),
        endTime: formatMsToTime(phaseEndTime)
      };
      
      Logger.log(`Phase ${phaseName}: ${completedCount}/${phaseMilestones.length} milestones, duration=${phaseSplits[phaseName].duration}`);
    }
  }
  
  // Update completion percentage based on milestone count if not already set
  const totalMilestones = Object.values(PHASE_DEFINITIONS).flat().length;
  const completedMilestones = Object.keys(milestoneSplits).filter(m => 
    Object.values(PHASE_DEFINITIONS).flat().includes(m)
  ).length;
  const calculatedCompletion = Math.round((completedMilestones / totalMilestones) * 100);
  
  if (calculatedCompletion > completionPercent) {
    completionPercent = calculatedCompletion;
    Logger.log(`Updated completion to ${completionPercent}% based on ${completedMilestones}/${totalMilestones} milestones`);
  }
  
  const result = {
    model: model,
    startTime: startTime,
    runtime: runtime,
    completionPercent: completionPercent,
    milestoneSplits: milestoneSplits,
    phaseSplits: phaseSplits
  };
  
  Logger.log(`parseSubmissionLog result: runtime="${runtime}", completion=${completionPercent}%`);
  Logger.log(`Milestone splits found: ${Object.keys(milestoneSplits).length} total`);
  Logger.log(`Phase splits found: ${Object.keys(phaseSplits).length} phases`);
  for (const [milestone, time] of Object.entries(milestoneSplits)) {
    Logger.log(`  ${milestone}: ${time}`);
  }
  
  return result;
}

