-- ============================================================
-- AI Pips — Seed Data
-- seed.sql
-- ============================================================

-- ------------------------------------------------------------
-- Jobs
-- ------------------------------------------------------------

INSERT INTO jobs (
    id, title, organisation, department, location, salary_band,
    employment_type, closing_date, overview, responsibilities,
    required_skills, preferred_skills, qualifications, competencies,
    status, raw_jd_text, created_at, updated_at
) VALUES
(
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'Senior Policy Analyst',
    'Ministry of Business, Innovation and Employment',
    'Labour Market Policy',
    'Wellington',
    'Band 4: $100,000 - $120,000',
    'permanent',
    '2026-05-15T23:59:00+00:00',
    'The Ministry of Business, Innovation and Employment (MBIE) is seeking an experienced Senior Policy Analyst to join our Labour Market Policy team. In this role, you will lead the development of evidence-based policy advice that shapes New Zealand''s labour market outcomes. You will work closely with ministers, senior officials, business groups, unions, and community organisations to design policy solutions that are equitable, practical, and grounded in te ao Māori perspectives. This is a high-profile position that requires strong analytical skills, the ability to manage complex stakeholder relationships, and a commitment to the Public Service principles of stewardship and service to New Zealanders.',
    '["Lead the development and delivery of high-quality, evidence-based policy advice to Ministers and senior officials on complex labour market issues", "Undertake robust analysis of labour market data, research, and international comparisons to inform policy options", "Engage meaningfully with Māori and Pasifika communities, industry groups, unions, and community stakeholders to inform policy development", "Prepare Cabinet papers, briefing notes, and ministerial correspondence to a high standard", "Manage relationships with other government agencies including Treasury, MHUD, MSD, and the Productivity Commission", "Mentor and support junior analysts within the team", "Contribute to MBIE''s obligations under Te Tiriti o Waitangi and ensure policy advice reflects kaupapa Māori principles where relevant", "Represent MBIE at cross-agency working groups and sector forums"]'::jsonb,
    '["Policy analysis and development", "Quantitative and qualitative research methods", "Stakeholder engagement and relationship management", "Cabinet paper and ministerial briefing writing", "Labour market economics or industrial relations knowledge", "Project management", "Data analysis and interpretation"]'::jsonb,
    '["Experience with te reo Māori or tikanga Māori", "Knowledge of immigration policy or workforce planning", "Familiarity with New Zealand employment law", "Experience using Stats NZ data and HLFS datasets", "Understanding of Pacific community needs in the labour market"]'::jsonb,
    '["Tertiary qualification in Economics, Public Policy, Law, Social Sciences, or a related field", "Postgraduate qualification preferred"]'::jsonb,
    '["Treaty of Waitangi commitment", "Stakeholder engagement", "Strategic thinking", "Delivering results", "Leading and developing others", "Political acumen", "Bicultural capability", "Written and oral communication excellence"]'::jsonb,
    'OPEN',
    NULL,
    '2026-03-20T09:00:00+00:00',
    '2026-03-20T09:00:00+00:00'
),
(
    'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    'ICT Project Manager',
    'Auckland Council',
    'Digital Services and ICT',
    'Auckland',
    'Band 5: $110,000 - $130,000',
    'fixed-term',
    '2026-05-01T23:59:00+00:00',
    'Auckland Council is New Zealand''s largest local authority, serving over 1.7 million residents. We are seeking an experienced ICT Project Manager to lead the delivery of critical digital transformation projects across our organisation. This fixed-term role (18 months) will sit within our Digital Services and ICT group, reporting to the Programme Manager. You will be responsible for managing multiple concurrent projects including the migration of legacy systems, implementation of citizen-facing digital services, and integration of systems following the amalgamation of legacy council entities. You will be expected to bring strong delivery credentials, a collaborative approach, and an appreciation of the obligations Auckland Council holds to mana whenua and the communities of Tāmaki Makaurau.',
    '["Lead end-to-end delivery of ICT projects from initiation through to post-implementation review using PRINCE2 or Agile methodologies", "Manage project budgets, schedules, risks, and issues across a portfolio of concurrent projects", "Coordinate with internal business units, external vendors, and technology partners to ensure integrated delivery", "Prepare project status reports, steering group packs, and executive updates", "Engage with mana whenua representatives to ensure digital projects reflect Auckland Council''s obligations under the Local Government (Auckland Council) Act", "Drive vendor performance management and contract compliance", "Support the transition to cloud-based infrastructure including M365 and Azure environments", "Facilitate workshops with business stakeholders to define requirements and acceptance criteria", "Ensure projects meet Council''s information security and privacy by design standards"]'::jsonb,
    '["ICT project management (5+ years)", "Agile and waterfall delivery methodologies", "Risk and issue management", "Budget management and financial reporting", "Vendor management", "Stakeholder communication and reporting", "Business requirements analysis", "Change management"]'::jsonb,
    '["Experience with Microsoft Azure or AWS cloud migrations", "Local government sector experience", "Knowledge of ITIL service management framework", "Familiarity with GIS or spatial data systems", "Experience with procurement under the Government Rules of Sourcing", "Te reo Māori or experience working with mana whenua"]'::jsonb,
    '["Bachelor''s degree in Information Technology, Computer Science, or related field", "PRINCE2 Practitioner or PMP certification", "Agile certification (SAFe, Scrum Master, or equivalent) preferred"]'::jsonb,
    '["Treaty of Waitangi commitment", "Stakeholder engagement", "Delivering results", "Commercial acumen", "Risk management", "Collaborative leadership", "Continuous improvement mindset", "Bicultural capability"]'::jsonb,
    'OPEN',
    NULL,
    '2026-03-25T09:00:00+00:00',
    '2026-03-25T09:00:00+00:00'
),
(
    'c3d4e5f6-a7b8-9012-cdef-123456789012',
    'Community Services Manager',
    'Canterbury District Health Board',
    'Allied Health and Community Services',
    'Christchurch',
    'Band 6: $120,000 - $145,000',
    'permanent',
    '2026-05-20T23:59:00+00:00',
    'Canterbury District Health Board (CDHB) is committed to improving the health and wellbeing of the people of Canterbury and the West Coast. We are seeking a Community Services Manager to lead a team of community health professionals delivering integrated, wrap-around services across the Canterbury region. This role is central to our strategy of shifting care from hospitals into community settings. You will bring strong leadership, clinical governance understanding, and a commitment to equity — particularly for Māori, Pasifika, and disabled communities. You will work closely with Te Whatu Ora, NGO partners, primary health organisations, and kaupapa Māori health providers to ensure our services are accessible, whānau-centred, and culturally responsive. This is a senior leadership role with direct responsibility for a team of approximately 45 FTE.',
    '["Provide strong operational and strategic leadership to community health teams across multiple Christchurch and Canterbury locations", "Drive service delivery excellence, clinical quality, and patient safety in community settings", "Develop and maintain partnerships with Māori health providers, NGOs, primary care, and social services", "Lead workforce planning, recruitment, and professional development for a multi-disciplinary team", "Oversee budget management and financial accountability for the community services portfolio", "Champion equity-focused service design to address health disparities for Māori, Pasifika, and other priority populations", "Contribute to the CDHB Strategic Plan and system-level change across the Canterbury health system", "Ensure compliance with Health and Disability Commissioner standards, HDSS frameworks, and Te Whatu Ora requirements", "Represent CDHB in regional forums, sector working groups, and community engagement processes", "Embed tikanga Māori and a te ao Māori approach into service delivery and team culture"]'::jsonb,
    '["Senior leadership in health or community services (5+ years)", "Budget and financial management", "Clinical governance and quality improvement", "Workforce development and performance management", "Partnership and relationship management with Māori organisations", "Strategic planning and service development", "Change management and organisational development"]'::jsonb,
    '["Clinical background in nursing, allied health, or social work", "Knowledge of Canterbury health system and Te Whatu Ora structure", "Experience with kaupapa Māori health models", "Understanding of Whānau Ora principles", "Familiarity with ACC and MSD interface in community services", "Te reo Māori proficiency"]'::jsonb,
    '["Relevant tertiary qualification in Health Management, Nursing, Social Work, Allied Health, or related field", "Postgraduate qualification in Health Management or Leadership preferred", "Current New Zealand practising certificate (if clinically registered)"]'::jsonb,
    '["Treaty of Waitangi commitment", "Bicultural capability", "Stakeholder engagement", "Delivering results", "Leading and developing others", "Equity and inclusion leadership", "System thinking", "Whānau-centred service design"]'::jsonb,
    'OPEN',
    NULL,
    '2026-04-01T09:00:00+00:00',
    '2026-04-01T09:00:00+00:00'
);

-- ------------------------------------------------------------
-- Candidates
-- ------------------------------------------------------------

INSERT INTO candidates (
    id, full_name, email, phone, location, linkedin_url, source,
    current_title, current_organisation, years_experience,
    skills, qualifications, summary, raw_cv_text, created_at, updated_at
) VALUES
(
    'd4e5f6a7-b8c9-0123-def0-234567890123',
    'Aroha Ngata',
    'aroha.ngata@email.co.nz',
    '+64 21 456 789',
    'Wellington',
    'https://www.linkedin.com/in/aroha-ngata-policy',
    'DIRECT_APPLY',
    'Policy Analyst',
    'Ministry of Social Development',
    7,
    '["Policy analysis and development", "Cabinet paper writing", "Stakeholder engagement", "Quantitative research", "Labour market analysis", "Ministerial correspondence", "Stats NZ data analysis", "Treaty of Waitangi policy", "Cross-agency collaboration", "Te reo Māori (intermediate)"]'::jsonb,
    '["Master of Public Policy, Victoria University of Wellington", "Bachelor of Arts (Economics and Māori Studies), Victoria University of Wellington"]'::jsonb,
    'Experienced policy analyst with seven years in the NZ public sector, specialising in social and labour market policy. Proven track record delivering high-quality Cabinet papers and briefings for Ministers. Strong understanding of Treaty of Waitangi obligations and kaupapa Māori approaches to policy development. Previous experience at MSD and Treasury.',
    NULL,
    '2026-04-05T10:00:00+00:00',
    '2026-04-05T10:00:00+00:00'
),
(
    'e5f6a7b8-c9d0-1234-ef01-345678901234',
    'James Tuilagi',
    'j.tuilagi@gmail.com',
    '+64 27 890 123',
    'Auckland',
    'https://www.linkedin.com/in/james-tuilagi-ict',
    'LINKEDIN_XRAY',
    'Senior IT Project Manager',
    'Watercare Services Limited',
    10,
    '["ICT project management", "PRINCE2 Practitioner", "Agile (Scrum, SAFe)", "Microsoft Azure", "Vendor management", "Risk and issue management", "Budget management", "Business requirements analysis", "Change management", "M365 migration", "Stakeholder reporting"]'::jsonb,
    '["Bachelor of Information Technology, Auckland University of Technology", "PRINCE2 Practitioner", "SAFe 5 Agilist"]'::jsonb,
    'Results-driven ICT Project Manager with a decade of experience delivering complex technology programmes in infrastructure and local government-adjacent organisations. Successfully led a $4.2M SCADA system upgrade at Watercare and managed vendor relationships across multiple concurrent projects. Strong communicator with experience presenting to executive and board-level stakeholders.',
    NULL,
    '2026-04-03T14:30:00+00:00',
    '2026-04-03T14:30:00+00:00'
),
(
    'f6a7b8c9-d0e1-2345-f012-456789012345',
    'Mere Taufa',
    'mere.taufa@xtra.co.nz',
    '+64 22 345 678',
    'Christchurch',
    'https://www.linkedin.com/in/mere-taufa-health',
    'SEEK',
    'Team Leader, Community Health',
    'Te Whatu Ora Waitaha Canterbury',
    12,
    '["Community health service management", "Clinical governance", "Workforce development", "Māori and Pasifika health equity", "Budget management", "NGO partnership management", "Whānau Ora principles", "Kaupapa Māori health models", "Performance management", "Strategic planning"]'::jsonb,
    '["Bachelor of Nursing, University of Canterbury", "Postgraduate Diploma in Health Management, University of Otago", "Current New Zealand Nursing Council practising certificate"]'::jsonb,
    'Dedicated health leader with 12 years in the Canterbury health system, currently leading a community nursing team of 18 FTE. Passionate about equitable health outcomes for Māori and Pasifika communities. Deep knowledge of the Canterbury health system, Te Whatu Ora structure, and whānau-centred care models. Experience managing budgets up to $3.5M.',
    NULL,
    '2026-04-06T09:15:00+00:00',
    '2026-04-06T09:15:00+00:00'
),
(
    'a7b8c9d0-e1f2-3456-0123-567890123456',
    'Connor Walsh',
    'connor.walsh@outlook.com',
    NULL,
    'Wellington',
    'https://www.linkedin.com/in/connor-walsh-analyst',
    'LINKEDIN_XRAY',
    'Junior Policy Analyst',
    'Ministry for the Environment',
    2,
    '["Policy research", "Stakeholder consultation", "Report writing", "Data analysis", "Environmental policy", "Microsoft Office suite"]'::jsonb,
    '["Bachelor of Arts (Political Science and Economics), University of Otago"]'::jsonb,
    'Early-career policy analyst currently working in environmental policy. Strong academic background with growing practical experience in policy development and stakeholder engagement. Eager to develop expertise in labour market or social policy. Limited Cabinet paper writing experience to date.',
    NULL,
    '2026-04-04T11:00:00+00:00',
    '2026-04-04T11:00:00+00:00'
),
(
    'b8c9d0e1-f2a3-4567-1234-678901234567',
    'Priya Sharma',
    'priya.sharma@gmail.com',
    '+64 21 678 901',
    'Auckland',
    'https://www.linkedin.com/in/priya-sharma-pm',
    'TRADEME',
    'Digital Transformation Programme Manager',
    'ANZ Bank New Zealand',
    14,
    '["Programme management", "Digital transformation", "Agile delivery", "Azure DevOps", "Cloud migration (AWS, Azure)", "Vendor management", "Executive stakeholder engagement", "Budget management (up to $15M)", "Change management", "ITIL v4", "Business analysis"]'::jsonb,
    '["Bachelor of Engineering (Computer Science), University of Auckland", "PMP (Project Management Professional)", "PRINCE2 Practitioner", "AWS Certified Solutions Architect (Associate)"]'::jsonb,
    'Highly experienced digital programme manager with 14 years in financial services and technology. Led a $12M core banking migration programme impacting 1.5 million customers. Strong technical depth combined with executive-level communication skills. Seeking to transition to the public sector to contribute to meaningful outcomes for New Zealanders. Limited local government experience but brings a strong commercial delivery track record.',
    NULL,
    '2026-04-07T08:45:00+00:00',
    '2026-04-07T08:45:00+00:00'
);
