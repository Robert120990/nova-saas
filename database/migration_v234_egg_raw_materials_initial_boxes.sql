-- Migration v234: Add initial_boxes column to egg_raw_materials to preserve incoming received boxes
ALTER TABLE egg_raw_materials ADD COLUMN initial_boxes INT NULL DEFAULT NULL AFTER total_boxes;

-- Update initial_boxes for existing records based on total_boxes
UPDATE egg_raw_materials 
SET initial_boxes = total_boxes 
WHERE initial_boxes IS NULL;

-- Update lot INAVI-25924 where 900 boxes were originally received
UPDATE egg_raw_materials 
SET initial_boxes = 900 
WHERE id = 25;
