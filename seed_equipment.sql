-- ============================================================
-- seed_equipment.sql — MediTrack Equipment Seed (Expanded)
-- Adds 3 new departments + 50 new equipment items
--
-- Safe to re-run: equipment uses ON CONFLICT (qr_code_id) DO NOTHING
-- Departments use WHERE NOT EXISTS (name has no UNIQUE constraint)
--
-- Does NOT touch: users, requests, audit_log
-- Does NOT duplicate the 8 existing items from schema.sql
--
-- New departments:  Operation Theatre  → QR prefix MT-OT-xxx
--                   Maternity Ward     → QR prefix MT-MW-xxx
--                   Radiology          → QR prefix MT-RD-xxx
-- ============================================================

-- -------------------------------------------------------
-- STEP 1 — New Departments
-- departments.name has no UNIQUE constraint, so we guard
-- with WHERE NOT EXISTS to keep this script idempotent.
-- -------------------------------------------------------

INSERT INTO departments (name)
SELECT 'Operation Theatre'
WHERE NOT EXISTS (SELECT 1 FROM departments WHERE name = 'Operation Theatre');

INSERT INTO departments (name)
SELECT 'Maternity Ward'
WHERE NOT EXISTS (SELECT 1 FROM departments WHERE name = 'Maternity Ward');

INSERT INTO departments (name)
SELECT 'Radiology'
WHERE NOT EXISTS (SELECT 1 FROM departments WHERE name = 'Radiology');


-- -------------------------------------------------------
-- STEP 2 — Equipment (50 new items)
--
-- QR code convention: MT-{DEPT_CODE}-{NNN}
--   ICU  → MT-ICU-xxx  (existing: 001–002, new: 003–009)
--   GW   → MT-GW-xxx   (existing: 001–003, new: 004–011)
--   EM   → MT-EM-xxx   (existing: 001–003, new: 004–010)
--   OT   → MT-OT-xxx   (new: 001–013)
--   MW   → MT-MW-xxx   (new: 001–009)
--   RD   → MT-RD-xxx   (new: 001–009)
--
-- Status split: ~30 Available / ~20 In Use across 50 items
-- Condition: mostly Usable; 3× Needs Maintenance; 1× Out of Order
-- held_by / in_use_since populated only for 'In Use' rows.
-- -------------------------------------------------------

INSERT INTO equipment (qr_code_id, name, department_id, status, condition, held_by, in_use_since)
VALUES

  -- ─────────────────────────────────────────────────────
  -- ICU  (7 new items — continuing from MT-ICU-002)
  -- ─────────────────────────────────────────────────────
  ('MT-ICU-003', 'Ventilator C',
    (SELECT id FROM departments WHERE name = 'ICU'),
    'In Use', 'Usable', 'dr.mehta', NOW() - INTERVAL '6 hours'),

  ('MT-ICU-004', 'Ventilator D',
    (SELECT id FROM departments WHERE name = 'ICU'),
    'Available', 'Usable', NULL, NULL),

  ('MT-ICU-005', 'Syringe Pump A',
    (SELECT id FROM departments WHERE name = 'ICU'),
    'In Use', 'Usable', 'nurse.priya', NOW() - INTERVAL '3 hours'),

  ('MT-ICU-006', 'Syringe Pump B',
    (SELECT id FROM departments WHERE name = 'ICU'),
    'Available', 'Usable', NULL, NULL),

  ('MT-ICU-007', 'Patient Monitor A',
    (SELECT id FROM departments WHERE name = 'ICU'),
    'In Use', 'Usable', 'nurse.priya', NOW() - INTERVAL '10 hours'),

  ('MT-ICU-008', 'Patient Monitor B',
    (SELECT id FROM departments WHERE name = 'ICU'),
    'Available', 'Needs Maintenance', NULL, NULL),

  ('MT-ICU-009', 'Suction Unit A',
    (SELECT id FROM departments WHERE name = 'ICU'),
    'Available', 'Usable', NULL, NULL),

  -- ─────────────────────────────────────────────────────
  -- General Ward  (8 new items — continuing from MT-GW-003)
  -- ─────────────────────────────────────────────────────
  ('MT-GW-004', 'Wheelchair C',
    (SELECT id FROM departments WHERE name = 'General Ward'),
    'In Use', 'Usable', 'nurse.sunita', NOW() - INTERVAL '45 minutes'),

  ('MT-GW-005', 'Wheelchair D',
    (SELECT id FROM departments WHERE name = 'General Ward'),
    'Available', 'Usable', NULL, NULL),

  ('MT-GW-006', 'Hospital Bed A',
    (SELECT id FROM departments WHERE name = 'General Ward'),
    'In Use', 'Usable', 'patient.r201', NOW() - INTERVAL '2 days'),

  ('MT-GW-007', 'Hospital Bed B',
    (SELECT id FROM departments WHERE name = 'General Ward'),
    'Available', 'Usable', NULL, NULL),

  ('MT-GW-008', 'Hospital Bed C',
    (SELECT id FROM departments WHERE name = 'General Ward'),
    'In Use', 'Usable', 'patient.r204', NOW() - INTERVAL '1 day'),

  ('MT-GW-009', 'Pulse Oximeter A',
    (SELECT id FROM departments WHERE name = 'General Ward'),
    'Available', 'Usable', NULL, NULL),

  ('MT-GW-010', 'Pulse Oximeter B',
    (SELECT id FROM departments WHERE name = 'General Ward'),
    'In Use', 'Usable', 'nurse.sunita', NOW() - INTERVAL '1 hour'),

  ('MT-GW-011', 'Nebulizer A',
    (SELECT id FROM departments WHERE name = 'General Ward'),
    'Available', 'Needs Maintenance', NULL, NULL),

  -- ─────────────────────────────────────────────────────
  -- Emergency  (7 new items — continuing from MT-EM-003)
  -- ─────────────────────────────────────────────────────
  ('MT-EM-004', 'Defibrillator B',
    (SELECT id FROM departments WHERE name = 'Emergency'),
    'Available', 'Usable', NULL, NULL),

  ('MT-EM-005', 'Crash Cart A',
    (SELECT id FROM departments WHERE name = 'Emergency'),
    'Available', 'Usable', NULL, NULL),

  ('MT-EM-006', 'Crash Cart B',
    (SELECT id FROM departments WHERE name = 'Emergency'),
    'In Use', 'Usable', 'dr.rajeev', NOW() - INTERVAL '30 minutes'),

  ('MT-EM-007', 'Portable Ventilator A',
    (SELECT id FROM departments WHERE name = 'Emergency'),
    'In Use', 'Usable', 'dr.rajeev', NOW() - INTERVAL '2 hours'),

  ('MT-EM-008', 'ECG Machine A',
    (SELECT id FROM departments WHERE name = 'Emergency'),
    'Available', 'Usable', NULL, NULL),

  ('MT-EM-009', 'Suction Unit B',
    (SELECT id FROM departments WHERE name = 'Emergency'),
    'Available', 'Usable', NULL, NULL),

  ('MT-EM-010', 'Oxygen Concentrator A',
    (SELECT id FROM departments WHERE name = 'Emergency'),
    'In Use', 'Usable', 'nurse.kavya', NOW() - INTERVAL '5 hours'),

  -- ─────────────────────────────────────────────────────
  -- Operation Theatre  (13 items — MT-OT-001 to 013)
  -- ─────────────────────────────────────────────────────
  ('MT-OT-001', 'Anaesthesia Machine A',
    (SELECT id FROM departments WHERE name = 'Operation Theatre'),
    'In Use', 'Usable', 'dr.sharma', NOW() - INTERVAL '4 hours'),

  ('MT-OT-002', 'Anaesthesia Machine B',
    (SELECT id FROM departments WHERE name = 'Operation Theatre'),
    'Available', 'Usable', NULL, NULL),

  ('MT-OT-003', 'Surgical Monitor A',
    (SELECT id FROM departments WHERE name = 'Operation Theatre'),
    'In Use', 'Usable', 'dr.sharma', NOW() - INTERVAL '4 hours'),

  ('MT-OT-004', 'Surgical Monitor B',
    (SELECT id FROM departments WHERE name = 'Operation Theatre'),
    'Available', 'Usable', NULL, NULL),

  ('MT-OT-005', 'Electrosurgical Unit A',
    (SELECT id FROM departments WHERE name = 'Operation Theatre'),
    'Available', 'Usable', NULL, NULL),

  ('MT-OT-006', 'Electrosurgical Unit B',
    (SELECT id FROM departments WHERE name = 'Operation Theatre'),
    'In Use', 'Usable', 'dr.anand', NOW() - INTERVAL '2 hours'),

  ('MT-OT-007', 'Infusion Pump C',
    (SELECT id FROM departments WHERE name = 'Operation Theatre'),
    'In Use', 'Usable', 'nurse.leela', NOW() - INTERVAL '3 hours'),

  ('MT-OT-008', 'Infusion Pump D',
    (SELECT id FROM departments WHERE name = 'Operation Theatre'),
    'Available', 'Usable', NULL, NULL),

  ('MT-OT-009', 'Syringe Pump C',
    (SELECT id FROM departments WHERE name = 'Operation Theatre'),
    'In Use', 'Usable', 'nurse.leela', NOW() - INTERVAL '3 hours'),

  ('MT-OT-010', 'Surgical Table A',
    (SELECT id FROM departments WHERE name = 'Operation Theatre'),
    'In Use', 'Usable', 'dr.sharma', NOW() - INTERVAL '4 hours'),

  ('MT-OT-011', 'Surgical Table B',
    (SELECT id FROM departments WHERE name = 'Operation Theatre'),
    'Available', 'Usable', NULL, NULL),

  ('MT-OT-012', 'Defibrillator C',
    (SELECT id FROM departments WHERE name = 'Operation Theatre'),
    'Available', 'Usable', NULL, NULL),

  ('MT-OT-013', 'Suction Unit C',
    (SELECT id FROM departments WHERE name = 'Operation Theatre'),
    'Available', 'Needs Maintenance', NULL, NULL),

  -- ─────────────────────────────────────────────────────
  -- Maternity Ward  (9 items — MT-MW-001 to 009)
  -- ─────────────────────────────────────────────────────
  ('MT-MW-001', 'Foetal Monitor A',
    (SELECT id FROM departments WHERE name = 'Maternity Ward'),
    'In Use', 'Usable', 'nurse.deepa', NOW() - INTERVAL '8 hours'),

  ('MT-MW-002', 'Foetal Monitor B',
    (SELECT id FROM departments WHERE name = 'Maternity Ward'),
    'In Use', 'Usable', 'nurse.deepa', NOW() - INTERVAL '5 hours'),

  ('MT-MW-003', 'Foetal Monitor C',
    (SELECT id FROM departments WHERE name = 'Maternity Ward'),
    'Available', 'Usable', NULL, NULL),

  ('MT-MW-004', 'Infusion Pump E',
    (SELECT id FROM departments WHERE name = 'Maternity Ward'),
    'In Use', 'Usable', 'nurse.deepa', NOW() - INTERVAL '6 hours'),

  ('MT-MW-005', 'Infusion Pump F',
    (SELECT id FROM departments WHERE name = 'Maternity Ward'),
    'Available', 'Usable', NULL, NULL),

  ('MT-MW-006', 'Birthing Bed A',
    (SELECT id FROM departments WHERE name = 'Maternity Ward'),
    'In Use', 'Usable', 'patient.m101', NOW() - INTERVAL '12 hours'),

  ('MT-MW-007', 'Birthing Bed B',
    (SELECT id FROM departments WHERE name = 'Maternity Ward'),
    'Available', 'Usable', NULL, NULL),

  ('MT-MW-008', 'Pulse Oximeter C',
    (SELECT id FROM departments WHERE name = 'Maternity Ward'),
    'Available', 'Usable', NULL, NULL),

  ('MT-MW-009', 'Neonatal Resuscitator A',
    (SELECT id FROM departments WHERE name = 'Maternity Ward'),
    'Available', 'Usable', NULL, NULL),

  -- ─────────────────────────────────────────────────────
  -- Radiology  (9 items — MT-RD-001 to 009)
  -- ─────────────────────────────────────────────────────
  ('MT-RD-001', 'Portable X-Ray Unit A',
    (SELECT id FROM departments WHERE name = 'Radiology'),
    'In Use', 'Usable', 'tech.arjun', NOW() - INTERVAL '1 hour'),

  ('MT-RD-002', 'Portable X-Ray Unit B',
    (SELECT id FROM departments WHERE name = 'Radiology'),
    'Available', 'Usable', NULL, NULL),

  ('MT-RD-003', 'Ultrasound Machine A',
    (SELECT id FROM departments WHERE name = 'Radiology'),
    'In Use', 'Usable', 'dr.nair', NOW() - INTERVAL '2 hours'),

  ('MT-RD-004', 'Ultrasound Machine B',
    (SELECT id FROM departments WHERE name = 'Radiology'),
    'Available', 'Usable', NULL, NULL),

  ('MT-RD-005', 'ECG Machine B',
    (SELECT id FROM departments WHERE name = 'Radiology'),
    'Available', 'Usable', NULL, NULL),

  ('MT-RD-006', 'Bladder Scanner A',
    (SELECT id FROM departments WHERE name = 'Radiology'),
    'Available', 'Usable', NULL, NULL),

  ('MT-RD-007', 'Bladder Scanner B',
    (SELECT id FROM departments WHERE name = 'Radiology'),
    'In Use', 'Usable', 'tech.arjun', NOW() - INTERVAL '40 minutes'),

  ('MT-RD-008', 'Portable Monitor B',
    (SELECT id FROM departments WHERE name = 'Radiology'),
    'Available', 'Out of Order', NULL, NULL),

  ('MT-RD-009', 'Oxygen Concentrator B',
    (SELECT id FROM departments WHERE name = 'Radiology'),
    'Available', 'Usable', NULL, NULL)

ON CONFLICT (qr_code_id) DO NOTHING;


-- -------------------------------------------------------
-- VERIFICATION — run after inserting, compare with expected
-- Expected TOTAL (new only): ~30 Available, ~20 In Use
-- -------------------------------------------------------

SELECT
  d.name                          AS department,
  e.status,
  COUNT(*)                        AS item_count
FROM equipment e
JOIN departments d ON d.id = e.department_id
GROUP BY d.name, e.status
ORDER BY d.name, e.status;
