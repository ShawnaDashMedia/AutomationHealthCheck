/**
 * Dash Media Automation Health Check — COMPREHENSIVE
 *
 * Monitors the health of ALL automations across the Dash Media ecosystem:
 * - 10 spreadsheets across 16 GitHub repos
 * - Column layouts for every hardcoded position risk
 * - CSV pipelines (Sprout, Ziflow, Tag Reports)
 * - SheetGo sync health
 * - Formula errors (#REF!, #ERROR!, #N/A, #VALUE!)
 * - Mac watcher health (inferred from Drive file freshness)
 * - Cross-spreadsheet data flow freshness
 * - FilmingScheduleNotifications library accessibility
 *
 * Schedule: Weekdays at 7:30 AM via Apps Script trigger.
 * Setup: Run setupHealthCheckTrigger() once.
 * Test: Run testHealthCheck() manually (skips weekend check).
 */

// ==================== CONFIGURATION ====================

const CONFIG = {
  alertEmail: 'shawna@mydashmedia.com',

  // ---- ALL spreadsheets referenced across all 16 repos ----
  spreadsheets: {
    masterZiflow: {
      id: '1ZpktbBP9StXEHNH43jVKJ_akX7Xkjey6P4T0s8THz4U',
      name: 'Master Ziflow Data',
      sheets: ['DATA DUMP'],
      maxStaleHours: 24,
      description: 'Central hub — nearly every repo reads from this'
    },
    sproutMaster: {
      id: '11BOmRd4V-Q-48gL5NfQ-ydpPB4emhsjgLj27TXordTE',
      name: 'Sprout Analytics MASTER / Search Engine Source',
      sheets: ['Data Dump', 'Sprout CSV data', 'ZIFLOW- Verified List'],
      maxStaleHours: 48,
      description: 'Sprout data + Search Engine source data dump'
    },
    wag: {
      id: '1JkrY9OvWGd_7299LXueCPu25GZKdpwSsMQCD1aDwoHU',
      name: 'WAG: Week at a Glance',
      sheets: ['Filming Summary Database', 'ZIFLOW - DATA DUMP', 'Edit Planner',
               'Backlog/Queue Table', 'Special Requests', 'Revisions', 'ZIFLOW - Verified List'],
      maxStaleHours: 48,
      description: 'WAG + Footage-Management-Form target'
    },
    ver: {
      id: '19Ugu051TrC7G-CxmG_LFk07buqWVqmabDrEFcd9eOkM',
      name: 'VER: Videographer/Editor Resources',
      sheets: ['POST SHOOT - Filming Summary Database', 'Client Guidelines & Rules', 'ZIFLOW - DATA DUMP'],
      maxStaleHours: 72,
      description: 'Editor assignments, Shelby note notifications'
    },
    editorAssignmentHistory: {
      id: '1qwTH-YhxnYNW6P6pKaYswCXAE3l3d2bJm4w-nhKeTQw',
      name: 'Editor Assignment History',
      sheets: [],
      maxStaleHours: 168,
      description: 'VER editor assignment history destination'
    },
    rejectionRates: {
      id: '1DfIpkuj_8EveRz66nMYTm78wFYEUpk2BuxzSSgWsV3E',
      name: 'Rejection Rates',
      sheets: ['Sheetgo_Ziflow DATA DUMP', 'Sheetgo_Verified list'],
      maxStaleHours: 72,
      description: 'SheetGo-fed from Master Ziflow'
    },
    searchEngineUI: {
      id: '1v7FCW6Py20BcfaX0dyXNRsF3Nb6pKxopa1hT5cl8XVc',
      name: 'Search Engine (Find a Ziflow Link)',
      sheets: [],
      maxStaleHours: 168,
      description: 'Search UI — button-driven, no triggers'
    },
    // smmPayment freshness check REMOVED 2026-06-24. Per Shawna, the SMM
    // Payment Calculator spreadsheet is no longer in use; payroll moved to
    // a different system. The 638h-stale alert was firing because nothing
    // updates the sheet anymore — and nothing should.
    twoRevisionsReport: {
      id: '1iHAw9-EYbuA1XrtQd5GcM6e2nx6G1Essypg9Ph1CbvI',
      name: '2+ Revisions Report',
      sheets: [],
      maxStaleHours: 744,  // monthly
      description: 'Monthly 2+ revisions destination'
    },
    filmingScheduleTemplate: {
      id: '1mwU2t8dwOhHbM5OvQQYuHMMMbaLRUH0s1XDyZv9rG9o',
      name: 'Filming Schedule Template 2024',
      sheets: [],
      maxStaleHours: 744,
      description: 'Template for DMR-V2, Filming-Schedule-Template, client DMRs'
    }
  },

  // ---- CSV / Drive folder pipeline checks ----
  // CSV pipeline checks. The Mac-watcher → SheetGo → sheet path was retired
  // when the LIVE Data Dump tabs cut over to BigQuery-driven (Ziflow 2026-06-22,
  // Sprout 2026-06-24). Both sproutCSV and ziflowCSV entries removed at that
  // point — the Mac watchers' last consumer is gone, the alert was firing on
  // every run because nobody downloads CSVs anymore. SMM Reports Folder check
  // remains because Tag Reports are produced independently of the BQ migration.
  csvPipeline: {
    smmReportsFolder: {
      folderName: 'SMM Reports',
      checkName: 'SMM Reports Folder (Tag Reports)',
      maxStaleHours: 168,     // weekly cadence
      filePrefix: '',          // any file
      description: 'Tag Report CSVs and SMM report outputs'
    }
  },

  // ---- Column layout checks: EVERY hardcoded position risk ----
  // These map the exact column positions that scripts depend on via numeric index
  columnChecks: {

    // === Master Ziflow DATA DUMP ===
    // Used by: checkForQuestionMarkAndSendEmail, sendDuplicateDataReport,
    //          sendFailedProofEmail, checkShortLeadTimeSpecialRequests,
    //          Rejection Discrepancy Alert, and many more
    ziflowDataDump: {
      spreadsheetId: '1ZpktbBP9StXEHNH43jVKJ_akX7Xkjey6P4T0s8THz4U',
      sheetName: 'DATA DUMP',
      expectedColumns: {
        // Synced 2026-05-05 to current live state. Update whenever Shawna intentionally reshapes columns.
        'A': 'placeholder',
        'B': 'Delivered or Not',
        'C': 'Proof Status',
        'D': 'Client',
        'N': 'Date Created',
        'O': 'Time Created',
        'AF': 'Shoot ID',
        'AK': 'Rejection Discrepancy',
        'AT': 'Internal ID',
        'AU': 'Proof Name',
        'AW': 'First Version Created Date',
        'AZ': 'Folder',
        'BB': 'Status',
        'BJ': 'Stages',
        'BK': 'Public URL',
        'BQ': 'Special Request Proof',
        'BS': 'Your Email',
        'CC': 'Social Media Posting Date',
        'FI': 'Video Request Description'
      }
    },

    // sproutDataDump + sproutCSVData column checks REMOVED 2026-06-24 with the
    // Sprout LIVE Data Dump cutover. The Data Dump tab is now BQ-driven (writes
    // hourly from Marts.sprout_data_dump via sprout-data-dump-sync Cloud Run);
    // column positions are now controlled by the SQL view and any drift is
    // caught at BQ schema level by schema-drift-report. The Sprout CSV data
    // tab is no longer being refreshed (SheetGo workflow disabled 2026-06-24
    // 02:30 ET), so its column layout is frozen and meaningless to monitor.

    // === WAG - Filming Summary Database ===
    // Row 1-2 are UI/instruction text. Real data headers are on row 3, data starts row 4.
    wagFilmingSummary: {
      spreadsheetId: '1JkrY9OvWGd_7299LXueCPu25GZKdpwSsMQCD1aDwoHU',
      sheetName: 'Filming Summary Database',
      headerRow: 3,
      expectedColumns: {
        'A': 'Client',
        'AD': 'Footage ID (Edited clip format is: CLIENT NAME - FOOTAGE ID - CLIP #)',
        'AG': '# of times Assigned',
        'AK': 'Exhausted/Retired Footage',
        'AW': 'Editor Notes',
        'AX': 'Date Note Submitted',
        'AY': 'Assigned from today forward',
        'AZ': 'Alert! Scheduled but no footage left!'
      }
    },

    // === WAG - Edit Planner ===
    // Used by: WAG healArrayFormulas (hardcoded day column offsets)
    wagEditPlanner: {
      spreadsheetId: '1JkrY9OvWGd_7299LXueCPu25GZKdpwSsMQCD1aDwoHU',
      sheetName: 'Edit Planner',
      expectedColumns: {
        // Columns F through AC; day columns are at offsets 3,8,13,18,23 from col F
        // MON_COL=3(I), TUE_COL=8(N), WED_COL=13(S), THU_COL=18(X), FRI_COL=23(AC)
        'F': null,  // Start of Edit Planner range (just verify column F exists)
        'I': null,  // Monday column (MON_COL offset 3)
        'N': null,  // Tuesday column (TUE_COL offset 8)
        'S': null,  // Wednesday column (WED_COL offset 13)
        'X': null,  // Thursday column (TUE_COL offset 18)
        'AC': null  // Friday column (FRI_COL offset 23)
      }
    },

    // === WAG - ZIFLOW - DATA DUMP (mirror tab) ===
    // Self-healing formulas reference specific columns (CB, C, D, etc.)
    wagZiflowDataDump: {
      spreadsheetId: '1JkrY9OvWGd_7299LXueCPu25GZKdpwSsMQCD1aDwoHU',
      sheetName: 'ZIFLOW - DATA DUMP',
      expectedColumns: {
        'C': null,   // Company (referenced by WAG self-healing formulas)
        'D': null    // Proof Name (referenced by WAG self-healing formulas)
      }
    },

    // === Rejection Rates - SheetGo tab ===
    rejectionRatesSheetGo: {
      spreadsheetId: '1DfIpkuj_8EveRz66nMYTm78wFYEUpk2BuxzSSgWsV3E',
      sheetName: 'Sheetgo_Ziflow DATA DUMP',
      expectedColumns: {
        'A': null,   // Should have data (SheetGo sync)
        'B': null
      }
    },

    // smmPaymentCalc column check REMOVED 2026-06-24. Per Shawna, the SMM
    // Payment Calculator spreadsheet is retired; payroll runs through a
    // different system now. Nothing reads from this sheet, no monitoring
    // needed.
  },

  // Mac watcher health checks REMOVED 2026-06-24. Both watchers
  // (ziflow-export-proofs.sh / export-proofs-watcher.sh and
  // sprout-post-performance-watcher.sh) fed the SheetGo CSV ingestion path
  // that's been retired by the Cloud Run data-dump-sync services (Ziflow
  // 2026-06-22, Sprout 2026-06-24). Their last consumer is gone. The watchers
  // themselves can be unloaded from launchd at any time; once they are, this
  // check would log a 'folder not found' error, so it's cleaner to drop now.
  macWatchers: {},

  // ---- Cross-spreadsheet data flows ----
  dataFlows: [
    {
      name: 'Master Ziflow → Rejection Rates (SheetGo)',
      sourceId: '1ZpktbBP9StXEHNH43jVKJ_akX7Xkjey6P4T0s8THz4U',
      sourceName: 'Master Ziflow DATA DUMP',
      destId: '1DfIpkuj_8EveRz66nMYTm78wFYEUpk2BuxzSSgWsV3E',
      destName: 'Rejection Rates',
      destSheet: 'Sheetgo_Ziflow DATA DUMP',
      maxLagHours: 48,
      mechanism: 'SheetGo sync'
    },
    {
      name: 'Master Ziflow → Rejection Rates Verified (SheetGo)',
      sourceId: '1ZpktbBP9StXEHNH43jVKJ_akX7Xkjey6P4T0s8THz4U',
      sourceName: 'Master Ziflow DATA DUMP',
      destId: '1DfIpkuj_8EveRz66nMYTm78wFYEUpk2BuxzSSgWsV3E',
      destName: 'Rejection Rates',
      destSheet: 'Sheetgo_Verified list',
      maxLagHours: 48,
      mechanism: 'SheetGo sync'
    },
    // 'Sprout CSV → Sprout Master (SheetGo)' data-flow check REMOVED 2026-06-24.
    // The SheetGo workflow that ingested Sprout CSVs into the 'Sprout CSV data'
    // tab was disabled by Shawna following the sprout-data-dump-sync cutover.
    // The destination tab is no longer being refreshed by anything.
    {
      name: 'VER → Editor Assignment History',
      sourceId: '19Ugu051TrC7G-CxmG_LFk07buqWVqmabDrEFcd9eOkM',
      sourceName: 'VER',
      destId: '1qwTH-YhxnYNW6P6pKaYswCXAE3l3d2bJm4w-nhKeTQw',
      destName: 'Editor Assignment History',
      destSheet: null,
      maxLagHours: 168,
      mechanism: 'Script copy (editor assignment)'
    },
    {
      name: 'Master Ziflow → WAG ZIFLOW tab',
      sourceId: '1ZpktbBP9StXEHNH43jVKJ_akX7Xkjey6P4T0s8THz4U',
      sourceName: 'Master Ziflow DATA DUMP',
      destId: '1JkrY9OvWGd_7299LXueCPu25GZKdpwSsMQCD1aDwoHU',
      destName: 'WAG',
      destSheet: 'ZIFLOW - DATA DUMP',
      maxLagHours: 48,
      mechanism: 'SheetGo or IMPORTRANGE sync'
    }
  ],

  // ---- Filming Schedule Notifications library check ----
  filmingScheduleLibrary: {
    // The wrapper library that client DMRs depend on
    testSpreadsheetId: '1mwU2t8dwOhHbM5OvQQYuHMMMbaLRUH0s1XDyZv9rG9o',
    libraryName: 'FilmingScheduleNotifications'
  },

  // ---- SheetGo sync checks (row counts as health signal) ----
  sheetGoSyncs: [
    {
      name: 'Rejection Rates — Sheetgo_Ziflow DATA DUMP',
      spreadsheetId: '1DfIpkuj_8EveRz66nMYTm78wFYEUpk2BuxzSSgWsV3E',
      sheetName: 'Sheetgo_Ziflow DATA DUMP',
      minExpectedRows: 100,
      description: 'SheetGo from Master Ziflow DATA DUMP'
    },
    {
      name: 'Rejection Rates — Sheetgo_Verified list',
      spreadsheetId: '1DfIpkuj_8EveRz66nMYTm78wFYEUpk2BuxzSSgWsV3E',
      sheetName: 'Sheetgo_Verified list',
      minExpectedRows: 50,
      description: 'SheetGo from Master Ziflow Verified List'
    },
    // 'Sprout CSV data' row-count check REMOVED 2026-06-24. The SheetGo
    // workflow that populated this tab was disabled; tab is no longer
    // refreshed. Sprout post data now flows BQ-direct via Marts.posts +
    // Marts.sprout_data_dump → LIVE Data Dump tab.
    {
      name: 'Sprout ZIFLOW- Verified List',
      spreadsheetId: '11BOmRd4V-Q-48gL5NfQ-ydpPB4emhsjgLj27TXordTE',
      sheetName: 'ZIFLOW- Verified List',
      minExpectedRows: 50,
      description: 'SheetGo/IMPORTRANGE from Master Ziflow Verified List'
    }
  ],

  // ---- Formula health spot-checks ----
  formulaChecks: [
    {
      name: 'Sprout Missing/Extra Tags (Col U)',
      spreadsheetId: '11BOmRd4V-Q-48gL5NfQ-ydpPB4emhsjgLj27TXordTE',
      sheetName: 'Data Dump',
      column: 'U',
      sampleRows: 100,
      validValues: ['Y', 'N', ''],
      description: 'Should only contain Y, N, or blank'
    },
    {
      name: 'Ziflow DATA DUMP — formula errors (first 70 cols)',
      spreadsheetId: '1ZpktbBP9StXEHNH43jVKJ_akX7Xkjey6P4T0s8THz4U',
      sheetName: 'DATA DUMP',
      scanForErrors: true,
      sampleRows: 50,
      sampleCols: 70,
      maxAcceptableErrors: 10,
      description: 'Scan for #REF!, #ERROR!, #N/A, #VALUE!'
    },
    {
      name: 'Ziflow DATA DUMP — formula errors (cols 70-165)',
      spreadsheetId: '1ZpktbBP9StXEHNH43jVKJ_akX7Xkjey6P4T0s8THz4U',
      sheetName: 'DATA DUMP',
      scanForErrors: true,
      sampleRows: 50,
      startCol: 71,
      sampleCols: 95,
      maxAcceptableErrors: 10,
      description: 'Extended columns that checkShortLeadTimeSpecialRequests reads'
    },
    {
      name: 'WAG Backlog/Queue Table — #REF! errors',
      spreadsheetId: '1JkrY9OvWGd_7299LXueCPu25GZKdpwSsMQCD1aDwoHU',
      sheetName: 'Backlog/Queue Table',
      scanForErrors: true,
      sampleRows: 50,
      sampleCols: 30,
      maxAcceptableErrors: 5,
      description: 'WAG healBacklogQueueQ4 tries to fix these'
    },
    {
      name: 'WAG Special Requests — #REF! errors',
      spreadsheetId: '1JkrY9OvWGd_7299LXueCPu25GZKdpwSsMQCD1aDwoHU',
      sheetName: 'Special Requests',
      scanForErrors: true,
      sampleRows: 50,
      sampleCols: 30,
      maxAcceptableErrors: 5,
      description: 'WAG fixSpecialRequestFormulaErrors targets these'
    },
    {
      name: 'WAG Revisions — #REF! errors',
      spreadsheetId: '1JkrY9OvWGd_7299LXueCPu25GZKdpwSsMQCD1aDwoHU',
      sheetName: 'Revisions',
      scanForErrors: true,
      sampleRows: 50,
      sampleCols: 30,
      maxAcceptableErrors: 5,
      description: 'WAG autoFixRevisions targets these'
    }
  ]
};


// ==================== MAIN HEALTH CHECK ====================

function runHealthCheck() {
  // Skip weekends
  const day = new Date().getDay();
  if (day === 0 || day === 6) {
    Logger.log('Weekend — skipping health check.');
    return;
  }

  const results = {
    timestamp: new Date(),
    checks: [],
    overallStatus: 'healthy'
  };

  // 1. Spreadsheet accessibility & freshness (all 10 spreadsheets)
  checkSpreadsheetFreshness_(results);

  // 2. Column layout validation (every hardcoded position risk)
  checkColumnLayouts_(results);

  // 3. CSV pipeline freshness (Sprout, Ziflow, SMM Reports folders)
  checkCSVPipelines_(results);

  // 4. Mac watcher health (inferred from Drive file freshness)
  checkMacWatcherHealth_(results);

  // 5. SheetGo sync health (row counts)
  checkSheetGoSyncs_(results);

  // 6. Formula health (value validation + error scanning)
  checkFormulaHealth_(results);

  // 7. Cross-spreadsheet data flow freshness
  checkCrossSpreadsheetFlows_(results);

  // 8. FilmingScheduleNotifications library accessibility
  checkFilmingScheduleLibrary_(results);

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

  Logger.log('Health check complete: ' + results.overallStatus +
    ' (' + criticalCount + ' critical, ' + warningCount + ' warnings, ' +
    results.checks.filter(c => c.status === 'healthy').length + ' healthy)');
}


// ==================== CHECK FUNCTIONS ====================

/**
 * 1. SPREADSHEET FRESHNESS — All 10 spreadsheets across all repos
 */
function checkSpreadsheetFreshness_(results) {
  for (const [key, config] of Object.entries(CONFIG.spreadsheets)) {
    try {
      const file = DriveApp.getFileById(config.id);
      const lastUpdated = file.getLastUpdated();
      const hoursAgo = (new Date() - lastUpdated) / (1000 * 60 * 60);

      let status = 'healthy';
      let message = 'Updated ' + Math.round(hoursAgo) + ' hours ago';

      if (hoursAgo > config.maxStaleHours * 2) {
        status = 'critical';
        message = 'Last updated ' + Math.round(hoursAgo) + ' hours ago (threshold: ' + config.maxStaleHours + 'h) — ' + config.description;
      } else if (hoursAgo > config.maxStaleHours) {
        status = 'warning';
        message = 'Last updated ' + Math.round(hoursAgo) + ' hours ago (threshold: ' + config.maxStaleHours + 'h)';
      }

      results.checks.push({
        category: 'Spreadsheet Freshness',
        name: config.name,
        status: status,
        message: message
      });
    } catch (e) {
      results.checks.push({
        category: 'Spreadsheet Freshness',
        name: config.name,
        status: 'critical',
        message: 'Cannot access spreadsheet: ' + e.message
      });
    }
  }
}

/**
 * 2. COLUMN LAYOUT VALIDATION — Every hardcoded position risk
 *
 * This is the most critical check. Scripts like checkShortLeadTimeSpecialRequests
 * read up to column 165 (FI) using hardcoded numeric indexes. If ANY column shifts
 * in the Master Ziflow DATA DUMP, multiple scripts break simultaneously.
 */
function checkColumnLayouts_(results) {
  for (const [key, config] of Object.entries(CONFIG.columnChecks)) {
    try {
      const ss = SpreadsheetApp.openById(config.spreadsheetId);
      const sheet = ss.getSheetByName(config.sheetName);

      if (!sheet) {
        results.checks.push({
          category: 'Column Layout',
          name: config.sheetName + ' (' + key + ')',
          status: 'critical',
          message: 'Sheet "' + config.sheetName + '" not found — tab may have been renamed or deleted'
        });
        continue;
      }

      const lastCol = sheet.getLastColumn();
      const headerRow = config.headerRow || 1;
      const headers = lastCol > 0 ? sheet.getRange(headerRow, 1, 1, lastCol).getValues()[0] : [];
      const mismatches = [];
      let checkedCount = 0;

      for (const [colLetter, expectedHeader] of Object.entries(config.expectedColumns)) {
        const colIndex = columnLetterToIndex_(colLetter);

        // If expectedHeader is null, we just check the column exists (for Edit Planner etc.)
        if (expectedHeader === null) {
          if (colIndex >= lastCol) {
            mismatches.push(colLetter + ': column does not exist (sheet only has ' + lastCol + ' columns)');
          }
          checkedCount++;
          continue;
        }

        const actualHeader = colIndex < headers.length ? String(headers[colIndex]).trim() : '(column missing)';

        if (actualHeader.toLowerCase() !== expectedHeader.toLowerCase()) {
          mismatches.push(colLetter + ': expected "' + expectedHeader + '", found "' + actualHeader + '"');
        }
        checkedCount++;
      }

      // For the Ziflow DATA DUMP, also verify total column count is >= 165
      if (key === 'ziflowDataDump' && lastCol < 165) {
        mismatches.push('Total columns: ' + lastCol + ' (scripts read up to column 165/FI — data may be truncated)');
      }

      if (mismatches.length > 0) {
        results.checks.push({
          category: 'Column Layout',
          name: config.sheetName + ' (' + key + ')',
          status: 'critical',
          message: mismatches.length + ' issue(s):\n' + mismatches.join('\n')
        });
      } else {
        results.checks.push({
          category: 'Column Layout',
          name: config.sheetName + ' (' + key + ')',
          status: 'healthy',
          message: 'All ' + checkedCount + ' monitored columns match' +
            (key === 'ziflowDataDump' ? ' (' + lastCol + ' total cols, scripts need 165)' : '')
        });
      }
    } catch (e) {
      results.checks.push({
        category: 'Column Layout',
        name: key,
        status: 'critical',
        message: 'Error checking columns: ' + e.message
      });
    }
  }
}

/**
 * 3. CSV PIPELINE FRESHNESS — Sprout, Ziflow, Tag Reports
 */
function checkCSVPipelines_(results) {
  for (const [key, pipeline] of Object.entries(CONFIG.csvPipeline)) {
    checkDriveFolderFreshness_(results, pipeline);
  }
}

function checkDriveFolderFreshness_(results, pipeline) {
  try {
    const folders = DriveApp.getFoldersByName(pipeline.folderName);
    if (!folders.hasNext()) {
      results.checks.push({
        category: 'CSV Pipeline',
        name: pipeline.checkName,
        status: 'critical',
        message: 'Folder "' + pipeline.folderName + '" not found in Drive'
      });
      return;
    }

    const folder = folders.next();
    const files = folder.getFiles();
    let newestDate = null;
    let newestName = '';
    let fileCount = 0;

    while (files.hasNext()) {
      const file = files.next();
      fileCount++;
      const name = file.getName();

      // If no prefix filter, match all files; otherwise match prefix
      if (pipeline.filePrefix === '' || name.indexOf(pipeline.filePrefix) >= 0) {
        const modified = file.getLastUpdated();
        if (!newestDate || modified > newestDate) {
          newestDate = modified;
          newestName = name;
        }
      }
    }

    if (!newestDate) {
      results.checks.push({
        category: 'CSV Pipeline',
        name: pipeline.checkName,
        status: 'critical',
        message: 'No matching files found in "' + pipeline.folderName + '" (' + fileCount + ' total files)'
      });
      return;
    }

    const hoursAgo = (new Date() - newestDate) / (1000 * 60 * 60);

    let status = 'healthy';
    if (hoursAgo > pipeline.maxStaleHours * 2) {
      status = 'critical';
    } else if (hoursAgo > pipeline.maxStaleHours) {
      status = 'warning';
    }

    results.checks.push({
      category: 'CSV Pipeline',
      name: pipeline.checkName,
      status: status,
      message: 'Latest: "' + newestName + '" — ' + Math.round(hoursAgo) + 'h ago' +
        (status !== 'healthy' ? ' (threshold: ' + pipeline.maxStaleHours + 'h)' : '') +
        ' [' + fileCount + ' files in folder]'
    });
  } catch (e) {
    results.checks.push({
      category: 'CSV Pipeline',
      name: pipeline.checkName,
      status: 'critical',
      message: 'Error: ' + e.message
    });
  }
}

/**
 * 4. MAC WATCHER HEALTH — Inferred from Drive file freshness
 *
 * The Mac runs three scripts:
 * - ziflow-export-proofs.sh: Pulls Ziflow API 4x/day (7am, 10am, 1pm, 4pm)
 * - export-proofs-watcher.sh: Copies CSVs to Drive (SheetGo - ZIFLOW CSV)
 * - sprout-post-performance-watcher.sh: Copies Sprout CSVs to Drive
 *
 * If the Drive folders stop getting fresh files, the Mac watchers may be down.
 */
function checkMacWatcherHealth_(results) {
  for (const [key, watcher] of Object.entries(CONFIG.macWatchers)) {
    try {
      const folders = DriveApp.getFoldersByName(watcher.folderName);
      if (!folders.hasNext()) {
        results.checks.push({
          category: 'Mac Watcher Health',
          name: watcher.description,
          status: 'critical',
          message: 'Drive folder "' + watcher.folderName + '" not found'
        });
        continue;
      }

      const folder = folders.next();
      const files = folder.getFiles();
      let newestDate = null;
      let newestName = '';
      let recentCount = 0;
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      while (files.hasNext()) {
        const file = files.next();
        if (file.getName().indexOf(watcher.filePrefix) >= 0) {
          const modified = file.getLastUpdated();
          if (modified > oneDayAgo) recentCount++;
          if (!newestDate || modified > newestDate) {
            newestDate = modified;
            newestName = file.getName();
          }
        }
      }

      if (!newestDate) {
        results.checks.push({
          category: 'Mac Watcher Health',
          name: watcher.description,
          status: 'critical',
          message: 'No matching files found — watcher may never have run'
        });
        continue;
      }

      const hoursAgo = (new Date() - newestDate) / (1000 * 60 * 60);

      let status = 'healthy';
      let message = '';

      if (hoursAgo > watcher.criticalHours) {
        status = 'critical';
        message = 'Last file ' + Math.round(hoursAgo) + 'h ago — Mac watcher likely DOWN. ' +
          'Schedule: ' + watcher.schedule + '. Check if Mac is on and logged in.';
      } else if (hoursAgo > watcher.warningHours) {
        status = 'warning';
        message = 'Last file ' + Math.round(hoursAgo) + 'h ago (expected every ~' +
          watcher.expectedFrequencyHours + 'h). Schedule: ' + watcher.schedule;
      } else {
        message = 'Latest: "' + newestName + '" — ' + Math.round(hoursAgo) + 'h ago' +
          (recentCount > 0 ? ' (' + recentCount + ' files in last 24h)' : '');
      }

      // For Ziflow, also check if we got the expected number of files per day
      if (key === 'ziflowExport' && status === 'healthy') {
        if (recentCount < 3 && new Date().getHours() > 16) {
          // After 4 PM, we should have at least 3 of the 4 daily exports
          status = 'warning';
          message += ' — Only ' + recentCount + ' exports in last 24h (expected ~4)';
        }
      }

      results.checks.push({
        category: 'Mac Watcher Health',
        name: watcher.description,
        status: status,
        message: message
      });
    } catch (e) {
      results.checks.push({
        category: 'Mac Watcher Health',
        name: watcher.description,
        status: 'critical',
        message: 'Error: ' + e.message
      });
    }
  }
}

/**
 * 5. SHEETGO SYNC HEALTH — Row counts as a health signal
 *
 * If SheetGo silently disconnects, tabs will have very few or zero rows.
 * This is a critical failure mode — Rejection Rates reporting stops entirely.
 */
function checkSheetGoSyncs_(results) {
  for (const sync of CONFIG.sheetGoSyncs) {
    try {
      const ss = SpreadsheetApp.openById(sync.spreadsheetId);
      const sheet = ss.getSheetByName(sync.sheetName);

      if (!sheet) {
        results.checks.push({
          category: 'SheetGo Sync',
          name: sync.name,
          status: 'critical',
          message: 'Sheet "' + sync.sheetName + '" not found — SheetGo may have disconnected or tab was renamed'
        });
        continue;
      }

      const lastRow = sheet.getLastRow();

      if (lastRow < 10) {
        results.checks.push({
          category: 'SheetGo Sync',
          name: sync.name,
          status: 'critical',
          message: 'Only ' + lastRow + ' rows — SheetGo sync likely FAILED. ' + sync.description
        });
      } else if (lastRow < sync.minExpectedRows) {
        results.checks.push({
          category: 'SheetGo Sync',
          name: sync.name,
          status: 'warning',
          message: lastRow + ' rows (expected at least ' + sync.minExpectedRows + '). ' + sync.description
        });
      } else {
        results.checks.push({
          category: 'SheetGo Sync',
          name: sync.name,
          status: 'healthy',
          message: lastRow + ' rows present'
        });
      }
    } catch (e) {
      results.checks.push({
        category: 'SheetGo Sync',
        name: sync.name,
        status: 'critical',
        message: 'Error: ' + e.message
      });
    }
  }
}

/**
 * 6. FORMULA HEALTH — Value validation + error scanning across key sheets
 */
function checkFormulaHealth_(results) {
  for (const check of CONFIG.formulaChecks) {
    try {
      const ss = SpreadsheetApp.openById(check.spreadsheetId);
      const sheet = ss.getSheetByName(check.sheetName);

      if (!sheet) {
        results.checks.push({
          category: 'Formula Health',
          name: check.name,
          status: 'critical',
          message: 'Sheet "' + check.sheetName + '" not found'
        });
        continue;
      }

      const lastRow = sheet.getLastRow();
      if (lastRow < 2) {
        results.checks.push({
          category: 'Formula Health',
          name: check.name,
          status: 'warning',
          message: 'Sheet is empty or has only headers'
        });
        continue;
      }

      // Mode 1: Value validation (specific column with valid values)
      if (check.validValues) {
        const sampleEnd = Math.min(lastRow, check.sampleRows + 1);
        const colIndex = columnLetterToIndex_(check.column) + 1;
        const values = sheet.getRange(2, colIndex, sampleEnd - 1, 1).getValues();

        let errorCount = 0;
        let errorExamples = [];
        for (let i = 0; i < values.length; i++) {
          const val = String(values[i][0]).trim();
          if (!check.validValues.includes(val)) {
            errorCount++;
            if (errorExamples.length < 3) {
              errorExamples.push('Row ' + (i + 2) + ': "' + val + '"');
            }
          }
        }

        if (errorCount > 0) {
          results.checks.push({
            category: 'Formula Health',
            name: check.name,
            status: 'warning',
            message: errorCount + ' unexpected values in ' + (sampleEnd - 1) + ' rows. ' +
              check.description + '. Examples: ' + errorExamples.join(', ')
          });
        } else {
          results.checks.push({
            category: 'Formula Health',
            name: check.name,
            status: 'healthy',
            message: 'All ' + (sampleEnd - 1) + ' sampled values valid. ' + check.description
          });
        }
      }

      // Mode 2: Error scanning (look for #REF!, #ERROR!, #N/A, #VALUE!)
      if (check.scanForErrors) {
        const sampleEnd = Math.min(lastRow, check.sampleRows + 1);
        const startCol = check.startCol || 1;
        const numCols = Math.min(check.sampleCols, sheet.getLastColumn() - startCol + 1);

        if (numCols <= 0) {
          results.checks.push({
            category: 'Formula Health',
            name: check.name,
            status: 'healthy',
            message: 'Sheet has fewer columns than scan range — no errors possible'
          });
          continue;
        }

        const sample = sheet.getRange(2, startCol, sampleEnd - 1, numCols).getDisplayValues();
        let refErrors = 0;
        let errorLocations = [];

        for (let r = 0; r < sample.length; r++) {
          for (let c = 0; c < sample[r].length; c++) {
            const val = sample[r][c];
            if (val === '#REF!' || val === '#ERROR!' || val === '#N/A' || val === '#VALUE!') {
              refErrors++;
              if (errorLocations.length < 5) {
                errorLocations.push('Row ' + (r + 2) + ' Col ' + columnIndexToLetter_(startCol - 1 + c) + ': ' + val);
              }
            }
          }
        }

        if (refErrors > check.maxAcceptableErrors) {
          results.checks.push({
            category: 'Formula Health',
            name: check.name,
            status: 'warning',
            message: refErrors + ' formula errors in first ' + (sampleEnd - 1) + ' rows × ' + numCols + ' cols. ' +
              check.description + '. Examples: ' + errorLocations.join('; ')
          });
        } else {
          results.checks.push({
            category: 'Formula Health',
            name: check.name,
            status: 'healthy',
            message: refErrors + ' errors in sample (threshold: ' + check.maxAcceptableErrors + '). ' + check.description
          });
        }
      }
    } catch (e) {
      results.checks.push({
        category: 'Formula Health',
        name: check.name,
        status: 'critical',
        message: 'Error: ' + e.message
      });
    }
  }
}

/**
 * 7. CROSS-SPREADSHEET DATA FLOW — Verify data is flowing between spreadsheets
 *
 * Key flows:
 * - Master Ziflow → Rejection Rates (via SheetGo)
 * - Sprout CSV folder → Sprout Master Sprout CSV data (via SheetGo)
 * - VER → Editor Assignment History (via script)
 * - Master Ziflow → WAG ZIFLOW tab (via SheetGo/IMPORTRANGE)
 */
function checkCrossSpreadsheetFlows_(results) {
  for (const flow of CONFIG.dataFlows) {
    try {
      // Check destination freshness
      const destFile = DriveApp.getFileById(flow.destId);
      const destUpdated = destFile.getLastUpdated();
      const destHoursAgo = (new Date() - destUpdated) / (1000 * 60 * 60);

      // If we have a source spreadsheet, check the lag
      if (flow.sourceId) {
        const sourceFile = DriveApp.getFileById(flow.sourceId);
        const sourceUpdated = sourceFile.getLastUpdated();
        const lagHours = (destUpdated - sourceUpdated) / (1000 * 60 * 60);

        // If destination is much older than source, the flow may be broken
        if (lagHours < -flow.maxLagHours) {
          // Source was updated, but destination hasn't caught up
          results.checks.push({
            category: 'Cross-Spreadsheet Data Flow',
            name: flow.name,
            status: 'warning',
            message: flow.sourceName + ' updated ' + Math.round((new Date() - sourceUpdated) / 3600000) +
              'h ago, but ' + flow.destName + ' last updated ' + Math.round(destHoursAgo) +
              'h ago. ' + flow.mechanism + ' may be stale.'
          });
          continue;
        }
      }

      // Also check if destination sheet has data (if specified)
      if (flow.destSheet) {
        const ss = SpreadsheetApp.openById(flow.destId);
        const sheet = ss.getSheetByName(flow.destSheet);
        if (!sheet) {
          results.checks.push({
            category: 'Cross-Spreadsheet Data Flow',
            name: flow.name,
            status: 'critical',
            message: 'Destination sheet "' + flow.destSheet + '" not found in ' + flow.destName
          });
          continue;
        }
        const rowCount = sheet.getLastRow();
        if (rowCount < 5) {
          results.checks.push({
            category: 'Cross-Spreadsheet Data Flow',
            name: flow.name,
            status: 'critical',
            message: 'Destination sheet "' + flow.destSheet + '" has only ' + rowCount +
              ' rows — ' + flow.mechanism + ' may be broken'
          });
          continue;
        }
      }

      results.checks.push({
        category: 'Cross-Spreadsheet Data Flow',
        name: flow.name,
        status: 'healthy',
        message: flow.destName + ' updated ' + Math.round(destHoursAgo) + 'h ago. ' + flow.mechanism + ' appears active.'
      });
    } catch (e) {
      results.checks.push({
        category: 'Cross-Spreadsheet Data Flow',
        name: flow.name,
        status: 'critical',
        message: 'Error checking flow: ' + e.message
      });
    }
  }
}

/**
 * 8. FILMING SCHEDULE NOTIFICATIONS LIBRARY — Check accessibility
 *
 * Client DMR spreadsheets depend on the FilmingScheduleNotifications library (via
 * FilmingScheduleWrapper). If the template spreadsheet is inaccessible, new client
 * filming schedules can't be set up and existing notifications may fail.
 */
function checkFilmingScheduleLibrary_(results) {
  try {
    const file = DriveApp.getFileById(CONFIG.filmingScheduleLibrary.testSpreadsheetId);
    const lastUpdated = file.getLastUpdated();
    const hoursAgo = (new Date() - lastUpdated) / (1000 * 60 * 60);

    results.checks.push({
      category: 'Filming Schedule System',
      name: 'Filming Schedule Template (library dependency)',
      status: 'healthy',
      message: 'Template accessible. Last updated ' + Math.round(hoursAgo) + 'h ago. ' +
        'Used by DMR-Template-V2, South Cove DMR, St Mark Village DMR, and all client filming schedules.'
    });
  } catch (e) {
    results.checks.push({
      category: 'Filming Schedule System',
      name: 'Filming Schedule Template (library dependency)',
      status: 'critical',
      message: 'Cannot access template: ' + e.message +
        ' — This will break filming schedule notifications for ALL clients.'
    });
  }

  // Also note the aggressive 1-minute triggers on DMR spreadsheets
  results.checks.push({
    category: 'Filming Schedule System',
    name: 'DMR checkAndRenameSheet triggers (info)',
    status: 'healthy',
    message: 'Note: 4 spreadsheets (DMR-Template-V2, Filming-Schedule-Template, South-Cove-DMR, St-Mark-Village-DMR) ' +
      'each run checkAndRenameSheet every 1 minute. This is by design but uses trigger quota.'
  });
}


// ==================== EMAIL ====================

function sendHealthCheckEmail_(results) {
  const statusIcon = {
    healthy: '&#9989;',   // green check
    warning: '&#9888;&#65039;',   // warning
    critical: '&#128680;'  // siren
  };

  const statusColor = {
    healthy: '#2e7d32',
    warning: '#f57f17',
    critical: '#c62828'
  };

  const statusBgColor = {
    healthy: '#f1f8e9',
    warning: '#fff8e1',
    critical: '#ffebee'
  };

  const overallColor = statusColor[results.overallStatus];
  const overallLabel = results.overallStatus.charAt(0).toUpperCase() + results.overallStatus.slice(1);

  // Separate checks by status
  const criticalChecks = results.checks.filter(c => c.status === 'critical');
  const warningChecks = results.checks.filter(c => c.status === 'warning');
  const healthyChecks = results.checks.filter(c => c.status === 'healthy');

  // Group checks by category
  const categories = {};
  const categoryOrder = [
    'Column Layout',
    'Mac Watcher Health',
    'CSV Pipeline',
    'SheetGo Sync',
    'Cross-Spreadsheet Data Flow',
    'Formula Health',
    'Spreadsheet Freshness',
    'Filming Schedule System'
  ];

  for (const check of results.checks) {
    if (!categories[check.category]) {
      categories[check.category] = [];
    }
    categories[check.category].push(check);
  }

  // Build Action Items section
  let actionItemsHtml = '';
  if (criticalChecks.length > 0 || warningChecks.length > 0) {
    actionItemsHtml = '<div style="background-color: #ffebee; border-left: 4px solid #c62828; padding: 15px; margin: 20px 0; border-radius: 5px;">';
    actionItemsHtml += '<h3 style="margin: 0 0 10px 0; color: #c62828;">Action Items</h3>';
    actionItemsHtml += '<ol style="margin: 0; padding-left: 20px;">';

    for (const check of criticalChecks) {
      actionItemsHtml += '<li style="margin-bottom: 8px;"><strong style="color: #c62828;">[CRITICAL]</strong> ' +
        '<strong>' + check.category + ' — ' + check.name + ':</strong> ' +
        check.message.split('\n')[0] + '</li>';
    }
    for (const check of warningChecks) {
      actionItemsHtml += '<li style="margin-bottom: 8px;"><strong style="color: #f57f17;">[WARNING]</strong> ' +
        '<strong>' + check.category + ' — ' + check.name + ':</strong> ' +
        check.message.split('\n')[0] + '</li>';
    }

    actionItemsHtml += '</ol></div>';
  }

  // Build "What to tell Claude" section
  let claudeHtml = '';
  if (criticalChecks.length > 0 || warningChecks.length > 0) {
    claudeHtml = '<div style="background-color: #e3f2fd; border-left: 4px solid #2196F3; padding: 15px; margin: 20px 0; border-radius: 5px;">';
    claudeHtml += '<h3 style="margin: 0 0 10px 0; color: #1976D2;">What to Tell Claude</h3>';
    claudeHtml += '<p style="margin: 0 0 10px 0; color: #555;">Open Claude Code and use one of these phrases depending on the issue:</p>';
    claudeHtml += '<table style="width: 100%; border-collapse: collapse; font-size: 13px;">';

    // Column layout issues
    if (results.checks.some(c => c.category === 'Column Layout' && c.status !== 'healthy')) {
      claudeHtml += '<tr><td style="padding: 6px; border-bottom: 1px solid #ddd; vertical-align: top;"><strong>Column shift:</strong></td>' +
        '<td style="padding: 6px; border-bottom: 1px solid #ddd;">"My health check found a column layout shift in [sheet name]. ' +
        'The columns have moved — check the hardcoded column positions in the scripts that read from this sheet and update them."</td></tr>';
    }

    // Mac watcher issues
    if (results.checks.some(c => c.category === 'Mac Watcher Health' && c.status !== 'healthy')) {
      claudeHtml += '<tr><td style="padding: 6px; border-bottom: 1px solid #ddd; vertical-align: top;"><strong>Mac watcher:</strong></td>' +
        '<td style="padding: 6px; border-bottom: 1px solid #ddd;">"My Ziflow/Sprout watcher on the Mac seems to have stopped. ' +
        'Check if the launchd agents are loaded and the scripts are running."</td></tr>';
    }

    // SheetGo issues
    if (results.checks.some(c => c.category === 'SheetGo Sync' && c.status !== 'healthy')) {
      claudeHtml += '<tr><td style="padding: 6px; border-bottom: 1px solid #ddd; vertical-align: top;"><strong>SheetGo:</strong></td>' +
        '<td style="padding: 6px; border-bottom: 1px solid #ddd;">"SheetGo sync looks broken for [tab name]. ' +
        'The tab has too few rows. Can you check what scripts depend on this data and help me figure out what happened?"</td></tr>';
    }

    // CSV pipeline issues
    if (results.checks.some(c => c.category === 'CSV Pipeline' && c.status !== 'healthy')) {
      claudeHtml += '<tr><td style="padding: 6px; border-bottom: 1px solid #ddd; vertical-align: top;"><strong>CSV pipeline:</strong></td>' +
        '<td style="padding: 6px; border-bottom: 1px solid #ddd;">"The CSV pipeline for [Sprout/Ziflow] looks stale — ' +
        'no new files in the Drive folder. Check if the Mac watcher is running and if the export is happening."</td></tr>';
    }

    // Formula errors
    if (results.checks.some(c => c.category === 'Formula Health' && c.status !== 'healthy')) {
      claudeHtml += '<tr><td style="padding: 6px; border-bottom: 1px solid #ddd; vertical-align: top;"><strong>Formula errors:</strong></td>' +
        '<td style="padding: 6px; border-bottom: 1px solid #ddd;">"My health check found formula errors (#REF! or unexpected values) in [sheet name]. ' +
        'Can you look at the sheet and fix or diagnose the issue?"</td></tr>';
    }

    // Cross-spreadsheet flow issues
    if (results.checks.some(c => c.category === 'Cross-Spreadsheet Data Flow' && c.status !== 'healthy')) {
      claudeHtml += '<tr><td style="padding: 6px; border-bottom: 1px solid #ddd; vertical-align: top;"><strong>Data flow:</strong></td>' +
        '<td style="padding: 6px; border-bottom: 1px solid #ddd;">"Data isn\'t flowing from [source] to [destination]. ' +
        'The destination sheet is stale. Check if SheetGo or the sync script is working."</td></tr>';
    }

    // Spreadsheet access issues
    if (results.checks.some(c => c.category === 'Spreadsheet Freshness' && c.status === 'critical')) {
      claudeHtml += '<tr><td style="padding: 6px; border-bottom: 1px solid #ddd; vertical-align: top;"><strong>Access issue:</strong></td>' +
        '<td style="padding: 6px; border-bottom: 1px solid #ddd;">"The health check can\'t access [spreadsheet name]. ' +
        'Can you help me check if permissions changed or if the spreadsheet was moved?"</td></tr>';
    }

    // Filming schedule issues
    if (results.checks.some(c => c.category === 'Filming Schedule System' && c.status !== 'healthy')) {
      claudeHtml += '<tr><td style="padding: 6px; border-bottom: 1px solid #ddd; vertical-align: top;"><strong>Filming schedule:</strong></td>' +
        '<td style="padding: 6px; border-bottom: 1px solid #ddd;">"The Filming Schedule Template is inaccessible. ' +
        'This could break filming notifications for all clients. Can you check what happened?"</td></tr>';
    }

    // General catch-all
    claudeHtml += '<tr><td style="padding: 6px; border-bottom: 1px solid #ddd; vertical-align: top;"><strong>General:</strong></td>' +
      '<td style="padding: 6px; border-bottom: 1px solid #ddd;">"My morning health check found issues — take a look at the email and help me fix them."</td></tr>';

    claudeHtml += '</table></div>';
  }

  // Build detailed checks by category
  let checksHtml = '';
  const orderedCategories = categoryOrder.filter(c => categories[c]);
  // Add any categories not in our explicit order
  for (const cat of Object.keys(categories)) {
    if (!orderedCategories.includes(cat)) orderedCategories.push(cat);
  }

  for (const category of orderedCategories) {
    const checks = categories[category];
    if (!checks) continue;

    const categoryHasIssues = checks.some(c => c.status !== 'healthy');
    const catIcon = categoryHasIssues ?
      (checks.some(c => c.status === 'critical') ? '&#128680;' : '&#9888;&#65039;') : '&#9989;';

    checksHtml += '<h3 style="margin: 25px 0 10px 0; color: #333; border-bottom: 1px solid #ddd; padding-bottom: 5px;">' +
      catIcon + ' ' + category + '</h3>';
    checksHtml += '<table style="width: 100%; border-collapse: collapse; font-size: 13px;">';

    // Sort: critical first, then warning, then healthy
    const sortOrder = { critical: 0, warning: 1, healthy: 2 };
    checks.sort((a, b) => sortOrder[a.status] - sortOrder[b.status]);

    for (const check of checks) {
      const icon = statusIcon[check.status];
      const bgColor = statusBgColor[check.status];
      // Convert newlines to <br> for multi-line messages
      const messageHtml = check.message.replace(/\n/g, '<br>');

      checksHtml += '<tr style="background-color: ' + bgColor + ';">' +
        '<td style="padding: 8px; border-bottom: 1px solid #eee; width: 30px; text-align: center; vertical-align: top;">' + icon + '</td>' +
        '<td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold; width: 30%; vertical-align: top;">' + check.name + '</td>' +
        '<td style="padding: 8px; border-bottom: 1px solid #eee; color: #555;">' + messageHtml + '</td>' +
        '</tr>';
    }
    checksHtml += '</table>';
  }

  // Compose subject
  const subjectPrefix = results.overallStatus === 'healthy' ? 'All Clear' :
    (results.overallStatus === 'warning' ? 'Warnings' : 'ISSUES FOUND');
  const subject = 'Automation Health Check — ' + subjectPrefix +
    ' (' + criticalChecks.length + ' critical, ' + warningChecks.length + ' warnings, ' + healthyChecks.length + ' ok)';

  // Compose full email
  const html = '<div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">' +

    // Header banner
    '<div style="background-color: ' + statusBgColor[results.overallStatus] +
    '; border-left: 4px solid ' + overallColor + '; padding: 20px; border-radius: 5px;">' +
    '<h2 style="color: ' + overallColor + '; margin-top: 0;">Automation Health Check — ' + overallLabel + '</h2>' +
    '<p style="margin: 0;">' +
    '<strong>' + healthyChecks.length + '</strong> healthy &nbsp;|&nbsp; ' +
    '<strong>' + warningChecks.length + '</strong> warnings &nbsp;|&nbsp; ' +
    '<strong>' + criticalChecks.length + '</strong> critical' +
    '</p>' +
    '<p style="margin: 5px 0 0 0; color: #666; font-size: 13px;">' +
    Utilities.formatDate(results.timestamp, Session.getScriptTimeZone(), 'EEEE, MMMM d, yyyy h:mm a') +
    '</p></div>' +

    // Action Items (only if issues exist)
    actionItemsHtml +

    // What to tell Claude (only if issues exist)
    claudeHtml +

    // All checks by category
    checksHtml +

    // Footer
    '<hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">' +
    '<p style="color: #999; font-size: 11px;">' +
    'Generated by Automation Health Check &mdash; runs weekdays at 7:30 AM<br>' +
    'Monitoring: ' + Object.keys(CONFIG.spreadsheets).length + ' spreadsheets, ' +
    Object.keys(CONFIG.columnChecks).length + ' column layouts, ' +
    Object.keys(CONFIG.csvPipeline).length + ' CSV pipelines, ' +
    CONFIG.sheetGoSyncs.length + ' SheetGo syncs, ' +
    CONFIG.formulaChecks.length + ' formula checks, ' +
    Object.keys(CONFIG.macWatchers).length + ' Mac watchers, ' +
    CONFIG.dataFlows.length + ' data flows<br>' +
    'Repos covered: Master-Ziflow-Data-Scripts, WAG, VER, Rejection-Rates, Search-Engine, ' +
    'SMM-Payment-Calculator, DMR-Template-V2, Filming-Schedule-Template, ' +
    'FilmingScheduleNotificationsImplementation, FilmingScheduleWrapper, ' +
    'Footage-Management-Form, Editor-Assignment-History, South-Cove-DMR, St-Mark-Village-DMR' +
    '</p></div>';

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
 * The trigger fires daily; the script skips weekends internally.
 */
function setupHealthCheckTrigger() {
  // Remove existing triggers for this function
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(trigger) {
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

  Logger.log('Health check trigger created: daily at ~7:30 AM (weekdays only — skips weekends in code)');
}

/**
 * Run manually to test the health check (bypasses weekend check).
 */
function testHealthCheck() {
  const results = {
    timestamp: new Date(),
    checks: [],
    overallStatus: 'healthy'
  };

  // Run all checks (no weekend skip)
  checkSpreadsheetFreshness_(results);
  checkColumnLayouts_(results);
  checkCSVPipelines_(results);
  checkMacWatcherHealth_(results);
  checkSheetGoSyncs_(results);
  checkFormulaHealth_(results);
  checkCrossSpreadsheetFlows_(results);
  checkFilmingScheduleLibrary_(results);

  // Determine overall status
  const criticalCount = results.checks.filter(c => c.status === 'critical').length;
  const warningCount = results.checks.filter(c => c.status === 'warning').length;

  if (criticalCount > 0) {
    results.overallStatus = 'critical';
  } else if (warningCount > 0) {
    results.overallStatus = 'warning';
  }

  sendHealthCheckEmail_(results);

  Logger.log('TEST health check complete: ' + results.overallStatus +
    ' (' + criticalCount + ' critical, ' + warningCount + ' warnings, ' +
    results.checks.filter(c => c.status === 'healthy').length + ' healthy)');
}

/**
 * Run to see a quick summary in the log (no email).
 */
function dryRunHealthCheck() {
  const results = {
    timestamp: new Date(),
    checks: [],
    overallStatus: 'healthy'
  };

  checkSpreadsheetFreshness_(results);
  checkColumnLayouts_(results);
  checkCSVPipelines_(results);
  checkMacWatcherHealth_(results);
  checkSheetGoSyncs_(results);
  checkFormulaHealth_(results);
  checkCrossSpreadsheetFlows_(results);
  checkFilmingScheduleLibrary_(results);

  const criticalCount = results.checks.filter(c => c.status === 'critical').length;
  const warningCount = results.checks.filter(c => c.status === 'warning').length;

  Logger.log('=== DRY RUN RESULTS ===');
  for (const check of results.checks) {
    const icon = check.status === 'healthy' ? 'OK' : (check.status === 'warning' ? 'WARN' : 'CRIT');
    Logger.log('[' + icon + '] ' + check.category + ' > ' + check.name + ': ' + check.message);
  }
  Logger.log('=== TOTAL: ' + criticalCount + ' critical, ' + warningCount + ' warnings, ' +
    results.checks.filter(c => c.status === 'healthy').length + ' healthy ===');
}


// ==================== UTILITIES ====================

/**
 * Convert column letter (A, B, ..., Z, AA, AB, ..., FI) to 0-based index.
 */
function columnLetterToIndex_(letter) {
  let index = 0;
  for (let i = 0; i < letter.length; i++) {
    index = index * 26 + (letter.charCodeAt(i) - 64);
  }
  return index - 1;
}

/**
 * Convert 0-based column index to letter (0→A, 25→Z, 26→AA, etc.).
 */
function columnIndexToLetter_(index) {
  let letter = '';
  let idx = index;
  while (idx >= 0) {
    letter = String.fromCharCode((idx % 26) + 65) + letter;
    idx = Math.floor(idx / 26) - 1;
  }
  return letter;
}
