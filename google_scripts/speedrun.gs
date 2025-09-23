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
        team: teamName,
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
  
  // Process each team's submissions to find best times and combine splits
  const leaderboard = Object.values(teamSubmissions)
    .map(teamData => {
      let bestRuntimeStr = null;
      let bestCompletion = 0;
      let combinedMilestoneSplits = {};
      let combinedPhaseSplits = {};
      let latestVideo = null;
      let latestTimestamp = null;
      
      // Process all submissions for this team
      teamData.submissions.forEach(submission => {
        const row = submission.row;
        let runtimeStr = row[runtimeCol];
        let completion = row[pctCol] ? parseFloat(row[pctCol]) : 0;
        let milestoneSplits = {};
        
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
            Logger.log(`Using runtime from log: ${logData.runtime}`);
            runtimeStr = logData.runtime;
          }
          
          if (logData.completionPercent > 0 && (!completion || logData.completionPercent > completion)) {
            Logger.log(`Using completion from log: ${logData.completionPercent}%`);
            completion = logData.completionPercent;
          }
          
          if (logData.milestoneSplits) {
            milestoneSplits = logData.milestoneSplits;
            Logger.log(`Found ${Object.keys(milestoneSplits).length} milestone splits`);
          }
          
          if (logData.phaseSplits) {
            // Combine phase splits - keep the best completion for each phase
            Object.entries(logData.phaseSplits).forEach(([phaseName, phaseData]) => {
              if (!combinedPhaseSplits[phaseName] || 
                  phaseData.completed > combinedPhaseSplits[phaseName].completed) {
                combinedPhaseSplits[phaseName] = phaseData;
              }
            });
          }
        } catch (e) {
            Logger.log(`Error parsing log file for ${row[teamCol]}: ${e}`);
          }
        }
        
        // Update best runtime for this team
        if (runtimeStr) {
          const runtimeMs = parseRuntime(runtimeStr);
          if (runtimeMs > 0 && runtimeMs < teamData.bestRuntimeMs) {
            teamData.bestRuntimeMs = runtimeMs;
            bestRuntimeStr = runtimeStr;
          }
        }
        
        // Update best completion for this team
        if (completion > bestCompletion) {
          bestCompletion = completion;
        }
        
        // Combine milestone splits - keep the fastest time for each milestone
        Object.entries(milestoneSplits).forEach(([milestone, time]) => {
          if (!combinedMilestoneSplits[milestone]) {
            combinedMilestoneSplits[milestone] = time;
          } else {
            // Compare times and keep the faster one
            const existingMs = parseRuntime(combinedMilestoneSplits[milestone]);
            const newMs = parseRuntime(time);
            if (newMs > 0 && newMs < existingMs) {
              combinedMilestoneSplits[milestone] = time;
              Logger.log(`Updated ${milestone} split for ${teamData.team}: ${time} (was ${combinedMilestoneSplits[milestone]})`);}
          }
        });
      });
      
      Logger.log(`Team ${teamData.team}: ${teamData.submissions.length} submissions, best runtime=${bestRuntimeStr}, best completion=${bestCompletion}%`);
      Logger.log(`Combined splits: ${Object.keys(combinedMilestoneSplits).length} milestones`);
      
      return {
        team: teamData.team,
        runtimeStr: bestRuntimeStr,
        runtimeMs: teamData.bestRuntimeMs < Infinity ? teamData.bestRuntimeMs : 0,
        completion: bestCompletion,
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
  const content = Utilities.base64EncodeWebSafe(leaderboard);

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
  if (!ms || ms <= 0) return '-';
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
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
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
      Logger.log(`Processing data line ${i}: ${line.substring(0, 150)}...`);
      
      const headers = headerLine.split('|').map(h => h.trim());
      const parts = line.split('|').map(p => p.trim());
      
      // Extract milestone
      const milestoneIndex = headers.findIndex(h => h === 'MILESTONE');
      const runtimeIndex = headers.findIndex(h => h === 'RUNTIME');
      
      if (milestoneIndex >= 0 && runtimeIndex >= 0 && 
          milestoneIndex < parts.length && runtimeIndex < parts.length) {
        
        const milestoneCell = parts[milestoneIndex];
        const runtimeCell = parts[runtimeIndex];
        
        // Extract milestone name from MILESTONE=VALUE format
        const milestoneMatch = milestoneCell.match(/MILESTONE=([^\s]+)/);
        const runtimeMatch = runtimeCell.match(/RUNTIME=([^\s]+)/);
        
        if (milestoneMatch && runtimeMatch) {
          const milestone = milestoneMatch[1].trim();
          const runtimeValue = runtimeMatch[1].trim();
          
          Logger.log(`Found milestone: ${milestone}, runtime: ${runtimeValue}`);
          
          // Special handling for LITTLEROOT_TOWN - it should be 0:00 since the game starts there
          if (milestone === 'LITTLEROOT_TOWN') {
            milestoneSplits[milestone] = '0:00';
            Logger.log(`Set LITTLEROOT_TOWN split to 0:00 (starting location)`);
          } else {
            // Store the runtime for this milestone (use latest occurrence)
            milestoneSplits[milestone] = runtimeValue;
          }
          
          // Map milestones to approximate completion percentages (26 total milestones from MILESTONES.md)
          const milestoneProgress = {
              // Phase 1: Game Initialization (3 milestones)
              'GAME_RUNNING': 3.8,
              'PLAYER_NAME_SET': 7.7,
              'INTRO_CUTSCENE_COMPLETE': 11.5,
              
              // Phase 2: Tutorial & Starting Town (5 milestones)
              'LITTLEROOT_TOWN': 15.4,
              'PLAYER_HOUSE_ENTERED': 19.2,
              'PLAYER_BEDROOM': 23.1,
              'RIVAL_HOUSE': 26.9,
              'RIVAL_BEDROOM': 30.8,
              
              // Phase 3: Professor Birch & Starter (3 milestones)
              'ROUTE_101': 34.6,
              'STARTER_CHOSEN': 38.5,
              'BIRCH_LAB_VISITED': 42.3,
              
              // Phase 4: Rival (3 milestones)
              'OLDALE_TOWN': 46.2,
              'ROUTE_103': 50.0,
              'RECEIVED_POKEDEX': 53.8,
              
              // Phase 5: Route 102 & Petalburg (4 milestones)
              'ROUTE_102': 57.7,
              'PETALBURG_CITY': 61.5,
              'DAD_FIRST_MEETING': 65.4,
              'GYM_EXPLANATION': 69.2,
              
              // Phase 6: Road to Rustboro City (5 milestones)
              'ROUTE_104_SOUTH': 73.1,
              'PETALBURG_WOODS': 76.9,
              'TEAM_AQUA_GRUNT_DEFEATED': 80.8,
              'ROUTE_104_NORTH': 84.6,
              'RUSTBORO_CITY': 88.5,
              
              // Phase 7: First Gym Challenge (3 milestones)
              'RUSTBORO_GYM_ENTERED': 92.3,
              'ROXANNE_DEFEATED': 96.2,
              'FIRST_GYM_COMPLETE': 100.0
          };
          
          const progress = milestoneProgress[milestone] || 0;
          if (progress > completionPercent) {
            completionPercent = progress;
            Logger.log(`Updated completion to ${progress}% based on milestone ${milestone}`);
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

