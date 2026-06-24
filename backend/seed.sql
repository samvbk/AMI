USE healthcare;

-- Insert sample data for testing
INSERT IGNORE INTO families (family_name) VALUES ('Sharma'), ('Patel'), ('Singh');

-- Insert sample members (Note: face_encoding is NULL for these, so face login won't work for them out of the box)
INSERT IGNORE INTO members (family_id, name, role, age, medical_history, emergency_contact) VALUES
(1, 'Raj Sharma', 'Father', 45, 'Diabetes Type 2', '9876543210'),
(1, 'Priya Sharma', 'Mother', 40, 'None', '9876543211'),
(1, 'Aarav Sharma', 'Child', 10, 'Asthma', '9876543212'),
(2, 'Anita Patel', 'Grandmother', 70, 'Hypertension, Arthritis', '9876543213'),
(3, 'Amrit Singh', 'Father', 50, 'Heart Condition', '9876543214');
