-- Migration v127: Backfill producto_descripcion en lecturas de lubricantes usando products.nombre

UPDATE gas_station_closeout_lubricant_readings l
JOIN products p ON l.producto_id = p.id
SET l.producto_descripcion = p.nombre
WHERE l.producto_descripcion = '';
