-- Fix ventas FAC (consumidor final) de gasolineras generadas como "Complementaria":
-- guardaban total_gravado con IVA incluido, total_iva = 0 y total_pagar sin FOVIAL/COTRANS.
-- Se separa el IVA (13/113) y se incluyen los impuestos de combustible en el total,
-- para que el libro de IVA consumidor final sea consistente
-- (total_gravado + total_iva + fovial + cotrans = total_pagar) y coincida con el DTE.

-- 1) Separar IVA: total_gravado pasa a base neta, total_iva = 13% de la base.
UPDATE sales_headers
SET total_iva     = ROUND((total_gravado * 13) / 113, 2),
    total_gravado = ROUND(total_gravado - (total_gravado * 13) / 113, 2)
WHERE tipo_documento = '01'
  AND total_iva = 0
  AND total_gravado > 0
  AND total_gravado = total_pagar;

-- 2) Incluir FOVIAL/COTRANS en el total a pagar de las complementarias (coincide con el DTE).
UPDATE sales_headers
SET total_pagar = ROUND(total_gravado + total_iva + fovial + cotrans, 2)
WHERE tipo_documento = '01'
  AND observaciones LIKE 'Complementaria turno %'
  AND ABS((total_gravado + total_iva + fovial + cotrans) - total_pagar) > 0.01;

-- 3) Ajustar el pago registrado de las complementarias al mismo total.
UPDATE sales_payments sp
JOIN sales_headers sh ON sh.id = sp.sale_id
SET sp.monto = ROUND(sh.total_gravado + sh.total_iva + sh.fovial + sh.cotrans, 2)
WHERE sh.tipo_documento = '01'
  AND sh.observaciones LIKE 'Complementaria turno %'
  AND ABS((sh.total_gravado + sh.total_iva + sh.fovial + sh.cotrans) - sp.monto) > 0.01;
