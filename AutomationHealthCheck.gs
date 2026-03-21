/**
 * Dash Media Automation Health Check
 *
 * Monitors the health of all automations across the Dash Media ecosystem.
 * Checks spreadsheet freshness, column layouts, CSV pipeline health,
 * Mac watcher activity, and trigger status.
 *
 * Schedule: Weekdays at 7:30 AM via Apps Script trigger (before the morning briefing).
 * Setup: Run setupHealthCheckTrigger() once.
 */

// ==================== CONFIGURATION ====================

const CONFIG = {
  alertEmail: 'shawna@mydashmedia.com',

  // Key spreadsheets to monitor
  spreadsheets: {
    sproutMaster: {
      id: '11BOmRd4V-Q-48gL5NfQ-ydpPB4emhsjgLj27TXordTE',
      name: 'Sprout Analytics MASTER',
      sheets: ['Data Dump', 'Sprout CSV data', 'ZIFLOW- Verified List'],
      maxStaleHours: 48
    },
    masterZiflow: {
      id: '1ZpktbBP9StXEHNH43jVKJ_akX7Xkjey6P4T0s8THz4U',
      name: 'Master Ziflow Data',
      sheets: ['DATA DUMP'],
      maxStaleHours: 48
    },
    wag: {
      id: '1JkrY9OvWGd_7299LXueCPu25GZKdpwSsMQCD1aDwoHU',
      name: 'WAG: Week at a Glance',
      sheets: ['Filming Summary Database'],
      maxStaleHours: 72
    },
    ver: {
      id: '19Ugu051TrC7G-CxmG_LFk07buqWVqmabDrEFcd9eOkM',
      name: 'VER: Videographer/Editor Resources',
      sheets: [],
      maxStaleHours: 72
    },
    rejectionRates: {
      id: '1DfIpkuj_8EveRz66nMYTm78wFYEUpk2BuxzSSgWsV3E',
      name: 'Rejection Rates',
      sheets: ['Sheetgo_Ziflow DATA DUMP'],
      maxStaleHours: 72
    },
    smmPayment: {
      id: '1P3K9hKUiGO3c_5H1k79lwCQeFy0ifXtyxnsWaeui9Yw',
      name: 'SMM Payment Calculator',
      sheets: [],
      maxStaleHours: 168 // weekly
    }
  },

  // Drive folders / CSV pipeline checks
  csvPipeline: {
    sproutFolder: 'SheetGo - SPROUT CSV',
    ziflowFolder: 'SheetGo - ZIFLOW CSV',
    maxSproutStaleHours: 36,  // Should get a new CSV every weekday
    maxZiflowStaleHours: 12   // Ziflow exports 4x/day
  },

  // Expected column layouts for shift detection
  // These are the critical columns that hardcoded scripts depend on
  columnChecks: {
    sproutDataDump: {
      spreadsheetId: '11BOmRd4V-Q-48gL5NfQ-ydpPB4emhsjgLj27TXordTE',
      sheetName: 'Data Dump',
      expectedColumns: {
        'A': 'Company Name',
        'B': 'WAG SMM',
        'R': 'Post for Client?',
        'S': 'Posted in Sprout',
        'U': 'Missing or Extra Tags',
        'AL': 'Date',
        'AN': 'Network',
        'AO': 'Post Type',
        'AP': 'Content Type',
        'AQ': 'Profile',
        'DC': 'Tags',
        'DD': 'Source'
      }
    },
    sproutCSVData: {
      spreadsheetId: '11BOmRd4V-Q-48gL5NfQ-ydpPB4emhsjgLj27TXordTE',
      sheetName: 'Sprout CSV data',
      expectedColumns: {
        'A': 'Date',
        'B': 'Post ID',
        'BR': 'Tags'
      }
    },
    ziflowDataDump: {
      spreadsheetId: '1ZpktbBP9StXEHNH43jVKJ_akX7Xkjey6P4T0s8THz4U',
      sheetName: 'DATA DUMP',
      expectedColumns: {
        'A': 'Index',
        'B': 'Status',
        'C': 'Company',
        'D': 'Proof Name',
        'N': 'Owner',
        'O': 'Proof ID',
        'AT': 'Ziflow URL',
        'AU': 'Ziflow ID',
        'BK': 'Created Date'
      }
    },
    wagFilming: {
      spreadsheetId: '1JkrY9OvWGd_7299LXueCPu25GZKdpwSsMQCD1aDwoHU',
      sheetName: 'Filming Summary Database',
      expectedColumns: {
        'A': 'Client',
        'AE': 'Footage ID',
        'AL': 'Exhausted/Retired',
        'AX': 'Editor Notes',
        'AY': 'Note Date'
      }
    }
  }
};


// ==================== MAIN HEALTH CHECK ====================

function runHealthCheck() {
  const results = {
    timestamp: new Date(),
    checks: [],
    overallStatus: 'healthy' // healthy, warning, critical
  };

  // Skip weekends
  const day = new Date().getDay();
  if (day === 0 || day === 6) {
    Logger.log('Weekend — skipping health check.');
    return;
  }

  // 1. Check spreadsheet freshness
  checkSpreadsheetFreshness_(results);

  // 2. Check column layouts
  checkColumnLayouts_(results);

  // 3. Check CSV pipeline (Drive files)
  checkCSVPipeline_(results);

  // 4. Check for formula errors in critical columns
  checkFormulaHealth_(results);

  // 5. Check SheetGo sync health
  checkSheetGoSync_(results);

  // Determine overall status
  const criticalCount = results.checks.filter(c => c.status === 'critical').length;
  const warningCount = results.checks.filter(c => c.status === 'warning').length;

  if (criticalCount > 0) {
    results.overallStatus = 'critical';
  } else if (warningCount > 0) {
    results.overallStatus = 'warning';
  }

  // Send email
  sendHealthCheckEmail_(results);

  Logger.log(`Health check complete: ${results.overallStatus} (${criticalCount} critical, ${warningCount} warnings)`);
}


// ==================== CHECK FUNCTIONS ====================

function checkSpreadsheetFreshness_(results) {
  for (const [key, config] of Object.entries(CONFIG.spreadsheets)) {
    try {
      const file = DriveApp.getFileById(config.id);
      const lastUpdated = file.getLastUpdated();
      const hoursAgo = (new Date() - lastUpdated) / (1000 * 60 * 60);

      if (hoursAgo > config.maxStaleHours) {
        results.checks.push({
          category: 'Spreadsheet Freshness',
          name: config.name,
          status: 'warning',
          message: `Last updated ${Math.round(hoursAgo)} hours ago (threshold: ${config.maxStaleHours}h)`
        });
      } else {
        results.checks.push({
          category: 'Spreadsheet Freshness',
          name: config.name,
          status: 'healthy',
          message: `Updated ${Math.round(hoursAgo)} hours ago`
        });
      }
    } catch (e) {
      results.checks.push({
        category: 'Spreadsheet Freshness',
        name: config.name,
        status: 'critical',
        message: `Cannot access spreadsheet: ${e.message}`
      });
    }
  }
}

function checkColumnLayouts_(results) {
  for (const [key, config] of Object.entries(CONFIG.columnChecks)) {
    try {
      const ss = SpreadsheetApp.openById(config.spreadsheetId);
      const sheet = ss.getSheetByName(config.sheetName);

      if (!sheet) {
        results.checks.push({
          category: 'Column Layout',
          name: `${config.sheetName}`,
          status: 'critical',
          message: `Sheet "${config.sheetName}" not found`
        });
        continue;
      }

      const lastCol = sheet.getLastColumn();
      const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
      const mismatches = [];

      for (const [colLetter, expectedHeader] of Object.entries(config.expectedColumns)) {
        const colIndex = columnLetterToIndex_(colLetter);
        const actualHeader = colIndex < headers.length ? String(headers[colIndex]).trim() : '(missing)';

        if (actualHeader !== expectedHeader) {
          mismatches.push(`${colLetter}: expected "${expectedHeader}", found "${actualHeader}"`);
        }
      }

      if (mismatches.length > 0) {
        results.checks.push({
          category: 'Column Layout',
          name: `${config.sheetName}`,
          status: 'critical',
          message: `${mismatches.length} column(s) shifted:\n${mismatches.join('\n')}`
        });
      } else {
        results.checks.push({
          category: 'Column Layout',
          name: `${config.sheetName}`,
          status: 'healthy',
          message: `All ${Object.keys(config.expectedColumns).length} monitored columns match`
        });
      }
    } catch (e) {
      results.checks.push({
        category: 'Column Layout',
        name: key,
        status: 'critical',
        message: `Error checking columns: ${e.message}`
      });
    }
  }
}

function checkCSVPipeline_(results) {
  // Check Sprout CSV freshness in Drive
  checkDriveFolderFreshness_(results, CONFIG.csvPipeline.sproutFolder,
    'Sprout CSV Pipeline', CONFIG.csvPipeline.maxSproutStaleHours, 'Post Performance');

  // Check Ziflow CSV freshness in Drive
  checkDriveFolderFreshness_(results, CONFIG.csvPipeline.ziflowFolder,
    'Ziflow CSV Pipeline', CONFIG.csvPipeline.maxZiflowStaleHours, 'export-proofs');
}

function checkDriveFolderFreshness_(results, folderName, checkName, maxStaleHours, filePrefix) {
  try {
    const folders = DriveApp.getFoldersByName(folderName);
    if (!folders.hasNext()) {
      results.checks.push({
        category: 'CSV Pipeline',
        name: checkName,
        status: 'critical',
        message: `Folder "${folderName}" not found in Drive`
      });
      return;
    }

    const folder = folders.next();
    const files = folder.getFiles();
    let newestDate = null;
    let newestName = '';

    while (files.hasNext()) {
      const file = files.next();
      if (file.getName().indexOf(filePrefix) === 0 || file.getName().indexOf(filePrefix) >= 0) {
        const modified = file.getLastUpdated();
        if (!newestDate || modified > newestDate) {
          newestDate = modified;
          newestName = file.getName();
        }
      }
    }

    if (!newestDate) {
      results.checks.push({
        category: 'CSV Pipeline',
        name: checkName,
        status: 'critical',
        message: `No matching files found in "${folderName}"`
      });
      return;
    }

    const hoursAgo = (new Date() - newestDate) / (1000 * 60 * 60);

    if (hoursAgo > maxStaleHours) {
      results.checks.push({
        category: 'CSV Pipeline',
        name: checkName,
        status: 'warning',
        message: `Last file: "${newestName}" — ${Math.round(hoursAgo)}h ago (threshold: ${maxStaleHours}h)`
      });
    } else {
      results.checks.push({
        category: 'CSV Pipeline',
        name: checkName,
        status: 'healthy',
        message: `Latest: "${newestName}" — ${Math.round(hoursAgo)}h ago`
      });
    }
  } catch (e) {
    results.checks.push({
      category: 'CSV Pipeline',
      name: checkName,
      status: 'critical',
      message: `Error: ${e.message}`
    });
  }
}

function checkFormulaHealth_(results) {
  // Check Sprout Analytics MASTER - Missing or Extra Tags column
  try {
    const ss = SpreadsheetApp.openById(CONFIG.spreadsheets.sproutMaster.id);
    const sheet = ss.getSheetByName('Data Dump');
    const lastRow = Math.min(sheet.getLastRow(), 100); // Sample first 100 rows
    const tagFormulas = sheet.getRange('U2:U' + lastRow).getValues();

    let errorCount = 0;
    for (const row of tagFormulas) {
      const val = String(row[0]);
      if (val !== 'Y' && val !== 'N' && val !== '') {
        errorCount++;
      }
    }

    if (errorCount > 0) {
      results.checks.push({
        category: 'Formula Health',
        name: 'Sprout Missing/Extra Tags (Col U)',
        status: 'warning',
        message: `${errorCount} unexpected values found (expected Y/N/blank)`
      });
    } else {
      results.checks.push({
        category: 'Formula Health',
        name: 'Sprout Missing/Extra Tags (Col U)',
        status: 'healthy',
        message: 'All values are Y, N, or blank as expected'
      });
    }
  } catch (e) {
    results.checks.push({
      category: 'Formula Health',
      name: 'Sprout Missing/Extra Tags',
      status: 'critical',
      message: `Error: ${e.message}`
    });
  }

  // Check Master Ziflow DATA DUMP for #REF! errors in critical columns
  try {
    const ss = SpreadsheetApp.openById(CONFIG.spreadsheets.masterZiflow.id);
    const sheet = ss.getSheetByName('DATA DUMP');
    const lastRow = Math.min(sheet.getLastRow(), 50);

    // Check a sample of the sheet for #REF! or #ERROR!
    const sample = sheet.getRange(2, 1, lastRow - 1, 70).getDisplayValues();
    let refErrors = 0;
    let errorLocations = [];

    for (let r = 0; r < sample.length; r++) {
      for (let c = 0; c < sample[r].length; c++) {
        const val = sample[r][c];
        if (val === '#REF!' || val === '#ERROR!' || val === '#N/A' || val === '#VALUE!') {
          refErrors++;
          if (errorLocations.length < 5) {
            errorLocations.push(`Row ${r + 2}, Col ${columnIndexToLetter_(c)}: ${val}`);
          }
        }
      }
    }

    if (refErrors > 10) {
      results.checks.push({
        category: 'Formula Health',
        name: 'Ziflow DATA DUMP formula errors',
        status: 'warning',
        message: `${refErrors} formula errors found in first ${lastRow} rows. Examples: ${errorLocations.join('; ')}`
      });
    } else {
      results.checks.push({
        category: 'Formula Health',
        name: 'Ziflow DATA DUMP formula errors',
        status: 'healthy',
        message: `${refErrors} errors in sample (acceptable)`
      });
    }
  } catch (e) {
    results.checks.push({
      category: 'Formula Health',
      name: 'Ziflow DATA DUMP',
      status: 'critical',
      message: `Error: ${e.message}`
    });
  }
}

function checkSheetGoSync_(results) {
  // Check if Rejection Rates SheetGo tab has recent data
  try {
    const ss = SpreadsheetApp.openById(CONFIG.spreadsheets.rejectionRates.id);
    const sheet = ss.getSheetByName('Sheetgo_Ziflow DATA DUMP');

    if (!sheet) {
      results.checks.push({
        category: 'SheetGo Sync',
        name: 'Rejection Rates — Sheetgo_Ziflow DATA DUMP',
        status: 'critical',
        message: 'Sheet not found — SheetGo may have disconnected'
      });
      return;
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 10) {
      results.checks.push({
        category: 'SheetGo Sync',
        name: 'Rejection Rates — Sheetgo_Ziflow DATA DUMP',
        status: 'critical',
        message: `Only ${lastRow} rows — SheetGo sync may have failed`
      });
    } else {
      results.checks.push({
        category: 'SheetGo Sync',
        name: 'Rejection Rates — Sheetgo_Ziflow DATA DUMP',
        status: 'healthy',
        message: `${lastRow} rows present`
      });
    }
  } catch (e) {
    results.checks.push({
      category: 'SheetGo Sync',
      name: 'Rejection Rates SheetGo',
      status: 'critical',
      message: `Error: ${e.message}`
    });
  }

  // Check Sprout CSV data sheet row count
  try {
    const ss = SpreadsheetApp.openById(CONFIG.spreadsheets.sproutMaster.id);
    const sheet = ss.getSheetByName('Sprout CSV data');
    const lastRow = sheet.getLastRow();

    if (lastRow < 100) {
      results.checks.push({
        category: 'SheetGo Sync',
        name: 'Sprout CSV data',
        status: 'critical',
        message: `Only ${lastRow} rows — SheetGo sync may have failed`
      });
    } else {
      results.checks.push({
        category: 'SheetGo Sync',
        name: 'Sprout CSV data',
        status: 'healthy',
        message: `${lastRow} rows present`
      });
    }
  } catch (e) {
    results.checks.push({
      category: 'SheetGo Sync',
      name: 'Sprout CSV data',
      status: 'critical',
      message: `Error: ${e.message}`
    });
  }
}


// ==================== EMAIL ====================

function sendHealthCheckEmail_(results) {
  const statusEmoji = {
    healthy: '✅',
    warning: '⚠️',
    critical: '🚨'
  };

  const statusColor = {
    healthy: '#2e7d32',
    warning: '#f57f17',
    critical: '#c62828'
  };

  const overallEmoji = statusEmoji[results.overallStatus];
  const overallColor = statusColor[results.overallStatus];
  const overallLabel = results.overallStatus.charAt(0).toUpperCase() + results.overallStatus.slice(1);

  // Group checks by category
  const categories = {};
  for (const check of results.checks) {
    if (!categories[check.category]) {
      categories[check.category] = [];
    }
    categories[check.category].push(check);
  }

  let checksHtml = '';
  for (const [category, checks] of Object.entries(categories)) {
    const categoryHasIssues = checks.some(c => c.status !== 'healthy');
    const categoryEmoji = categoryHasIssues ? '⚠️' : '✅';

    checksHtml += `<h3 style="margin: 20px 0 10px 0; color: #333;">${categoryEmoji} ${category}</h3>`;
    checksHtml += '<table style="width: 100%; border-collapse: collapse; font-size: 14px;">';

    for (const check of checks) {
      const emoji = statusEmoji[check.status];
      const color = statusColor[check.status];
      const bgColor = check.status === 'healthy' ? '#f9f9f9' : (check.status === 'warning' ? '#fff8e1' : '#ffebee');

      checksHtml += `
        <tr style="background-color: ${bgColor};">
          <td style="padding: 8px; border-bottom: 1px solid #eee; width: 30px; text-align: center;">${emoji}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold; width: 35%;">${check.name}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; color: #555;">${check.message}</td>
        </tr>`;
    }
    checksHtml += '</table>';
  }

  const criticalChecks = results.checks.filter(c => c.status === 'critical');
  const warningChecks = results.checks.filter(c => c.status === 'warning');
  const healthyChecks = results.checks.filter(c => c.status === 'healthy');

  let actionHtml = '';
  if (criticalChecks.length > 0 || warningChecks.length > 0) {
    actionHtml = `
      <div style="background-color: #e3f2fd; border-left: 4px solid #2196F3; padding: 15px; margin: 20px 0; border-radius: 5px;">
        <h4 style="margin: 0 0 10px 0; color: #1976D2;">What to do:</h4>
        <p style="margin: 0;">Open Claude Code and say: <strong>"My health check found issues, take a look"</strong></p>
        <p style="margin: 5px 0 0 0; color: #555; font-size: 13px;">Claude has access to all your spreadsheets and scripts and can diagnose and fix most issues automatically.</p>
      </div>`;
  }

  const subject = `${overallEmoji} Automation Health Check — ${overallLabel} (${criticalChecks.length} critical, ${warningChecks.length} warnings, ${healthyChecks.length} ok)`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 750px; margin: 0 auto; padding: 20px;">
      <div style="background-color: ${results.overallStatus === 'healthy' ? '#e8f5e9' : (results.overallStatus === 'warning' ? '#fff8e1' : '#ffebee')}; border-left: 4px solid ${overallColor}; padding: 20px; border-radius: 5px;">
        <h2 style="color: ${overallColor}; margin-top: 0;">${overallEmoji} Automation Health Check — ${overallLabel}</h2>
        <p style="margin: 0;">
          <strong>${healthyChecks.length}</strong> healthy &nbsp;|&nbsp;
          <strong>${warningChecks.length}</strong> warnings &nbsp;|&nbsp;
          <strong>${criticalChecks.length}</strong> critical
        </p>
        <p style="margin: 5px 0 0 0; color: #666; font-size: 13px;">
          ${Utilities.formatDate(results.timestamp, Session.getScriptTimeZone(), 'EEEE, MMMM d, yyyy h:mm a')}
        </p>
      </div>

      ${actionHtml}
      ${checksHtml}

      <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
      <p style="color: #999; font-size: 12px;">
        Generated by Automation Health Check — runs weekdays at 7:30 AM<br>
        Monitoring: ${Object.keys(CONFIG.spreadsheets).length} spreadsheets, ${Object.keys(CONFIG.columnChecks).length} column layouts, 2 CSV pipelines, 2 SheetGo syncs
      </p>
    </div>`;

  MailApp.sendEmail({
    to: CONFIG.alertEmail,
    subject: subject,
    htmlBody: html,
    name: 'Dash Media Automation'
  });
}


// ==================== SETUP ====================

/**
 * Run once to set up the weekday 7:30 AM trigger.
 */
function setupHealthCheckTrigger() {
  // Remove existing triggers
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'runHealthCheck') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('runHealthCheck')
    .timeBased()
    .everyDays(1)
    .atHour(7)
    .nearMinute(30)
    .create();

  Logger.log('Health check trigger created: weekdays at ~7:30 AM');
}

/**
 * Run manually to test the health check.
 */
function testHealthCheck() {
  runHealthCheck();
}


// ==================== UTILITIES ====================

function columnLetterToIndex_(letter) {
  let index = 0;
  for (let i = 0; i < letter.length; i++) {
    index = index * 26 + (letter.charCodeAt(i) - 64);
  }
  return index - 1;
}

function columnIndexToLetter_(index) {
  let letter = '';
  while (index >= 0) {
    letter = String.fromCharCode((index % 26) + 65) + letter;
    index = Math.floor(index / 26) - 1;
  }
  return letter;
}
