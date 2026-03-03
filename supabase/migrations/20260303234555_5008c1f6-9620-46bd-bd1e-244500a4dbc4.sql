
-- Add ON DELETE CASCADE to property_images
ALTER TABLE property_images DROP CONSTRAINT property_images_property_id_fkey;
ALTER TABLE property_images ADD CONSTRAINT property_images_property_id_fkey FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;

-- Add ON DELETE CASCADE to property_documents
ALTER TABLE property_documents DROP CONSTRAINT property_documents_property_id_fkey;
ALTER TABLE property_documents ADD CONSTRAINT property_documents_property_id_fkey FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;

-- Add ON DELETE CASCADE to contact_requests
ALTER TABLE contact_requests DROP CONSTRAINT contact_requests_property_id_fkey;
ALTER TABLE contact_requests ADD CONSTRAINT contact_requests_property_id_fkey FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;

-- Add ON DELETE CASCADE to favorites
ALTER TABLE favorites DROP CONSTRAINT favorites_property_id_fkey;
ALTER TABLE favorites ADD CONSTRAINT favorites_property_id_fkey FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;

-- Add ON DELETE CASCADE to property_private_data
ALTER TABLE property_private_data DROP CONSTRAINT property_private_data_property_id_fkey;
ALTER TABLE property_private_data ADD CONSTRAINT property_private_data_property_id_fkey FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;

-- Add ON DELETE CASCADE to property_group_members
ALTER TABLE property_group_members DROP CONSTRAINT property_group_members_property_id_fkey;
ALTER TABLE property_group_members ADD CONSTRAINT property_group_members_property_id_fkey FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;

-- Add ON DELETE CASCADE to sales_pipeline
ALTER TABLE sales_pipeline DROP CONSTRAINT sales_pipeline_property_id_fkey;
ALTER TABLE sales_pipeline ADD CONSTRAINT sales_pipeline_property_id_fkey FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE SET NULL;

-- Add ON DELETE CASCADE to broker_appointments property ref
ALTER TABLE broker_appointments DROP CONSTRAINT broker_appointments_property_id_fkey;
ALTER TABLE broker_appointments ADD CONSTRAINT broker_appointments_property_id_fkey FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE SET NULL;
