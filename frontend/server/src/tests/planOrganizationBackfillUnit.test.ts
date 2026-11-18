import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  parseCliOptions,
  validateIntegerArg,
  validatePlannerOptions,
  isRoleCompatibleForInheritance,
  MEMBERSHIP_ROLE_COMPATIBILITY_MATRIX,
  savePlanToFile,
  generateDeterministicId,
  PlannerConfigurationError,
  type BackfillPlanReport,
} from '../scripts/planOrganizationBackfill.js';

describe('DATA-01C.2 Offline Unit Tests — CLI Parsing, Role Compatibility, Programmatic Validation & Secure Output Recovery', () => {
  it('1. validateIntegerArg strictly validates positive integers within bounds', () => {
    assert.equal(validateIntegerArg('--batch-size', '50', 1, 100), 50);
    assert.equal(validateIntegerArg('--batch-size', '1', 1, 100), 1);
    assert.equal(validateIntegerArg('--batch-size', '100', 1, 100), 100);

    assert.throws(() => validateIntegerArg('--batch-size', '0', 1, 100), PlannerConfigurationError);
    assert.throws(() => validateIntegerArg('--batch-size', '-1', 1, 100), PlannerConfigurationError);
    assert.throws(() => validateIntegerArg('--batch-size', '101', 1, 100), PlannerConfigurationError);
    assert.throws(() => validateIntegerArg('--batch-size', 'abc', 1, 100), PlannerConfigurationError);
    assert.throws(() => validateIntegerArg('--batch-size', '12.5', 1, 100), PlannerConfigurationError);
    assert.throws(() => validateIntegerArg('--batch-size', '', 1, 100), PlannerConfigurationError);
  });

  it('2. parseCliOptions accepts both --option=value and --option value syntax', () => {
    const configEquals = parseCliOptions([
      '--batch-size=250',
      '--max-entities=5000',
      '--max-ledger-entries=10000',
      '--output=/tmp/report-equals.json',
      '--json',
      '--include-identifiers',
    ]);

    assert.equal(configEquals.batchSize, 250);
    assert.equal(configEquals.maxEntities, 5000);
    assert.equal(configEquals.maxLedgerEntries, 10000);
    assert.equal(configEquals.outputPath, '/tmp/report-equals.json');
    assert.equal(configEquals.isJson, true);
    assert.equal(configEquals.includeDetailedIdentifiers, true);
    assert.equal(configEquals.showHelp, false);

    const configSpaces = parseCliOptions([
      '--batch-size', '350',
      '--max-entities', '7500',
      '--max-ledger-entries', '15000',
      '--output', '/tmp/report-spaces.json',
    ]);

    assert.equal(configSpaces.batchSize, 350);
    assert.equal(configSpaces.maxEntities, 7500);
    assert.equal(configSpaces.maxLedgerEntries, 15000);
    assert.equal(configSpaces.outputPath, '/tmp/report-spaces.json');
    assert.equal(configSpaces.isJson, false);
    assert.equal(configSpaces.includeDetailedIdentifiers, false);
    assert.equal(configSpaces.showHelp, false);
  });

  it('3. parseCliOptions parses --help and -h flags', () => {
    assert.equal(parseCliOptions(['--help']).showHelp, true);
    assert.equal(parseCliOptions(['-h']).showHelp, true);
  });

  it('4. parseCliOptions rejects unknown flags and positional arguments', () => {
    assert.throws(
      () => parseCliOptions(['--non-existent']),
      /Unknown option: '--non-existent'/
    );
    assert.throws(
      () => parseCliOptions(['posArg']),
      /Unexpected positional argument or unknown option: 'posArg'/
    );
  });

  it('5. parseCliOptions rejects duplicate options', () => {
    assert.throws(
      () => parseCliOptions(['--batch-size', '100', '--batch-size=200']),
      /Duplicate option: --batch-size/
    );
    assert.throws(
      () => parseCliOptions(['--json', '--json']),
      /Duplicate option: --json/
    );
    assert.throws(
      () => parseCliOptions(['--output=/tmp/a.json', '--output', '/tmp/b.json']),
      /Duplicate option: --output/
    );
    assert.throws(
      () => parseCliOptions(['--help', '-h']),
      /Duplicate option: --help \/ -h/
    );
  });

  it('6. parseCliOptions rejects missing option values and malformed paths', () => {
    assert.throws(
      () => parseCliOptions(['--batch-size']),
      /Missing value for option '--batch-size'/
    );
    assert.throws(
      () => parseCliOptions(['--batch-size', '--output', 'foo.json']),
      /Missing value for option '--batch-size'/
    );
    assert.throws(
      () => parseCliOptions(['--output=']),
      /Invalid --output: expected a non-empty file path without null bytes/
    );
    assert.throws(
      () => parseCliOptions(['--output', '   ']),
      /Invalid --output: expected a non-empty file path without null bytes/
    );
    assert.throws(
      () => parseCliOptions(['--output', '/tmp/bad\0path.json']),
      /Invalid --output: expected a non-empty file path without null bytes/
    );
  });

  it('7. validatePlannerOptions enforces boundaries for programmatic invocation', () => {
    const valid = validatePlannerOptions({
      batchSize: 100,
      maxEntities: 20000,
      maxLedgerEntries: 20000,
      includeDetailedIdentifiers: true,
      migrationVersion: 'CUSTOM-V2',
    });

    assert.equal(valid.batchSize, 100);
    assert.equal(valid.maxEntities, 20000);
    assert.equal(valid.maxLedgerEntries, 20000);
    assert.equal(valid.includeDetailedIdentifiers, true);
    assert.equal(valid.migrationVersion, 'CUSTOM-V2');

    // Default values applied when omitted
    const defaults = validatePlannerOptions({});
    assert.equal(defaults.batchSize, 500);
    assert.equal(defaults.maxEntities, 100000);
    assert.equal(defaults.maxLedgerEntries, 100000);
    assert.equal(defaults.includeDetailedIdentifiers, false);
    assert.equal(defaults.migrationVersion, 'DATA-01C-V1');

    // Rejections
    assert.throws(() => validatePlannerOptions({ batchSize: 0 }), /Invalid batchSize/);
    assert.throws(() => validatePlannerOptions({ batchSize: -1 }), /Invalid batchSize/);
    assert.throws(() => validatePlannerOptions({ batchSize: 20000 }), /Invalid batchSize/);
    assert.throws(() => validatePlannerOptions({ maxEntities: 0 }), /Invalid maxEntities/);
    assert.throws(() => validatePlannerOptions({ maxLedgerEntries: 0 }), /Invalid maxLedgerEntries/);
  });

  it('8. membership role compatibility matrix validates all combinations strictly', () => {
    // Structure check
    assert.equal(MEMBERSHIP_ROLE_COMPATIBILITY_MATRIX.HOSPITAL.expectedOrgType, 'HOSPITAL_NETWORK');
    assert.equal(MEMBERSHIP_ROLE_COMPATIBILITY_MATRIX.AMBULANCE_PROVIDER.expectedOrgType, 'AMBULANCE_OPERATOR');
    assert.equal(MEMBERSHIP_ROLE_COMPATIBILITY_MATRIX.AMBULANCE_DRIVER.expectedOrgType, 'AMBULANCE_OPERATOR');

    // Hospital positive
    assert.deepEqual(isRoleCompatibleForInheritance('HOSPITAL', 'HOSPITAL_ADMIN', 'HOSPITAL_NETWORK'), { compatible: true });
    assert.deepEqual(isRoleCompatibleForInheritance('HOSPITAL', 'ORG_ADMIN', 'HOSPITAL_NETWORK'), { compatible: true });

    // Hospital negative
    assert.equal(isRoleCompatibleForInheritance('HOSPITAL', 'DRIVER', 'HOSPITAL_NETWORK').compatible, false);
    assert.equal(isRoleCompatibleForInheritance('HOSPITAL', 'PROVIDER_ADMIN', 'HOSPITAL_NETWORK').compatible, false);
    assert.equal(isRoleCompatibleForInheritance('HOSPITAL', 'ORG_MEMBER', 'HOSPITAL_NETWORK').compatible, false);
    assert.equal(isRoleCompatibleForInheritance('HOSPITAL', 'HOSPITAL_ADMIN', 'AMBULANCE_OPERATOR').compatible, false);

    // Provider positive
    assert.deepEqual(isRoleCompatibleForInheritance('AMBULANCE_PROVIDER', 'PROVIDER_ADMIN', 'AMBULANCE_OPERATOR'), { compatible: true });
    assert.deepEqual(isRoleCompatibleForInheritance('AMBULANCE_PROVIDER', 'ORG_ADMIN', 'AMBULANCE_OPERATOR'), { compatible: true });

    // Provider negative
    assert.equal(isRoleCompatibleForInheritance('AMBULANCE_PROVIDER', 'DRIVER', 'AMBULANCE_OPERATOR').compatible, false);
    assert.equal(isRoleCompatibleForInheritance('AMBULANCE_PROVIDER', 'HOSPITAL_ADMIN', 'AMBULANCE_OPERATOR').compatible, false);
    assert.equal(isRoleCompatibleForInheritance('AMBULANCE_PROVIDER', 'PROVIDER_ADMIN', 'HOSPITAL_NETWORK').compatible, false);

    // Driver positive
    assert.deepEqual(isRoleCompatibleForInheritance('AMBULANCE_DRIVER', 'DRIVER', 'AMBULANCE_OPERATOR'), { compatible: true });

    // Driver negative
    assert.equal(isRoleCompatibleForInheritance('AMBULANCE_DRIVER', 'ORG_ADMIN', 'AMBULANCE_OPERATOR').compatible, false);
    assert.equal(isRoleCompatibleForInheritance('AMBULANCE_DRIVER', 'HOSPITAL_ADMIN', 'AMBULANCE_OPERATOR').compatible, false);
    assert.equal(isRoleCompatibleForInheritance('AMBULANCE_DRIVER', 'DRIVER', 'HOSPITAL_NETWORK').compatible, false);
  });

  it('9. generateDeterministicId produces consistent 24-char hex ObjectIds', () => {
    const id1 = generateDeterministicId('seed:hospital:123');
    const id2 = generateDeterministicId('seed:hospital:123');
    const id3 = generateDeterministicId('seed:hospital:456');

    assert.equal(id1, id2);
    assert.notEqual(id1, id3);
    assert.equal(id1.length, 24);
    assert.ok(/^[0-9a-f]{24}$/.test(id1));
  });

  it('10. savePlanToFile failure recovery cleans up target file when post-rename steps fail', () => {
    const dummyPlan: BackfillPlanReport = {
      timestamp: new Date().toISOString(),
      databaseName: 'test_db',
      dryRun: true,
      readOnlyAudit: {
        executionPathAudited: true,
        writeOperationsCalled: 0,
        operationsAudited: [],
        limitations: '',
        databaseLevelEnforcementRecommendation: '',
        memoryComplexity: '',
      },
      configuration: {
        batchSize: 500,
        maxEntities: 100000,
        maxLedgerEntries: 100000,
        includeDetailedIdentifiers: false,
        migrationVersion: 'DATA-01C-V1',
      },
      summary: {
        totalEntitiesScanned: 0,
        proposedOrganizationCreates: 0,
        proposedMembershipCreates: 0,
        proposedEntityUpdates: 0,
        proposedInheritances: 0,
        alreadyConfiguredSkips: 0,
        recordsRequiringManualReview: 0,
      },
      countsByEntity: {
        hospitals: { total: 0, plannedCreates: 0, plannedUpdates: 0, skips: 0, manualReview: 0 },
        providers: { total: 0, plannedCreates: 0, plannedUpdates: 0, skips: 0, manualReview: 0 },
        ambulances: { total: 0, plannedCreates: 0, plannedUpdates: 0, skips: 0, manualReview: 0 },
        drivers: { total: 0, plannedCreates: 0, plannedUpdates: 0, skips: 0, manualReview: 0 },
        citizenEmergenciesPreserved: 0,
      },
      ledger: [],
      manualReviewRecords: [],
      rollbackSpecification: {
        strategy: 'IDEMPOTENT_LEDGER_REVERSAL',
        reversalInstructions: [],
        databaseRequirements: '',
        safetyRules: [],
      },
    };

    const targetFile = path.resolve(process.cwd(), 'reports', `test-post-rename-recovery-${Date.now()}.json`);
    const originalChmod = fs.chmodSync;
    let chmodCount = 0;

    try {
      fs.chmodSync = (filePath: fs.PathLike, mode: fs.Mode) => {
        chmodCount++;
        // Fail the second chmodSync (which occurs on resolvedPath after rename)
        if (chmodCount === 2) {
          throw new Error('EACCES: permission denied during target chmodSync');
        }
        return originalChmod(filePath, mode);
      };

      assert.throws(
        () => savePlanToFile(dummyPlan, targetFile),
        /permission denied during target chmodSync/
      );

      // Verify fail-closed cleanup: targetFile must NOT exist on disk!
      assert.equal(
        fs.existsSync(targetFile),
        false,
        'Target report file must be cleanly unlinked when post-rename verification fails'
      );
    } finally {
      fs.chmodSync = originalChmod;
      if (fs.existsSync(targetFile)) {
        fs.unlinkSync(targetFile);
      }
    }
  });
});
