-- Migration v48: Add branch_id to gas_station_settings

ALTER TABLE gas_station_settings
    ADD COLUMN branch_id INT DEFAULT NULL AFTER company_id,
    ADD FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;

ALTER TABLE gas_station_settings
    DROP INDEX uq_company_setting,
    ADD UNIQUE KEY uq_company_branch_setting (company_id, branch_id, setting_key);
