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
  const logFileCol = headers.indexOf("Log File (.txt, .json, or .log)");
  const videoCol = headers.indexOf("YouTube Video Link (full run)");
  const tsCol = headers.indexOf("Timestamp");

  const leaderboard = rows
    .filter((row, index) => {
      const hasTeam = !!row[teamCol];
      const hasRuntime = !!row[runtimeCol];
      const hasLog = !!row[logFileCol];
      const hasPct = !!row[pctCol];
      const hasVideo = !!row[videoCol];
      const isValid = hasTeam && (hasRuntime || hasLog) && (hasPct || hasLog) && hasVideo;
      
      Logger.log(`Row ${index + 1}: Team="${row[teamCol]}", Runtime=${hasRuntime}, Log=${hasLog}, Pct=${hasPct}, Video=${hasVideo}, Valid=${isValid}`);
      return isValid;
    })
    .map(row => {
      let runtimeStr = row[runtimeCol];
      let completion = row[pctCol] ? parseFloat(row[pctCol]) : 0;
      let milestoneSplits = {};
      
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
        } catch (e) {
          Logger.log(`Error parsing log file for ${row[teamCol]}: ${e}`);
        }
      }
      
      return {
        team: row[teamCol],
        runtimeStr: runtimeStr,
        runtimeMs: parseRuntime(runtimeStr),
        completion: completion,
        video: row[videoCol],
        timestamp: new Date(row[tsCol]).toISOString(),
        milestoneSplits: milestoneSplits
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
      
      // Add ALL milestone splits for early-game progression (including blank/null entries)
      const keyMilestones = [
        'LITTLEROOT_TOWN',
        'ROUTE_101', 
        'OLDALE_TOWN',
        'ROUTE_103',
        'ROUTE_102',
        'PETALBURG_CITY',
        'ROUTE_104',
        'PETALBURG_WOODS',
        'RUSTBORO_CITY',
        'RUSTBORO_GYM'
      ];
      
      // Initialize all milestone splits to null first
      keyMilestones.forEach(milestone => {
        result[`split_${milestone.toLowerCase()}`] = null;
      });
      
      // Then populate with actual data if available
      keyMilestones.forEach(milestone => {
        if (entry.milestoneSplits[milestone]) {
          result[`split_${milestone.toLowerCase()}`] = entry.milestoneSplits[milestone];
        }
      });
      
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
          
          // Map milestones to approximate completion percentages
          const milestoneProgress = {
              'LITTLEROOT_TOWN': 4,
              'ROUTE_101': 8,
              'OLDALE_TOWN': 12,
              'ROUTE_103': 16,
              'ROUTE_102': 20,
              'PETALBURG_CITY': 24,
              'ROUTE_104': 28,
              'PETALBURG_WOODS': 32,
              'RUSTBORO_CITY': 36,
              'RUSTBORO_GYM': 40,           // First Gym Badge
              'DEVON_CORPORATION_3F': 44,
              'ROUTE_116': 48,
              'RUSTURF_TUNNEL': 52,
              'MR_BRINEYS_COTTAGE': 56,
              'ROUTE_105': 60,
              'DEWFORD_TOWN': 64,
              'GRANITE_CAVE_STEVEN_ROOM': 68,
              'ROUTE_109': 72,
              'SLATEPORT_CITY': 76,
              'SLATEPORT_MUSEUM_1F': 80,
              'ROUTE_110': 84,
              'MAUVILLE_CITY': 88,
              'MAUVILLE_GYM': 92             // Third Gym Badge (Wattson)
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
  
  const result = {
    model: model,
    startTime: startTime,
    runtime: runtime,
    completionPercent: completionPercent,
    milestoneSplits: milestoneSplits
  };
  
  Logger.log(`parseSubmissionLog result: runtime="${runtime}", completion=${completionPercent}%`);
  Logger.log(`Milestone splits found: ${Object.keys(milestoneSplits).length} total`);
  for (const [milestone, time] of Object.entries(milestoneSplits)) {
    Logger.log(`  ${milestone}: ${time}`);
  }
  
  return result;
}

