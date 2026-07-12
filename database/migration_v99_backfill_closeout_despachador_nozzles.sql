-- Migration v99: Backfill existing closeouts with despachador-nozzle assignments
-- Copies current live assignments from gas_station_despachador_nozzles into the snapshot table
-- Only for closeout-despachador combinations that don't already have snapshot entries
-- Idempotent: safe to run multiple times

INSERT INTO gas_station_closeout_despachador_nozzles (closeout_id, despachador_id, nozzle_id)
SELECT cd.closeout_id, dn.despachador_id, dn.nozzle_id
FROM gas_station_closeout_despachadores cd
JOIN gas_station_closeouts co ON co.id = cd.closeout_id
JOIN gas_station_despachador_nozzles dn 
    ON dn.despachador_id = cd.despachador_id 
    AND dn.company_id = co.company_id
    AND (dn.branch_id = co.branch_id OR dn.branch_id IS NULL)
WHERE NOT EXISTS (
    SELECT 1 FROM gas_station_closeout_despachador_nozzles cdn
    WHERE cdn.closeout_id = cd.closeout_id 
    AND cdn.despachador_id = cd.despachador_id 
    AND cdn.nozzle_id = dn.nozzle_id
);
