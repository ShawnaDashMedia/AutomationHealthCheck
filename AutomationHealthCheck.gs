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

  // ---- Remote Control spreadsheet ----
  // This spreadsheet acts as the control panel for the health check system.
  // Create a spreadsheet and paste its ID here, then run setupRemoteControl() once.
  remoteControlSpreadsheetId: '',  // Set after creating the control spreadsheet

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
    smmPayment: {
      id: '1P3K9hKUiGO3c_5H1k79lwCQeFy0ifXtyxnsWaeui9Yw',
      name: 'SMM Payment Calculator',
      sheets: [],
      maxStaleHours: 168,
      description: 'Payroll periods on 9th-15th and 24th-EOM'
    },
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
  csvPipeline: {
    sproutCSV: {
      folderName: 'SheetGo - SPROUT CSV',
      checkName: 'Sprout CSV Pipeline (Mac Watcher → Drive)',
      maxStaleHours: 36,     // Should arrive every weekday
      filePrefix: 'Post Performance',
      description: 'Mac watcher copies Sprout CSVs here for SheetGo pickup'
    },
    ziflowCSV: {
      folderName: 'SheetGo - ZIFLOW CSV',
      checkName: 'Ziflow CSV Pipeline (Mac Watcher → Drive)',
      maxStaleHours: 8,      // Ziflow exports 4x/day (7am,10am,1pm,4pm)
      filePrefix: 'export-proofs',
      description: 'Mac watcher copies Ziflow CSVs here for SheetGo pickup'
    },
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
        // Core columns used by multiple scripts (hardcoded numeric indexes)
        'A': 'Index',                     // data[i][0]
        'B': 'Status',                    // data[i][1] — checkForQuestionMark, Rejection Discrepancy
        'C': 'Company',                   // data[i][2] — Rejection Discrepancy
        'D': 'Proof Name',               // data[i][3] — sendDuplicateData, sendFailedProof, checkShortLeadTime
        'N': 'Owner',                     // data[i][13] — checkForQuestionMark, sendDuplicateData, sendFailedProof
        'O': 'Proof ID',                 // data[i][14] — sendDuplicateDataReport
        'AF': 'SMM',                      // data[i][31] — sendDuplicateDataReport
        'AK': 'Rejection Count',          // data[i][36] — Rejection Discrepancy Alert fallback
        'AT': 'Ziflow URL',              // data[i][45] — sendDuplicateData, sendFailedProof
        'AU': 'Ziflow ID',               // data[i][46] — sendDuplicateData, checkShortLeadTime
        'AW': 'Lead Time',               // data[i][48] — checkShortLeadTimeSpecialRequests
        'AZ': 'Revision Status',          // data[i][51] — Rejection Discrepancy fallback
        'BB': 'Failed',                   // data[i][53] — sendFailedProofEmail
        'BJ': 'Workflow',                // data[i][61] — checkForQuestionMark
        'BK': 'Created Date',            // data[i][62] — checkForQuestionMark, sendDuplicateData, checkShortLeadTime
        'BQ': 'Special Request Flag',    // data[i][68] — checkShortLeadTimeSpecialRequests
        'BS': 'Request Type',            // data[i][70] — checkShortLeadTimeSpecialRequests
        'CC': 'Fee Tier',                // data[i][80] — checkShortLeadTimeSpecialRequests
        'FI': 'Extended Field'            // data[i][164] — checkShortLeadTimeSpecialRequests (165 cols wide!)
      }
    },

    // === Sprout Analytics MASTER - Data Dump ===
    // Used by: Sprout-Master scripts (tag checking, posting status)
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

    // === Sprout Analytics MASTER - Sprout CSV data ===
    // SheetGo-fed tab; column layout must match for formulas
    sproutCSVData: {
      spreadsheetId: '11BOmRd4V-Q-48gL5NfQ-ydpPB4emhsjgLj27TXordTE',
      sheetName: 'Sprout CSV data',
      expectedColumns: {
        'A': 'Date',
        'B': 'Post ID',
        'BR': 'Tags'
      }
    },

    // === WAG - Filming Summary Database ===
    // Used by: WAG Assignment Alert (hardcoded), Footage-Management-Form (hardcoded col numbers)
    wagFilmingSummary: {
      spreadsheetId: '1JkrY9OvWGd_7299LXueCPu25GZKdpwSsMQCD1aDwoHU',
      sheetName: 'Filming Summary Database',
      expectedColumns: {
        'A': 'Client',                    // CLIENT_COL=0
        'AD': 'Footage ID',              // Column 30 — Footage-Management-Form
        'AE': 'Assignment Count',         // FOOTAGE_COL=29 (WAG Assignment Alert)
        'AK': 'Exhausted/Retired',        // Column 37 — Footage-Management-Form
        'AW': 'Editor Notes',             // Column 49 — Footage-Management-Form
        'AX': 'Note Date',               // ASSIGNMENT_COUNT_COL=50 area
        'AY': 'Alert Flag',              // ALERT_COL=51 (WAG Assignment Alert)
        'AZ': 'Alert Status'              // ALERT_COL=51 extended
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

    // === SMM Payment Calculator ===
    // Uses columns 2,3,4,11 and Z:AA for payroll
    smmPaymentCalc: {
      spreadsheetId: '1P3K9hKUiGO3c_5H1k79lwCQeFy0ifXtyxnsWaeui9Yw',
      sheetName: 'Sheet1',
      expectedColumns: {
        'B': null,  // Column 2
        'C': null,  // Column 3
        'D': null,  // Column 4
        'K': null,  // Column 11
        'Z': null,  // Payroll data
        'AA': null  // Payroll data
      }
    }
  },

  // ---- Mac watcher freshness (inferred from Drive file dates) ----
  macWatchers: {
    ziflowExport: {
      folderName: 'SheetGo - ZIFLOW CSV',
      filePrefix: 'export-proofs',
      expectedFrequencyHours: 8,     // 4x/day → new file roughly every 3-4 hrs on weekdays
      warningHours: 10,
      criticalHours: 24,
      schedule: '7:00 AM, 10:00 AM, 1:00 PM, 4:00 PM',
      description: 'ziflow-export-proofs.sh → export-proofs-watcher.sh → Drive'
    },
    sproutExport: {
      folderName: 'SheetGo - SPROUT CSV',
      filePrefix: 'Post Performance',
      expectedFrequencyHours: 24,    // 1x/day on weekdays
      warningHours: 36,
      criticalHours: 72,
      schedule: 'Once per weekday (manual Sprout download → watcher)',
      description: 'sprout-post-performance-watcher.sh → Drive'
    }
  },

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
    {
      name: 'Sprout CSV → Sprout Master (SheetGo)',
      sourceId: null,  // Drive folder, not a spreadsheet
      sourceName: 'SheetGo - SPROUT CSV folder',
      destId: '11BOmRd4V-Q-48gL5NfQ-ydpPB4emhsjgLj27TXordTE',
      destName: 'Sprout Analytics MASTER',
      destSheet: 'Sprout CSV data',
      maxLagHours: 48,
      mechanism: 'SheetGo sync from Drive CSV'
    },
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
    {
      name: 'Sprout CSV data',
      spreadsheetId: '11BOmRd4V-Q-48gL5NfQ-ydpPB4emhsjgLj27TXordTE',
      sheetName: 'Sprout CSV data',
      minExpectedRows: 100,
      description: 'SheetGo from Sprout CSV files in Drive'
    },
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
      const headers = lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];
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


// ==================== REMOTE CONTROL ====================

/**
 * Remote Control System
 *
 * Provides two ways to remotely manage the health check:
 *
 * 1. CONTROL SPREADSHEET — A dedicated spreadsheet with:
 *    - "Control Panel" sheet: toggle checks on/off, trigger runs, view status
 *    - "Run Log" sheet: history of all health check runs
 *    - "Overrides" sheet: temporarily adjust thresholds without editing code
 *
 * 2. WEB APP ENDPOINT — Deploy as web app for URL-based triggering:
 *    - GET ?action=run         → Run full health check now
 *    - GET ?action=run&check=X → Run a single check category
 *    - GET ?action=status      → Get last run status as JSON
 *    - GET ?action=pause       → Pause scheduled runs
 *    - GET ?action=resume      → Resume scheduled runs
 *    - GET ?action=log         → Get recent run history as JSON
 *
 * Setup: Run setupRemoteControl() once to create the control spreadsheet.
 * Deploy: Publish > Deploy as web app (execute as me, anyone with link).
 */

// ---- Control Spreadsheet Setup ----

/**
 * Run once to create the remote control spreadsheet and populate it.
 * After running, copy the logged spreadsheet ID into CONFIG.remoteControlSpreadsheetId.
 */
function setupRemoteControl() {
  const ss = SpreadsheetApp.create('Automation Health Check — Remote Control');
  const ssId = ss.getId();

  // --- Control Panel sheet ---
  const controlSheet = ss.getSheets()[0];
  controlSheet.setName('Control Panel');

  // Header
  controlSheet.getRange('A1').setValue('Automation Health Check — Remote Control').setFontSize(16).setFontWeight('bold');
  controlSheet.getRange('A2').setValue('Toggle checks, trigger runs, and view status from here.').setFontColor('#666');
  controlSheet.getRange('A3').setValue('Last refreshed:').setFontWeight('bold');
  controlSheet.getRange('B3').setValue(new Date()).setNumberFormat('yyyy-MM-dd h:mm:ss a');

  // System status
  controlSheet.getRange('A5:D5').setValues([['Setting', 'Value', 'Description', 'Updated']]);
  controlSheet.getRange('A5:D5').setFontWeight('bold').setBackground('#e8eaf6');

  const settings = [
    ['Paused', 'FALSE', 'Set to TRUE to pause scheduled health checks', ''],
    ['Email Alerts', 'TRUE', 'Set to FALSE to suppress email alerts', ''],
    ['Weekend Override', 'FALSE', 'Set to TRUE to run on weekends too', ''],
    ['Last Run Status', '', 'Populated automatically after each run', ''],
    ['Last Run Time', '', 'Populated automatically after each run', ''],
    ['Critical Count', '', 'From last run', ''],
    ['Warning Count', '', 'From last run', ''],
    ['Healthy Count', '', 'From last run', '']
  ];
  controlSheet.getRange(6, 1, settings.length, 4).setValues(settings);

  // Check toggles
  controlSheet.getRange('A16').setValue('Check Toggles').setFontSize(14).setFontWeight('bold');
  controlSheet.getRange('A17:C17').setValues([['Check Category', 'Enabled', 'Notes']]);
  controlSheet.getRange('A17:C17').setFontWeight('bold').setBackground('#e8eaf6');

  const checkToggles = [
    ['Spreadsheet Freshness', 'TRUE', 'All 10 spreadsheets'],
    ['Column Layout', 'TRUE', 'Every hardcoded position risk'],
    ['CSV Pipeline', 'TRUE', 'Sprout, Ziflow, SMM Reports'],
    ['Mac Watcher Health', 'TRUE', 'Inferred from Drive file freshness'],
    ['SheetGo Sync', 'TRUE', 'Row counts as health signal'],
    ['Formula Health', 'TRUE', 'Value validation + error scanning'],
    ['Cross-Spreadsheet Data Flow', 'TRUE', 'Data flow freshness'],
    ['Filming Schedule System', 'TRUE', 'Library accessibility']
  ];
  controlSheet.getRange(18, 1, checkToggles.length, 3).setValues(checkToggles);

  // Add data validation (TRUE/FALSE dropdowns) for toggle cells
  const boolRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['TRUE', 'FALSE'], true)
    .build();

  // Settings toggles (B6:B8)
  controlSheet.getRange('B6:B8').setDataValidation(boolRule);
  // Check toggles (B18:B25)
  controlSheet.getRange(18, 2, checkToggles.length, 1).setDataValidation(boolRule);

  // Quick actions section
  controlSheet.getRange('A28').setValue('Quick Actions').setFontSize(14).setFontWeight('bold');
  controlSheet.getRange('A29').setValue('To trigger a run: go to Extensions > Apps Script and run remoteRunHealthCheck()');
  controlSheet.getRange('A30').setValue('Or use the web app URL (see Deploy instructions in the script).');

  // Format column widths
  controlSheet.setColumnWidth(1, 220);
  controlSheet.setColumnWidth(2, 120);
  controlSheet.setColumnWidth(3, 400);
  controlSheet.setColumnWidth(4, 180);

  // --- Run Log sheet ---
  const logSheet = ss.insertSheet('Run Log');
  logSheet.getRange('A1:F1').setValues([['Timestamp', 'Status', 'Critical', 'Warnings', 'Healthy', 'Trigger Source']]);
  logSheet.getRange('A1:F1').setFontWeight('bold').setBackground('#e8eaf6');
  logSheet.setColumnWidth(1, 200);
  logSheet.setColumnWidth(6, 150);

  // --- Overrides sheet ---
  const overrideSheet = ss.insertSheet('Overrides');
  overrideSheet.getRange('A1').setValue('Threshold Overrides').setFontSize(14).setFontWeight('bold');
  overrideSheet.getRange('A2').setValue('Override stale thresholds without editing code. Leave Value blank to use the default.').setFontColor('#666');
  overrideSheet.getRange('A4:D4').setValues([['Spreadsheet Key', 'Default maxStaleHours', 'Override Value', 'Notes']]);
  overrideSheet.getRange('A4:D4').setFontWeight('bold').setBackground('#e8eaf6');

  let row = 5;
  for (const [key, config] of Object.entries(CONFIG.spreadsheets)) {
    overrideSheet.getRange(row, 1, 1, 4).setValues([
      [key, config.maxStaleHours, '', config.name]
    ]);
    row++;
  }

  overrideSheet.setColumnWidth(1, 220);
  overrideSheet.setColumnWidth(2, 160);
  overrideSheet.setColumnWidth(3, 130);
  overrideSheet.setColumnWidth(4, 350);

  // Log the ID for the user to paste into CONFIG
  Logger.log('Remote Control spreadsheet created!');
  Logger.log('Spreadsheet ID: ' + ssId);
  Logger.log('URL: ' + ss.getUrl());
  Logger.log('');
  Logger.log('NEXT STEP: Paste this ID into CONFIG.remoteControlSpreadsheetId:');
  Logger.log("  remoteControlSpreadsheetId: '" + ssId + "'");
}

// ---- Remote Control Helpers ----

/**
 * Read the control panel settings from the remote control spreadsheet.
 * Returns null if the spreadsheet is not configured.
 */
function getRemoteControlSettings_() {
  if (!CONFIG.remoteControlSpreadsheetId) return null;

  try {
    const ss = SpreadsheetApp.openById(CONFIG.remoteControlSpreadsheetId);
    const sheet = ss.getSheetByName('Control Panel');
    if (!sheet) return null;

    // Read settings (rows 6-13, columns A-B)
    const settingValues = sheet.getRange('A6:B13').getValues();
    const settings = {};
    for (const [key, val] of settingValues) {
      settings[String(key).trim()] = String(val).trim();
    }

    // Read check toggles (rows 18-25, columns A-B)
    const toggleValues = sheet.getRange('A18:B25').getValues();
    const toggles = {};
    for (const [category, enabled] of toggleValues) {
      if (category) {
        toggles[String(category).trim()] = String(enabled).trim().toUpperCase() === 'TRUE';
      }
    }

    // Read threshold overrides
    const overrideSheet = ss.getSheetByName('Overrides');
    const overrides = {};
    if (overrideSheet) {
      const overrideData = overrideSheet.getDataRange().getValues();
      for (let i = 4; i < overrideData.length; i++) {  // Skip header rows
        const key = String(overrideData[i][0]).trim();
        const overrideVal = overrideData[i][2];
        if (key && overrideVal !== '' && overrideVal !== null && !isNaN(overrideVal)) {
          overrides[key] = Number(overrideVal);
        }
      }
    }

    return {
      paused: settings['Paused'] === 'TRUE',
      emailAlerts: settings['Email Alerts'] !== 'FALSE',
      weekendOverride: settings['Weekend Override'] === 'TRUE',
      toggles: toggles,
      overrides: overrides,
      spreadsheet: ss
    };
  } catch (e) {
    Logger.log('Remote control spreadsheet error: ' + e.message);
    return null;
  }
}

/**
 * Update the control panel with results from a health check run.
 */
function updateRemoteControlStatus_(results, triggerSource) {
  if (!CONFIG.remoteControlSpreadsheetId) return;

  try {
    const ss = SpreadsheetApp.openById(CONFIG.remoteControlSpreadsheetId);
    const controlSheet = ss.getSheetByName('Control Panel');

    if (controlSheet) {
      const criticalCount = results.checks.filter(c => c.status === 'critical').length;
      const warningCount = results.checks.filter(c => c.status === 'warning').length;
      const healthyCount = results.checks.filter(c => c.status === 'healthy').length;

      // Update status fields (rows 9-13)
      controlSheet.getRange('B3').setValue(new Date());
      controlSheet.getRange('B9').setValue(results.overallStatus.toUpperCase());
      controlSheet.getRange('B10').setValue(new Date());
      controlSheet.getRange('B11').setValue(criticalCount);
      controlSheet.getRange('B12').setValue(warningCount);
      controlSheet.getRange('B13').setValue(healthyCount);

      // Color-code the status cell
      const statusColors = { healthy: '#c8e6c9', warning: '#fff9c4', critical: '#ffcdd2' };
      controlSheet.getRange('B9').setBackground(statusColors[results.overallStatus] || '#ffffff');

      // Update the "Updated" column for status rows
      const now = new Date();
      controlSheet.getRange('D9:D13').setValues([[now], [now], [now], [now], [now]]);
    }

    // Append to Run Log
    const logSheet = ss.getSheetByName('Run Log');
    if (logSheet) {
      const criticalCount = results.checks.filter(c => c.status === 'critical').length;
      const warningCount = results.checks.filter(c => c.status === 'warning').length;
      const healthyCount = results.checks.filter(c => c.status === 'healthy').length;

      logSheet.insertRowAfter(1);
      logSheet.getRange(2, 1, 1, 6).setValues([[
        new Date(),
        results.overallStatus.toUpperCase(),
        criticalCount,
        warningCount,
        healthyCount,
        triggerSource || 'scheduled'
      ]]);

      // Color-code the status
      const statusColors = { healthy: '#c8e6c9', warning: '#fff9c4', critical: '#ffcdd2' };
      logSheet.getRange(2, 2).setBackground(statusColors[results.overallStatus] || '#ffffff');

      // Keep only last 100 log entries
      const lastRow = logSheet.getLastRow();
      if (lastRow > 101) {
        logSheet.deleteRows(102, lastRow - 101);
      }
    }
  } catch (e) {
    Logger.log('Failed to update remote control: ' + e.message);
  }
}

/**
 * Check if a specific check category is enabled via remote control.
 * Returns true if remote control is not configured (all checks run by default).
 */
function isCheckEnabled_(categoryName) {
  const settings = getRemoteControlSettings_();
  if (!settings) return true;  // No remote control = all checks enabled
  if (settings.toggles[categoryName] === undefined) return true;  // Unknown category = enabled
  return settings.toggles[categoryName];
}

/**
 * Apply threshold overrides from the remote control spreadsheet.
 * Call this before running checks to pick up any override values.
 */
function applyThresholdOverrides_() {
  const settings = getRemoteControlSettings_();
  if (!settings || Object.keys(settings.overrides).length === 0) return;

  for (const [key, overrideHours] of Object.entries(settings.overrides)) {
    if (CONFIG.spreadsheets[key]) {
      Logger.log('Override: ' + key + ' maxStaleHours ' +
        CONFIG.spreadsheets[key].maxStaleHours + ' → ' + overrideHours);
      CONFIG.spreadsheets[key].maxStaleHours = overrideHours;
    }
  }
}


// ---- Remote-Triggered Run Functions ----

/**
 * Run health check with remote control integration.
 * Respects pause state, check toggles, and threshold overrides.
 * Can be called from the control spreadsheet, web app, or trigger.
 */
function remoteRunHealthCheck(triggerSource) {
  const source = triggerSource || 'manual';
  const settings = getRemoteControlSettings_();

  // Check if paused (unless this is a forced manual run)
  if (settings && settings.paused && source !== 'forced') {
    Logger.log('Health check is PAUSED via remote control. Use source="forced" to override.');
    return { status: 'paused', message: 'Health check is paused via remote control' };
  }

  // Weekend check (with override support)
  const day = new Date().getDay();
  const weekendOverride = settings ? settings.weekendOverride : false;
  if ((day === 0 || day === 6) && !weekendOverride) {
    Logger.log('Weekend — skipping health check. Set Weekend Override to TRUE to run anyway.');
    return { status: 'skipped', message: 'Weekend — skipped' };
  }

  // Apply threshold overrides
  applyThresholdOverrides_();

  const results = {
    timestamp: new Date(),
    checks: [],
    overallStatus: 'healthy'
  };

  // Run checks respecting toggles
  if (isCheckEnabled_('Spreadsheet Freshness')) checkSpreadsheetFreshness_(results);
  if (isCheckEnabled_('Column Layout')) checkColumnLayouts_(results);
  if (isCheckEnabled_('CSV Pipeline')) checkCSVPipelines_(results);
  if (isCheckEnabled_('Mac Watcher Health')) checkMacWatcherHealth_(results);
  if (isCheckEnabled_('SheetGo Sync')) checkSheetGoSyncs_(results);
  if (isCheckEnabled_('Formula Health')) checkFormulaHealth_(results);
  if (isCheckEnabled_('Cross-Spreadsheet Data Flow')) checkCrossSpreadsheetFlows_(results);
  if (isCheckEnabled_('Filming Schedule System')) checkFilmingScheduleLibrary_(results);

  // Determine overall status
  const criticalCount = results.checks.filter(c => c.status === 'critical').length;
  const warningCount = results.checks.filter(c => c.status === 'warning').length;

  if (criticalCount > 0) {
    results.overallStatus = 'critical';
  } else if (warningCount > 0) {
    results.overallStatus = 'warning';
  }

  // Send email (unless disabled via remote control)
  const emailEnabled = settings ? settings.emailAlerts : true;
  if (emailEnabled) {
    sendHealthCheckEmail_(results);
  } else {
    Logger.log('Email alerts disabled via remote control — skipping email.');
  }

  // Update the remote control spreadsheet with results
  updateRemoteControlStatus_(results, source);

  Logger.log('Remote health check complete (' + source + '): ' + results.overallStatus +
    ' (' + criticalCount + ' critical, ' + warningCount + ' warnings, ' +
    results.checks.filter(c => c.status === 'healthy').length + ' healthy)');

  return {
    status: results.overallStatus,
    critical: criticalCount,
    warnings: warningCount,
    healthy: results.checks.filter(c => c.status === 'healthy').length,
    timestamp: results.timestamp.toISOString()
  };
}

/**
 * Run a single check category by name. Useful for targeted debugging.
 */
function remoteRunSingleCheck(categoryName) {
  applyThresholdOverrides_();

  const results = {
    timestamp: new Date(),
    checks: [],
    overallStatus: 'healthy'
  };

  const checkMap = {
    'Spreadsheet Freshness': checkSpreadsheetFreshness_,
    'Column Layout': checkColumnLayouts_,
    'CSV Pipeline': checkCSVPipelines_,
    'Mac Watcher Health': checkMacWatcherHealth_,
    'SheetGo Sync': checkSheetGoSyncs_,
    'Formula Health': checkFormulaHealth_,
    'Cross-Spreadsheet Data Flow': checkCrossSpreadsheetFlows_,
    'Filming Schedule System': checkFilmingScheduleLibrary_
  };

  const checkFn = checkMap[categoryName];
  if (!checkFn) {
    return { error: 'Unknown check category: ' + categoryName, available: Object.keys(checkMap) };
  }

  checkFn(results);

  const criticalCount = results.checks.filter(c => c.status === 'critical').length;
  const warningCount = results.checks.filter(c => c.status === 'warning').length;

  if (criticalCount > 0) results.overallStatus = 'critical';
  else if (warningCount > 0) results.overallStatus = 'warning';

  updateRemoteControlStatus_(results, 'single:' + categoryName);

  return {
    category: categoryName,
    status: results.overallStatus,
    checks: results.checks,
    timestamp: results.timestamp.toISOString()
  };
}


// ---- Web App Endpoint ----

/**
 * Web app GET handler for remote control.
 *
 * Deploy: Publish > Deploy as web app
 *   - Execute as: Me
 *   - Who has access: Anyone (or Anyone within org)
 *
 * Usage:
 *   GET ?action=run                     → Run full health check
 *   GET ?action=run&check=Column+Layout → Run single check category
 *   GET ?action=run&force=true          → Run even if paused
 *   GET ?action=status                  → Get last run status
 *   GET ?action=pause                   → Pause scheduled runs
 *   GET ?action=resume                  → Resume scheduled runs
 *   GET ?action=log&limit=10            → Get recent run history
 *   GET ?action=checks                  → List available check categories
 */
function doGet(e) {
  const action = e.parameter.action || 'status';
  let result;

  try {
    switch (action) {
      case 'run': {
        const checkName = e.parameter.check;
        const force = e.parameter.force === 'true';
        const source = force ? 'forced' : 'web-app';

        if (checkName) {
          result = remoteRunSingleCheck(checkName);
        } else {
          result = remoteRunHealthCheck(source);
        }
        break;
      }

      case 'status': {
        result = getLastRunStatus_();
        break;
      }

      case 'pause': {
        result = setRemoteControlPause_(true);
        break;
      }

      case 'resume': {
        result = setRemoteControlPause_(false);
        break;
      }

      case 'log': {
        const limit = parseInt(e.parameter.limit) || 10;
        result = getRunLog_(limit);
        break;
      }

      case 'checks': {
        result = {
          available: [
            'Spreadsheet Freshness', 'Column Layout', 'CSV Pipeline',
            'Mac Watcher Health', 'SheetGo Sync', 'Formula Health',
            'Cross-Spreadsheet Data Flow', 'Filming Schedule System'
          ]
        };
        break;
      }

      default:
        result = { error: 'Unknown action: ' + action, available: ['run', 'status', 'pause', 'resume', 'log', 'checks'] };
    }
  } catch (err) {
    result = { error: err.message };
  }

  return ContentService
    .createTextOutput(JSON.stringify(result, null, 2))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Get the status from the last health check run.
 */
function getLastRunStatus_() {
  if (!CONFIG.remoteControlSpreadsheetId) {
    return { error: 'Remote control spreadsheet not configured. Run setupRemoteControl() first.' };
  }

  const ss = SpreadsheetApp.openById(CONFIG.remoteControlSpreadsheetId);
  const sheet = ss.getSheetByName('Control Panel');
  if (!sheet) return { error: 'Control Panel sheet not found' };

  const settingValues = sheet.getRange('A6:B13').getValues();
  const settings = {};
  for (const [key, val] of settingValues) {
    settings[String(key).trim()] = val;
  }

  return {
    paused: String(settings['Paused']).trim() === 'TRUE',
    lastStatus: settings['Last Run Status'] || 'never run',
    lastRunTime: settings['Last Run Time'] ? new Date(settings['Last Run Time']).toISOString() : null,
    critical: settings['Critical Count'] || 0,
    warnings: settings['Warning Count'] || 0,
    healthy: settings['Healthy Count'] || 0
  };
}

/**
 * Get recent entries from the Run Log.
 */
function getRunLog_(limit) {
  if (!CONFIG.remoteControlSpreadsheetId) {
    return { error: 'Remote control spreadsheet not configured' };
  }

  const ss = SpreadsheetApp.openById(CONFIG.remoteControlSpreadsheetId);
  const sheet = ss.getSheetByName('Run Log');
  if (!sheet) return { error: 'Run Log sheet not found' };

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { entries: [] };

  const numRows = Math.min(limit, lastRow - 1);
  const data = sheet.getRange(2, 1, numRows, 6).getValues();

  return {
    entries: data.map(row => ({
      timestamp: row[0] ? new Date(row[0]).toISOString() : null,
      status: row[1],
      critical: row[2],
      warnings: row[3],
      healthy: row[4],
      source: row[5]
    }))
  };
}

/**
 * Set the paused state on the remote control spreadsheet.
 */
function setRemoteControlPause_(paused) {
  if (!CONFIG.remoteControlSpreadsheetId) {
    return { error: 'Remote control spreadsheet not configured. Run setupRemoteControl() first.' };
  }

  const ss = SpreadsheetApp.openById(CONFIG.remoteControlSpreadsheetId);
  const sheet = ss.getSheetByName('Control Panel');
  if (!sheet) return { error: 'Control Panel sheet not found' };

  sheet.getRange('B6').setValue(paused ? 'TRUE' : 'FALSE');
  sheet.getRange('D6').setValue(new Date());

  return { paused: paused, message: paused ? 'Health checks paused' : 'Health checks resumed' };
}


// ---- Updated Trigger Entry Point ----

/**
 * Updated trigger entry point that integrates remote control.
 * Replace the existing trigger handler with this to get remote control support.
 * Run setupRemoteControlTrigger() to switch to this handler.
 */
function runHealthCheckWithRemoteControl() {
  remoteRunHealthCheck('scheduled');
}

/**
 * Set up the trigger to use the remote-control-aware entry point.
 * Replaces the old runHealthCheck trigger.
 */
function setupRemoteControlTrigger() {
  // Remove existing health check triggers
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(trigger) {
    const fn = trigger.getHandlerFunction();
    if (fn === 'runHealthCheck' || fn === 'runHealthCheckWithRemoteControl') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('runHealthCheckWithRemoteControl')
    .timeBased()
    .everyDays(1)
    .atHour(7)
    .nearMinute(30)
    .create();

  Logger.log('Remote control trigger created: daily at ~7:30 AM');
  Logger.log('The health check will now respect pause state, check toggles, and threshold overrides.');
}
