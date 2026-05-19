-- ==============================================================
-- SmartHRIS — Supabase PostgreSQL Schema & Seed Data
-- Tenant: ACME Corporation  |  Source: mock_workday_hris.json
-- ==============================================================

-- ----------------------------------------------------------------
-- Extensions
-- ----------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------
CREATE TYPE employee_status  AS ENUM ('Active', 'On Leave', 'Terminated');
CREATE TYPE enrollment_status AS ENUM ('not_started', 'in_progress', 'completed', 'overdue');
CREATE TYPE user_role         AS ENUM ('hr_admin', 'manager', 'employee');

-- ----------------------------------------------------------------
-- Tables
-- ----------------------------------------------------------------

CREATE TABLE public.departments (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT        NOT NULL UNIQUE,
  cost_center TEXT        NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.employees (
  id            UUID             PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- Linked to Supabase Auth user (set when employee creates their account)
  auth_user_id  UUID             UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  name          TEXT             NOT NULL,
  department_id UUID             NOT NULL REFERENCES public.departments(id),
  job_title     TEXT             NOT NULL,
  hire_date     DATE             NOT NULL,
  status        employee_status  NOT NULL DEFAULT 'Active',
  manager_id    UUID             REFERENCES public.employees(id) ON DELETE SET NULL,
  location      TEXT             NOT NULL,
  role          user_role        NOT NULL DEFAULT 'employee',
  created_at    TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

CREATE TABLE public.courses (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  title          TEXT        NOT NULL,
  category       TEXT        NOT NULL,
  duration_hours NUMERIC(5,1) NOT NULL CHECK (duration_hours > 0),
  is_mandatory   BOOLEAN     NOT NULL DEFAULT FALSE,
  -- NULL means company-wide (mandatory courses span all depts)
  department_id  UUID        REFERENCES public.departments(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.enrollments (
  id              UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id     UUID              NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  course_id       UUID              NOT NULL REFERENCES public.courses(id)   ON DELETE CASCADE,
  status          enrollment_status NOT NULL DEFAULT 'not_started',
  completion_date DATE,
  due_date        DATE              NOT NULL,
  created_at      TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  UNIQUE (employee_id, course_id),
  -- Completed enrollments must carry a completion_date
  CONSTRAINT chk_completion_date CHECK (
    (status = 'completed' AND completion_date IS NOT NULL)
    OR  status <> 'completed'
  )
);

CREATE TABLE public.certifications (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id   UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  course_id     UUID        NOT NULL REFERENCES public.courses(id)   ON DELETE CASCADE,
  issued_date   DATE        NOT NULL,
  expiry_date   DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_expiry_after_issued CHECK (
    expiry_date IS NULL OR expiry_date > issued_date
  )
);

-- ----------------------------------------------------------------
-- Indexes
-- ----------------------------------------------------------------

-- employees
CREATE INDEX idx_employees_department_id ON public.employees (department_id);
CREATE INDEX idx_employees_manager_id    ON public.employees (manager_id);
CREATE INDEX idx_employees_status        ON public.employees (status);
CREATE INDEX idx_employees_auth_user_id  ON public.employees (auth_user_id);

-- courses
CREATE INDEX idx_courses_department_id ON public.courses (department_id);
CREATE INDEX idx_courses_is_mandatory  ON public.courses (is_mandatory);

-- enrollments
CREATE INDEX idx_enrollments_employee_id ON public.enrollments (employee_id);
CREATE INDEX idx_enrollments_course_id   ON public.enrollments (course_id);
CREATE INDEX idx_enrollments_status      ON public.enrollments (status);
CREATE INDEX idx_enrollments_due_date    ON public.enrollments (due_date);

-- certifications
CREATE INDEX idx_certifications_employee_id ON public.certifications (employee_id);
CREATE INDEX idx_certifications_course_id   ON public.certifications (course_id);
CREATE INDEX idx_certifications_expiry_date ON public.certifications (expiry_date);

-- ----------------------------------------------------------------
-- updated_at trigger
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_employees_updated_at
  BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------
-- RLS helper functions
-- SECURITY DEFINER so the policy expressions don't recurse into
-- RLS themselves when reading the employees table.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.my_employee_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.employees WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.my_role()
RETURNS user_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.employees WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

-- ----------------------------------------------------------------
-- Row Level Security — employees
-- HR Admins : ALL rows
-- Managers  : own record + direct reports (manager_id = me)
-- Employees : own record only
-- ----------------------------------------------------------------
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "employees_hr_admin_all"
  ON public.employees FOR ALL TO authenticated
  USING      (public.my_role() = 'hr_admin')
  WITH CHECK (public.my_role() = 'hr_admin');

CREATE POLICY "employees_manager_self_and_reports"
  ON public.employees FOR SELECT TO authenticated
  USING (
    public.my_role() = 'manager'
    AND (id = public.my_employee_id()
         OR manager_id = public.my_employee_id())
  );

CREATE POLICY "employees_self_only"
  ON public.employees FOR SELECT TO authenticated
  USING (
    public.my_role() = 'employee'
    AND id = public.my_employee_id()
  );

-- ----------------------------------------------------------------
-- Row Level Security — departments
-- Everyone (authenticated) can read; only HR admins can write.
-- ----------------------------------------------------------------
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "departments_hr_admin_all"
  ON public.departments FOR ALL TO authenticated
  USING      (public.my_role() = 'hr_admin')
  WITH CHECK (public.my_role() = 'hr_admin');

CREATE POLICY "departments_read_all"
  ON public.departments FOR SELECT TO authenticated
  USING (true);

-- ----------------------------------------------------------------
-- Row Level Security — courses
-- Everyone (authenticated) can read; only HR admins can write.
-- ----------------------------------------------------------------
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "courses_hr_admin_all"
  ON public.courses FOR ALL TO authenticated
  USING      (public.my_role() = 'hr_admin')
  WITH CHECK (public.my_role() = 'hr_admin');

CREATE POLICY "courses_read_all"
  ON public.courses FOR SELECT TO authenticated
  USING (true);

-- ----------------------------------------------------------------
-- Row Level Security — enrollments
-- HR Admins : ALL rows
-- Managers  : their own enrollments + direct reports' enrollments
-- Employees : own enrollments only
-- ----------------------------------------------------------------
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "enrollments_hr_admin_all"
  ON public.enrollments FOR ALL TO authenticated
  USING      (public.my_role() = 'hr_admin')
  WITH CHECK (public.my_role() = 'hr_admin');

CREATE POLICY "enrollments_manager_self_and_reports"
  ON public.enrollments FOR SELECT TO authenticated
  USING (
    public.my_role() = 'manager'
    AND employee_id IN (
      SELECT id FROM public.employees
       WHERE id = public.my_employee_id()
          OR manager_id = public.my_employee_id()
    )
  );

CREATE POLICY "enrollments_self_only"
  ON public.enrollments FOR SELECT TO authenticated
  USING (
    public.my_role() = 'employee'
    AND employee_id = public.my_employee_id()
  );

-- ----------------------------------------------------------------
-- Row Level Security — certifications
-- HR Admins : ALL rows
-- Managers  : their own + direct reports' certifications
-- Employees : own certifications only
-- ----------------------------------------------------------------
ALTER TABLE public.certifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "certifications_hr_admin_all"
  ON public.certifications FOR ALL TO authenticated
  USING      (public.my_role() = 'hr_admin')
  WITH CHECK (public.my_role() = 'hr_admin');

CREATE POLICY "certifications_manager_self_and_reports"
  ON public.certifications FOR SELECT TO authenticated
  USING (
    public.my_role() = 'manager'
    AND employee_id IN (
      SELECT id FROM public.employees
       WHERE id = public.my_employee_id()
          OR manager_id = public.my_employee_id()
    )
  );

CREATE POLICY "certifications_self_only"
  ON public.certifications FOR SELECT TO authenticated
  USING (
    public.my_role() = 'employee'
    AND employee_id = public.my_employee_id()
  );

-- ================================================================
-- SEED DATA
-- Fixed UUIDs use the pattern:
--   departments : d0000000-0000-0000-0000-00000000000X
--   employees   : e0000000-0000-0000-0000-00000000000X  (X = WD-EMP-NNN)
--   courses     : c0000000-0000-0000-0000-00000000000X
-- ================================================================

-- ----------------------------------------------------------------
-- Departments (6)
-- ----------------------------------------------------------------
INSERT INTO public.departments (id, name, cost_center) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'Engineering',         'CC-ENG-100'),
  ('d0000000-0000-0000-0000-000000000002', 'Product',             'CC-PRD-200'),
  ('d0000000-0000-0000-0000-000000000003', 'Data & Analytics',    'CC-DAT-300'),
  ('d0000000-0000-0000-0000-000000000004', 'Design',              'CC-DES-400'),
  ('d0000000-0000-0000-0000-000000000005', 'Information Security','CC-SEC-500'),
  ('d0000000-0000-0000-0000-000000000006', 'Sales',               'CC-SAL-600');

-- ----------------------------------------------------------------
-- Employees (16 — matches mock_workday_hris.json)
-- Inserted top-down to satisfy the self-referential manager_id FK.
-- Roles: hr_admin → Amanda Foster (CTO), Patricia Hughes (CISO)
--         manager → David Chen, Sarah Williams, Robert Kim,
--                   Lisa Anderson, Thomas Wright
--         employee → all others
-- ----------------------------------------------------------------
INSERT INTO public.employees
  (id, name, department_id, job_title, hire_date, status, manager_id, location, role)
VALUES

-- ── Tier 0: C-suite (no manager in this DB) ─────────────────────
('e0000000-0000-0000-0000-000000000015',
 'Amanda Foster',     'd0000000-0000-0000-0000-000000000001',
 'CTO',               '2014-03-01', 'Active', NULL,
 'San Francisco HQ',  'hr_admin'),

('e0000000-0000-0000-0000-000000000013',
 'Patricia Hughes',   'd0000000-0000-0000-0000-000000000005',
 'CISO',              '2015-08-03', 'Active', NULL,
 'San Francisco HQ',  'hr_admin'),

('e0000000-0000-0000-0000-000000000014',
 'Thomas Wright',     'd0000000-0000-0000-0000-000000000006',
 'VP of Sales',       '2016-11-14', 'Active', NULL,
 'Chicago Office',    'manager'),

-- ── Tier 1: Senior managers reporting to CTO/exec ───────────────
('e0000000-0000-0000-0000-000000000007',
 'David Chen',        'd0000000-0000-0000-0000-000000000001',
 'Engineering Manager','2016-02-14','Active',
 'e0000000-0000-0000-0000-000000000015',
 'San Francisco HQ',  'manager'),

('e0000000-0000-0000-0000-000000000010',
 'Sarah Williams',    'd0000000-0000-0000-0000-000000000002',
 'Director of Product','2017-05-08','Active',
 'e0000000-0000-0000-0000-000000000015',
 'San Francisco HQ',  'manager'),

('e0000000-0000-0000-0000-000000000011',
 'Robert Kim',        'd0000000-0000-0000-0000-000000000003',
 'Principal Data Engineer','2018-01-22','Active',
 'e0000000-0000-0000-0000-000000000015',
 'New York Office',   'manager'),

('e0000000-0000-0000-0000-000000000012',
 'Lisa Anderson',     'd0000000-0000-0000-0000-000000000004',
 'Senior UX Researcher','2019-09-12','Active',
 'e0000000-0000-0000-0000-000000000015',
 'San Francisco HQ',  'manager'),

-- ── Tier 2: Individual contributors ─────────────────────────────
('e0000000-0000-0000-0000-000000000001',
 'Jennifer Martinez', 'd0000000-0000-0000-0000-000000000001',
 'Senior Software Engineer','2019-03-15','Active',
 'e0000000-0000-0000-0000-000000000007',
 'San Francisco HQ',  'employee'),

('e0000000-0000-0000-0000-000000000004',
 'James O''Connor',   'd0000000-0000-0000-0000-000000000001',
 'DevOps Engineer',   '2018-09-05', 'Active',
 'e0000000-0000-0000-0000-000000000007',
 'Austin Office',     'employee'),

('e0000000-0000-0000-0000-000000000009',
 'Marcus Johnson',    'd0000000-0000-0000-0000-000000000001',
 'QA Engineer',       '2019-06-20', 'On Leave',
 'e0000000-0000-0000-0000-000000000007',
 'San Francisco HQ',  'employee'),

('e0000000-0000-0000-0000-000000000017',
 'Kevin Murphy',      'd0000000-0000-0000-0000-000000000001',
 'Software Engineer II','2023-02-06','Terminated',
 'e0000000-0000-0000-0000-000000000007',
 'San Francisco HQ',  'employee'),

('e0000000-0000-0000-0000-000000000002',
 'Michael Thompson',  'd0000000-0000-0000-0000-000000000002',
 'Product Manager',   '2020-07-22', 'Active',
 'e0000000-0000-0000-0000-000000000010',
 'San Francisco HQ',  'employee'),

('e0000000-0000-0000-0000-000000000003',
 'Aisha Patel',       'd0000000-0000-0000-0000-000000000003',
 'Data Scientist',    '2021-01-10', 'Active',
 'e0000000-0000-0000-0000-000000000011',
 'New York Office',   'employee'),

('e0000000-0000-0000-0000-000000000005',
 'Emily Nakamura',    'd0000000-0000-0000-0000-000000000004',
 'UX Designer',       '2022-04-18', 'Active',
 'e0000000-0000-0000-0000-000000000012',
 'San Francisco HQ',  'employee'),

('e0000000-0000-0000-0000-000000000006',
 'Carlos Rodriguez',  'd0000000-0000-0000-0000-000000000005',
 'Security Analyst',  '2020-11-30', 'Active',
 'e0000000-0000-0000-0000-000000000013',
 'Denver Office',     'employee'),

('e0000000-0000-0000-0000-000000000008',
 'Rachel Kowalski',   'd0000000-0000-0000-0000-000000000006',
 'Customer Success Manager','2021-08-02','Active',
 'e0000000-0000-0000-0000-000000000014',
 'Chicago Office',    'employee');

-- ----------------------------------------------------------------
-- Courses (10)
-- is_mandatory=TRUE + department_id=NULL → company-wide requirement
-- ----------------------------------------------------------------
INSERT INTO public.courses (id, title, category, duration_hours, is_mandatory, department_id)
VALUES
  -- Company-wide mandatory
  ('c0000000-0000-0000-0000-000000000001',
   'Security Awareness Training',
   'Compliance', 2.0, TRUE, NULL),

  ('c0000000-0000-0000-0000-000000000002',
   'Data Privacy & GDPR Compliance',
   'Compliance', 3.0, TRUE, NULL),

  -- Engineering
  ('c0000000-0000-0000-0000-000000000003',
   'Kubernetes & Cloud Infrastructure',
   'Technical', 8.0, FALSE, 'd0000000-0000-0000-0000-000000000001'),

  ('c0000000-0000-0000-0000-000000000010',
   'DevOps & CI/CD Best Practices',
   'Technical', 6.0, FALSE, 'd0000000-0000-0000-0000-000000000001'),

  -- Data & Analytics
  ('c0000000-0000-0000-0000-000000000004',
   'Python for Data Science',
   'Technical', 12.0, FALSE, 'd0000000-0000-0000-0000-000000000003'),

  ('c0000000-0000-0000-0000-000000000009',
   'Machine Learning Engineering Foundations',
   'Technical', 16.0, FALSE, 'd0000000-0000-0000-0000-000000000003'),

  -- Design
  ('c0000000-0000-0000-0000-000000000005',
   'UX Research Methods & Usability Testing',
   'Professional', 6.0, FALSE, 'd0000000-0000-0000-0000-000000000004'),

  -- Product
  ('c0000000-0000-0000-0000-000000000006',
   'Product Management Fundamentals',
   'Professional', 8.0, FALSE, 'd0000000-0000-0000-0000-000000000002'),

  -- Information Security
  ('c0000000-0000-0000-0000-000000000007',
   'Threat Intelligence & Incident Response',
   'Technical', 10.0, FALSE, 'd0000000-0000-0000-0000-000000000005'),

  -- Sales
  ('c0000000-0000-0000-0000-000000000008',
   'Enterprise Sales Methodologies',
   'Professional', 7.0, FALSE, 'd0000000-0000-0000-0000-000000000006');

-- ----------------------------------------------------------------
-- Enrollments (29) — mix of completed / in_progress / overdue
-- Reference date: 2026-05-19
-- ----------------------------------------------------------------
INSERT INTO public.enrollments (employee_id, course_id, status, completion_date, due_date) VALUES

-- ── Security Awareness Training (mandatory) ──────────────────────
-- completed
('e0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001',
 'completed', '2026-03-15', '2026-03-31'),
('e0000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000001',
 'completed', '2026-04-01', '2026-04-30'),
('e0000000-0000-0000-0000-000000000007','c0000000-0000-0000-0000-000000000001',
 'completed', '2026-02-15', '2026-03-31'),
('e0000000-0000-0000-0000-000000000015','c0000000-0000-0000-0000-000000000001',
 'completed', '2025-12-10', '2025-12-31'),
-- in_progress
('e0000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000001',
 'in_progress', NULL, '2026-06-30'),
-- overdue
('e0000000-0000-0000-0000-000000000006','c0000000-0000-0000-0000-000000000001',
 'overdue', NULL, '2026-04-15'),

-- ── Data Privacy & GDPR (mandatory) ─────────────────────────────
-- completed
('e0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000002',
 'completed', '2026-01-20', '2026-01-31'),
('e0000000-0000-0000-0000-000000000010','c0000000-0000-0000-0000-000000000002',
 'completed', '2026-02-25', '2026-02-28'),
('e0000000-0000-0000-0000-000000000014','c0000000-0000-0000-0000-000000000002',
 'completed', '2026-04-10', '2026-04-30'),
-- in_progress
('e0000000-0000-0000-0000-000000000005','c0000000-0000-0000-0000-000000000002',
 'in_progress', NULL, '2026-07-31'),
-- overdue
('e0000000-0000-0000-0000-000000000011','c0000000-0000-0000-0000-000000000002',
 'overdue', NULL, '2026-03-31'),

-- ── Kubernetes & Cloud Infrastructure (Engineering) ──────────────
-- completed
('e0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000003',
 'completed', '2026-04-20', '2026-04-30'),
('e0000000-0000-0000-0000-000000000007','c0000000-0000-0000-0000-000000000003',
 'completed', '2025-11-10', '2025-11-30'),
-- in_progress
('e0000000-0000-0000-0000-000000000004','c0000000-0000-0000-0000-000000000003',
 'in_progress', NULL, '2026-07-15'),
-- overdue (terminated employee never finished)
('e0000000-0000-0000-0000-000000000017','c0000000-0000-0000-0000-000000000003',
 'overdue', NULL, '2026-03-15'),

-- ── Python for Data Science (Data & Analytics) ───────────────────
-- completed
('e0000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000004',
 'completed', '2026-05-01', '2026-05-15'),
-- in_progress
('e0000000-0000-0000-0000-000000000011','c0000000-0000-0000-0000-000000000004',
 'in_progress', NULL, '2026-08-31'),

-- ── UX Research Methods (Design) ────────────────────────────────
-- completed
('e0000000-0000-0000-0000-000000000005','c0000000-0000-0000-0000-000000000005',
 'completed', '2026-04-15', '2026-04-30'),
-- overdue
('e0000000-0000-0000-0000-000000000012','c0000000-0000-0000-0000-000000000005',
 'overdue', NULL, '2026-04-01'),

-- ── Product Management Fundamentals (Product) ────────────────────
-- completed
('e0000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000006',
 'completed', '2026-03-01', '2026-03-31'),
-- in_progress
('e0000000-0000-0000-0000-000000000010','c0000000-0000-0000-0000-000000000006',
 'in_progress', NULL, '2026-09-30'),

-- ── Threat Intelligence & Incident Response (InfoSec) ────────────
-- completed
('e0000000-0000-0000-0000-000000000013','c0000000-0000-0000-0000-000000000007',
 'completed', '2026-01-10', '2026-01-31'),
-- in_progress
('e0000000-0000-0000-0000-000000000006','c0000000-0000-0000-0000-000000000007',
 'in_progress', NULL, '2026-08-31'),

-- ── Enterprise Sales Methodologies (Sales) ───────────────────────
-- completed
('e0000000-0000-0000-0000-000000000014','c0000000-0000-0000-0000-000000000008',
 'completed', '2026-02-25', '2026-02-28'),
-- overdue
('e0000000-0000-0000-0000-000000000008','c0000000-0000-0000-0000-000000000008',
 'overdue', NULL, '2026-03-31'),

-- ── Machine Learning Engineering Foundations (Data & Analytics) ──
-- completed
('e0000000-0000-0000-0000-000000000011','c0000000-0000-0000-0000-000000000009',
 'completed', '2026-05-05', '2026-05-15'),
-- overdue
('e0000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000009',
 'overdue', NULL, '2026-04-15'),

-- ── DevOps & CI/CD Best Practices (Engineering) ─────────────────
-- completed
('e0000000-0000-0000-0000-000000000004','c0000000-0000-0000-0000-000000000010',
 'completed', '2026-03-20', '2026-03-31'),
-- in_progress
('e0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000010',
 'in_progress', NULL, '2026-08-15');

-- ----------------------------------------------------------------
-- Certifications — issued for every completed enrollment
-- Annual refresh for Compliance courses (1-year validity)
-- Technical / Professional courses: 2-year validity
-- ----------------------------------------------------------------
INSERT INTO public.certifications (employee_id, course_id, issued_date, expiry_date) VALUES

-- Security Awareness Training completions (1-year)
('e0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001','2026-03-15','2027-03-15'),
('e0000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000001','2026-04-01','2027-04-01'),
('e0000000-0000-0000-0000-000000000007','c0000000-0000-0000-0000-000000000001','2026-02-15','2027-02-15'),
('e0000000-0000-0000-0000-000000000015','c0000000-0000-0000-0000-000000000001','2025-12-10','2026-12-10'),

-- Data Privacy & GDPR completions (2-year)
('e0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000002','2026-01-20','2028-01-20'),
('e0000000-0000-0000-0000-000000000010','c0000000-0000-0000-0000-000000000002','2026-02-25','2028-02-25'),
('e0000000-0000-0000-0000-000000000014','c0000000-0000-0000-0000-000000000002','2026-04-10','2028-04-10'),

-- Kubernetes & Cloud Infrastructure completions (2-year)
('e0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000003','2026-04-20','2028-04-20'),
('e0000000-0000-0000-0000-000000000007','c0000000-0000-0000-0000-000000000003','2025-11-10','2027-11-10'),

-- Python for Data Science completion (2-year)
('e0000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000004','2026-05-01','2028-05-01'),

-- UX Research Methods completion (2-year)
('e0000000-0000-0000-0000-000000000005','c0000000-0000-0000-0000-000000000005','2026-04-15','2028-04-15'),

-- Product Management Fundamentals completion (2-year)
('e0000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000006','2026-03-01','2028-03-01'),

-- Threat Intelligence & Incident Response completion (1-year)
('e0000000-0000-0000-0000-000000000013','c0000000-0000-0000-0000-000000000007','2026-01-10','2027-01-10'),

-- Enterprise Sales Methodologies completion (2-year)
('e0000000-0000-0000-0000-000000000014','c0000000-0000-0000-0000-000000000008','2026-02-25','2028-02-25'),

-- Machine Learning Engineering Foundations completion (2-year)
('e0000000-0000-0000-0000-000000000011','c0000000-0000-0000-0000-000000000009','2026-05-05','2028-05-05'),

-- DevOps & CI/CD Best Practices completion (2-year)
('e0000000-0000-0000-0000-000000000004','c0000000-0000-0000-0000-000000000010','2026-03-20','2028-03-20');
