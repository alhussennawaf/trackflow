-- JAK - flowTracker backend, part 3: starting data.
-- Company settings, the 29 document types, their workflows, and the approved trade and level codes.

insert into public.org_settings (id) values ('org') on conflict do nothing;

-- ---------------------------------------------------------------- document types
insert into public.doc_types (code, name, family, page, raised_by, review_kind, sort) values
  ('SUB',  'Submittal (general)',                     'Submittals',                    'requests', 'company', 'submittal',   10),
  ('SD',   'Shop Drawing',                            'Submittals',                    'requests', 'company', 'submittal',   11),
  ('MAT',  'Material Submittal',                      'Submittals',                    'requests', 'company', 'submittal',   12),
  ('SAM',  'Sample Submittal',                        'Submittals',                    'requests', 'company', 'submittal',   13),
  ('SAR',  'Supplier Approval Request',               'Submittals',                    'requests', 'company', 'submittal',   14),
  ('CAL',  'Calculations',                            'Submittals',                    'requests', 'company', 'submittal',   15),
  ('SPEC', 'Specifications',                          'Submittals',                    'requests', 'company', 'submittal',   16),
  ('MST',  'Method Statement',                        'Submittals',                    'requests', 'company', 'submittal',   17),
  ('ITP',  'Inspection & Test Plan',                  'Submittals',                    'requests', 'company', 'submittal',   18),
  ('PRC',  'Prequalification',                        'Submittals',                    'requests', 'company', 'submittal',   19),
  ('ABD',  'As-Built Drawing',                        'Submittals',                    'requests', 'company', 'submittal',   20),
  ('DSF',  'Document Submittal Form',                 'Submittals',                    'requests', 'company', 'submittal',   21),
  ('TR',   'Document Transmittal',                    'Submittals',                    'requests', 'company', 'submittal',   22),
  ('IR',   'Inspection Request',                      'Inspections and site requests', 'requests', 'company', 'inspection',  30),
  ('WIR',  'Work Inspection Request',                 'Inspections and site requests', 'requests', 'company', 'inspection',  31),
  ('MIR',  'Material Inspection Request',             'Inspections and site requests', 'requests', 'company', 'inspection',  32),
  ('RCI',  'Request for Concrete Inspection',         'Inspections and site requests', 'requests', 'company', 'inspection',  33),
  ('SWR',  'Start Work Request',                      'Inspections and site requests', 'requests', 'company', 'inspection',  34),
  ('MER',  'Material Exit Request',                   'Inspections and site requests', 'requests', 'company', 'inspection',  35),
  ('RFI',  'Request for Information',                 'Information and instructions',  'requests', 'company', 'reply',       40),
  ('SI',   'Site Instruction',                        'Information and instructions',  'requests', 'jak',     'instruction', 41),
  ('CVI',  'Confirmation of Verbal Instruction',      'Information and instructions',  'requests', 'jak',     'instruction', 42),
  ('RFP',  'Request for Proposal',                    'Commercial',                    'requests', 'jak',     'instruction', 50),
  ('PRP',  'Proposal',                                'Commercial',                    'requests', 'company', 'submittal',   51),
  ('VOR',  'Variation Order Request',                 'Commercial',                    'requests', 'company', 'submittal',   52),
  ('PAY',  'Payment Application',                     'Commercial',                    'requests', 'company', 'invoice',     53),
  ('INV',  'Invoice',                                 'Commercial',                    'requests', 'company', 'invoice',     54),
  ('RPT',  'Report',                                  'Reports',                       'reports',  'company', 'report',      60),
  ('NCR',  'Non-Conformance Report',                  'Reports',                       'reports',  'jak',     'ncr',         61)
on conflict (code) do nothing;

-- ---------------------------------------------------------------- workflows
insert into public.doc_transitions (review_kind, from_status, to_status, actor) values
  -- submittals: review codes A to D
  ('submittal', 'submitted', 'under_review', 'reviewer'),
  ('submittal', 'submitted', 'approved', 'reviewer'),       ('submittal', 'under_review', 'approved', 'reviewer'),
  ('submittal', 'submitted', 'approved_as_noted', 'reviewer'), ('submittal', 'under_review', 'approved_as_noted', 'reviewer'),
  ('submittal', 'submitted', 'revise_resubmit', 'reviewer'), ('submittal', 'under_review', 'revise_resubmit', 'reviewer'),
  ('submittal', 'submitted', 'rejected', 'reviewer'),       ('submittal', 'under_review', 'rejected', 'reviewer'),
  -- inspections: passed, passed with comments, failed
  ('inspection', 'submitted', 'under_review', 'reviewer'),
  ('inspection', 'submitted', 'approved', 'reviewer'),       ('inspection', 'under_review', 'approved', 'reviewer'),
  ('inspection', 'submitted', 'approved_as_noted', 'reviewer'), ('inspection', 'under_review', 'approved_as_noted', 'reviewer'),
  ('inspection', 'submitted', 'rejected', 'reviewer'),       ('inspection', 'under_review', 'rejected', 'reviewer'),
  -- RFIs: answered
  ('reply', 'submitted', 'under_review', 'reviewer'),
  ('reply', 'submitted', 'replied', 'reviewer'),            ('reply', 'under_review', 'replied', 'reviewer'),
  -- reports: acknowledged and closed
  ('report', 'submitted', 'under_review', 'reviewer'),
  ('report', 'submitted', 'closed', 'reviewer'),            ('report', 'under_review', 'closed', 'reviewer'),
  -- JAK instructions and RFPs: company acknowledges or replies, JAK closes
  ('instruction', 'submitted', 'responded', 'company'),
  ('instruction', 'submitted', 'closed', 'reviewer'),       ('instruction', 'responded', 'closed', 'reviewer'),
  -- NCRs: company responds, JAK verifies and closes or returns
  ('ncr', 'submitted', 'responded', 'company'),             ('ncr', 'returned', 'responded', 'company'),
  ('ncr', 'responded', 'returned', 'reviewer'),             ('ncr', 'responded', 'closed', 'reviewer'),
  -- invoices: project manager approves or returns, finance pays
  ('invoice', 'submitted', 'under_review', 'reviewer'),
  ('invoice', 'submitted', 'approved', 'reviewer'),         ('invoice', 'under_review', 'approved', 'reviewer'),
  ('invoice', 'submitted', 'returned', 'reviewer'),         ('invoice', 'under_review', 'returned', 'reviewer'),
  ('invoice', 'approved', 'paid', 'finance'),               ('invoice', 'approved', 'on_hold', 'finance'),
  ('invoice', 'on_hold', 'paid', 'finance')
on conflict do nothing;

insert into public.doc_revisable (review_kind, status) values
  ('submittal', 'revise_resubmit'),
  ('inspection', 'rejected'),
  ('invoice', 'returned')
on conflict do nothing;

-- ---------------------------------------------------------------- trades and sub-trades
insert into public.trades (code, name, sort) values
  ('CV', 'Civil', 10), ('ST', 'Structural', 20), ('AR', 'Architectural', 30), ('EL', 'Electrical', 40),
  ('PL', 'Plumbing', 50), ('HV', 'HVAC', 60), ('FF', 'Fire fighting', 70), ('ME', 'Mechanical (other)', 80),
  ('LS', 'Landscape', 90), ('GN', 'General', 100)
on conflict (code) do nothing;

insert into public.sub_trades (trade_code, code, name, sort) values
  ('CV', 'EX', 'Excavation', 1), ('CV', 'BF', 'Backfilling & compaction', 2), ('CV', 'DW', 'Dewatering', 3),
  ('CV', 'SH', 'Shoring', 4), ('CV', 'RD', 'Roads & paving', 5), ('CV', 'UT', 'External utilities', 6),
  ('ST', 'FD', 'Foundations', 1), ('ST', 'CN', 'Concrete works', 2), ('ST', 'RF', 'Reinforcement', 3),
  ('ST', 'FW', 'Formwork', 4), ('ST', 'SS', 'Steel structure', 5), ('ST', 'PT', 'Post-tensioning', 6),
  ('AR', 'BW', 'Blockwork', 1), ('AR', 'PL', 'Plaster', 2), ('AR', 'WP', 'Waterproofing', 3), ('AR', 'IN', 'Insulation', 4),
  ('AR', 'TL', 'Tiling & stone', 5), ('AR', 'PT', 'Painting', 6), ('AR', 'CL', 'Ceilings', 7), ('AR', 'DR', 'Doors', 8),
  ('AR', 'WN', 'Windows & glazing', 9), ('AR', 'JN', 'Joinery', 10), ('AR', 'FC', 'Facade & cladding', 11),
  ('EL', 'PW', 'Power', 1), ('EL', 'LT', 'Lighting', 2), ('EL', 'LV', 'Low current / ELV', 3), ('EL', 'FA', 'Fire alarm', 4),
  ('EL', 'ER', 'Earthing', 5),
  ('PL', 'WS', 'Water supply', 1), ('PL', 'DR', 'Drainage', 2), ('PL', 'SN', 'Sanitary fixtures', 3), ('PL', 'PM', 'Pumps & tanks', 4),
  ('HV', 'DC', 'Ductwork', 1), ('HV', 'CH', 'Chillers & plant', 2), ('HV', 'SU', 'Split units', 3), ('HV', 'VT', 'Ventilation', 4),
  ('FF', 'SP', 'Sprinklers', 1), ('FF', 'HR', 'Hose reels & cabinets', 2), ('FF', 'FP', 'Fire pumps', 3),
  ('ME', 'LF', 'Lifts', 1), ('ME', 'GS', 'Gas', 2),
  ('LS', 'HS', 'Hardscape', 1), ('LS', 'SF', 'Softscape', 2), ('LS', 'IR', 'Irrigation', 3),
  ('GN', 'GN', 'General / several trades', 1)
on conflict do nothing;

-- ---------------------------------------------------------------- standard levels (projects add their own areas)
insert into public.levels (project_id, code, name, sort) values
  (null, 'B2', 'Basement 2', 1), (null, 'B1', 'Basement 1', 2), (null, 'FN', 'Foundation level', 3),
  (null, 'GL', 'Ground level', 10), (null, 'MZ', 'Mezzanine', 11), (null, 'F1', 'First floor', 12),
  (null, 'F2', 'Second floor', 13), (null, 'F3', 'Third floor', 14), (null, 'F4', 'Fourth floor', 15),
  (null, 'F5', 'Fifth floor', 16), (null, 'RF', 'Roof', 30), (null, 'UR', 'Upper roof', 31),
  (null, 'EX', 'External works', 40), (null, 'ST', 'Whole site', 41), (null, 'GN', 'General / no level', 42)
on conflict do nothing;
