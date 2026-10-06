const runMigration = require('./migration_v252_filpro_sync_range');
runMigration().then(() => process.exit(0)).catch(() => process.exit(1));
