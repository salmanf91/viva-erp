-- Migration to add cut_rate and stitch_rate to production_batches, and drop staff associations
ALTER TABLE production_batches DROP FOREIGN KEY production_batches_ibfk_2;
ALTER TABLE production_batches DROP FOREIGN KEY production_batches_ibfk_3;
ALTER TABLE production_batches DROP COLUMN cutting_master_id;
ALTER TABLE production_batches DROP COLUMN tailor_id;

ALTER TABLE production_batches ADD COLUMN cut_rate DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER quantity;
ALTER TABLE production_batches ADD COLUMN stitch_rate DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER cut_rate;
