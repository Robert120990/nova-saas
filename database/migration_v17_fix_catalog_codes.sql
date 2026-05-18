-- Fix pais: replace description with code (El Salvador = '222')
UPDATE customers SET pais = '222' WHERE pais = 'El Salvador' OR pais IS NULL;
UPDATE customers SET pais = '059' WHERE pais = 'Extranjero';

-- Fix departamento: replace descriptions with codes from cat_012_departamento
UPDATE customers c
JOIN cat_012_departamento d ON c.departamento = d.description
SET c.departamento = d.code
WHERE c.departamento IS NOT NULL AND c.departamento != '';

-- Fix municipio: replace descriptions with codes from cat_013_municipio
UPDATE customers c
JOIN cat_013_municipio m ON c.municipio = m.description
SET c.municipio = m.code
WHERE c.municipio IS NOT NULL AND c.municipio != '';
