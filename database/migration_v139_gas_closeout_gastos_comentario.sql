-- v139: Comentario en gastos del cierre de lecturas (gasolinera)
-- Campo opcional por gasto, visible en el modal de gastos y en el reporte detallado.

ALTER TABLE gas_station_closeout_expenses
  ADD COLUMN comentario VARCHAR(255) NULL AFTER valor;