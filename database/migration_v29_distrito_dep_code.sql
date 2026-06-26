-- Migration v29: Add dep_code to cat_008_distrito for department-based filtering

ALTER TABLE cat_008_distrito ADD COLUMN dep_code VARCHAR(2) DEFAULT NULL AFTER code;

UPDATE cat_008_distrito SET dep_code = '01' WHERE code BETWEEN '001' AND '012';
UPDATE cat_008_distrito SET dep_code = '09' WHERE code BETWEEN '013' AND '021';
UPDATE cat_008_distrito SET dep_code = '04' WHERE code BETWEEN '022' AND '054';
UPDATE cat_008_distrito SET dep_code = '07' WHERE code BETWEEN '055' AND '070';
UPDATE cat_008_distrito SET dep_code = '05' WHERE code BETWEEN '071' AND '092';
UPDATE cat_008_distrito SET dep_code = '08' WHERE code BETWEEN '093' AND '114';
UPDATE cat_008_distrito SET dep_code = '14' WHERE code BETWEEN '115' AND '132';
UPDATE cat_008_distrito SET dep_code = '13' WHERE code BETWEEN '133' AND '158';
UPDATE cat_008_distrito SET dep_code = '12' WHERE code BETWEEN '159' AND '178';
UPDATE cat_008_distrito SET dep_code = '06' WHERE code BETWEEN '179' AND '197';
UPDATE cat_008_distrito SET dep_code = '10' WHERE code BETWEEN '198' AND '210';
UPDATE cat_008_distrito SET dep_code = '02' WHERE code BETWEEN '211' AND '223';
UPDATE cat_008_distrito SET dep_code = '03' WHERE code BETWEEN '224' AND '239';
UPDATE cat_008_distrito SET dep_code = '11' WHERE code BETWEEN '240' AND '262';
