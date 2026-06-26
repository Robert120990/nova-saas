-- Migration v63: Add branch_id to all gas station catalog tables
-- Must drop FKs first because InnoDB uses compound unique indexes for FK on company_id

SET @backfill = (SELECT id FROM branches ORDER BY id LIMIT 1);

-- ============================================================
-- 1. gas_station_distributors
-- ============================================================
-- Clean up partial state from first attempt if needed
-- (branch_id column + FK may already exist)
ALTER TABLE gas_station_distributors DROP FOREIGN KEY IF EXISTS gas_station_distributors_ibfk_2;
-- Drop FK on company_id (needed to free the unique index)
ALTER TABLE gas_station_distributors DROP FOREIGN KEY gas_station_distributors_ibfk_1;
-- Drop old unique key
ALTER TABLE gas_station_distributors DROP INDEX IF EXISTS uq_distributor_company_code;
-- Ensure branch_id exists (may already exist)
ALTER TABLE gas_station_distributors ADD COLUMN IF NOT EXISTS branch_id INT NOT NULL AFTER company_id;
-- Backfill
UPDATE gas_station_distributors SET branch_id = @backfill WHERE branch_id = 0 OR branch_id IS NULL;
-- Add FK to branches
ALTER TABLE gas_station_distributors ADD FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT;
-- Add new unique key
ALTER TABLE gas_station_distributors ADD UNIQUE KEY uq_distributor_company_branch_code (company_id, branch_id, codigo);
-- Re-add FK on company_id
ALTER TABLE gas_station_distributors ADD FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

-- ============================================================
-- 2. gas_station_islands
-- ============================================================
ALTER TABLE gas_station_islands DROP FOREIGN KEY gas_station_islands_ibfk_1;
ALTER TABLE gas_station_islands DROP INDEX IF EXISTS uq_island_company_code;
ALTER TABLE gas_station_islands ADD COLUMN branch_id INT NOT NULL AFTER company_id;
UPDATE gas_station_islands SET branch_id = @backfill WHERE branch_id = 0;
ALTER TABLE gas_station_islands ADD FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT;
ALTER TABLE gas_station_islands ADD UNIQUE KEY uq_island_company_branch_code (company_id, branch_id, codigo);
ALTER TABLE gas_station_islands ADD FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

-- ============================================================
-- 3. gas_station_nozzles
-- ============================================================
-- Need to drop other FKs first too (island_id, product_id)
ALTER TABLE gas_station_nozzles DROP FOREIGN KEY gas_station_nozzles_ibfk_1;
ALTER TABLE gas_station_nozzles DROP FOREIGN KEY gas_station_nozzles_ibfk_2;
ALTER TABLE gas_station_nozzles DROP FOREIGN KEY gas_station_nozzles_ibfk_3;
ALTER TABLE gas_station_nozzles DROP INDEX IF EXISTS uq_nozzle_company_code;
ALTER TABLE gas_station_nozzles ADD COLUMN branch_id INT NOT NULL AFTER company_id;
UPDATE gas_station_nozzles SET branch_id = @backfill WHERE branch_id = 0;
ALTER TABLE gas_station_nozzles ADD FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT;
ALTER TABLE gas_station_nozzles ADD UNIQUE KEY uq_nozzle_company_branch_code (company_id, branch_id, codigo);
ALTER TABLE gas_station_nozzles ADD FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE gas_station_nozzles ADD FOREIGN KEY (island_id) REFERENCES gas_station_islands(id) ON DELETE RESTRICT;
ALTER TABLE gas_station_nozzles ADD FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT;

-- ============================================================
-- 4. gas_station_tanks
-- ============================================================
ALTER TABLE gas_station_tanks DROP FOREIGN KEY gas_station_tanks_ibfk_1;
ALTER TABLE gas_station_tanks DROP INDEX IF EXISTS uq_tank_company_code;
ALTER TABLE gas_station_tanks ADD COLUMN branch_id INT NOT NULL AFTER company_id;
UPDATE gas_station_tanks SET branch_id = @backfill WHERE branch_id = 0;
ALTER TABLE gas_station_tanks ADD FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT;
ALTER TABLE gas_station_tanks ADD UNIQUE KEY uq_tank_company_branch_code (company_id, branch_id, codigo);
ALTER TABLE gas_station_tanks ADD FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

-- ============================================================
-- 5. gas_station_expense_categories
-- ============================================================
-- No unique key, but need to drop FK on company_id for consistency
ALTER TABLE gas_station_expense_categories DROP FOREIGN KEY gas_station_expense_categories_ibfk_1;
ALTER TABLE gas_station_expense_categories ADD COLUMN branch_id INT NOT NULL AFTER company_id;
UPDATE gas_station_expense_categories SET branch_id = @backfill WHERE branch_id = 0;
ALTER TABLE gas_station_expense_categories ADD FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT;
ALTER TABLE gas_station_expense_categories ADD FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

-- ============================================================
-- 6. gas_station_despachadores
-- ============================================================
ALTER TABLE gas_station_despachadores DROP FOREIGN KEY gas_station_despachadores_ibfk_1;
ALTER TABLE gas_station_despachadores DROP INDEX IF EXISTS uq_company_codigo;
ALTER TABLE gas_station_despachadores ADD COLUMN branch_id INT NOT NULL AFTER company_id;
UPDATE gas_station_despachadores SET branch_id = @backfill WHERE branch_id = 0;
ALTER TABLE gas_station_despachadores ADD FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT;
ALTER TABLE gas_station_despachadores ADD UNIQUE KEY uq_company_branch_codigo (company_id, branch_id, codigo);
ALTER TABLE gas_station_despachadores ADD FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

-- ============================================================
-- 7. gas_station_despachador_nozzles
-- ============================================================
-- Unique key is (despachador_id, nozzle_id), company_id FK has its own index
-- But still need to drop FK on company_id to be safe
ALTER TABLE gas_station_despachador_nozzles DROP FOREIGN KEY gas_station_despachador_nozzles_ibfk_1;
ALTER TABLE gas_station_despachador_nozzles DROP FOREIGN KEY gas_station_despachador_nozzles_ibfk_2;
ALTER TABLE gas_station_despachador_nozzles DROP FOREIGN KEY gas_station_despachador_nozzles_ibfk_3;
ALTER TABLE gas_station_despachador_nozzles ADD COLUMN branch_id INT NOT NULL AFTER company_id;
UPDATE gas_station_despachador_nozzles SET branch_id = @backfill WHERE branch_id = 0;
ALTER TABLE gas_station_despachador_nozzles ADD FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT;
ALTER TABLE gas_station_despachador_nozzles ADD FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE gas_station_despachador_nozzles ADD FOREIGN KEY (despachador_id) REFERENCES gas_station_despachadores(id) ON DELETE CASCADE;
ALTER TABLE gas_station_despachador_nozzles ADD FOREIGN KEY (nozzle_id) REFERENCES gas_station_nozzles(id) ON DELETE CASCADE;

-- ============================================================
-- 8. gas_station_pos_types
-- ============================================================
ALTER TABLE gas_station_pos_types DROP FOREIGN KEY gas_station_pos_types_ibfk_1;
ALTER TABLE gas_station_pos_types DROP INDEX IF EXISTS uq_company_pos_type;
ALTER TABLE gas_station_pos_types ADD COLUMN branch_id INT NOT NULL AFTER company_id;
UPDATE gas_station_pos_types SET branch_id = @backfill WHERE branch_id = 0;
ALTER TABLE gas_station_pos_types ADD FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT;
ALTER TABLE gas_station_pos_types ADD UNIQUE KEY uq_company_branch_pos_type (company_id, branch_id, nombre);
ALTER TABLE gas_station_pos_types ADD FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
