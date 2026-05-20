-- ==============================================================
-- SmartHRIS — Migration 001: Employee Profile Columns
-- Adds compensation, time-off, and career fields to employees.
-- Also creates the leave_requests table.
-- ==============================================================

-- ── 1. New columns on public.employees ────────────────────────────────────────

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS salary                NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS salary_band           TEXT,
  ADD COLUMN IF NOT EXISTS salary_band_min       NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS salary_band_max       NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS last_review_date      DATE,
  ADD COLUMN IF NOT EXISTS next_review_date      DATE,
  ADD COLUMN IF NOT EXISTS leave_balance         NUMERIC(5,1) DEFAULT 25,
  ADD COLUMN IF NOT EXISTS sick_days_taken       INTEGER      DEFAULT 0,
  ADD COLUMN IF NOT EXISTS job_grade             TEXT,
  ADD COLUMN IF NOT EXISTS internal_mobility_flag BOOLEAN     DEFAULT FALSE;

-- ── 2. Seed compensation & HR data (all 16 employees) ────────────────────────

-- Amanda Foster — CTO
UPDATE public.employees SET
  salary = 320000, salary_band = 'E3',
  salary_band_min = 280000, salary_band_max = 380000,
  last_review_date = '2026-01-10', next_review_date = '2027-01-10',
  leave_balance = 30.0, sick_days_taken = 0,
  job_grade = 'E3', internal_mobility_flag = FALSE
WHERE id = 'e0000000-0000-0000-0000-000000000015';

-- Patricia Hughes — CISO
UPDATE public.employees SET
  salary = 275000, salary_band = 'E2',
  salary_band_min = 250000, salary_band_max = 320000,
  last_review_date = '2026-01-20', next_review_date = '2027-01-20',
  leave_balance = 28.0, sick_days_taken = 1,
  job_grade = 'E2', internal_mobility_flag = FALSE
WHERE id = 'e0000000-0000-0000-0000-000000000013';

-- Thomas Wright — VP of Sales
UPDATE public.employees SET
  salary = 265000, salary_band = 'E2',
  salary_band_min = 240000, salary_band_max = 300000,
  last_review_date = '2025-11-15', next_review_date = '2026-11-15',
  leave_balance = 22.0, sick_days_taken = 2,
  job_grade = 'E2', internal_mobility_flag = FALSE
WHERE id = 'e0000000-0000-0000-0000-000000000014';

-- David Chen — Engineering Manager
UPDATE public.employees SET
  salary = 195000, salary_band = 'M5',
  salary_band_min = 180000, salary_band_max = 240000,
  last_review_date = '2026-02-01', next_review_date = '2026-08-01',
  leave_balance = 15.0, sick_days_taken = 3,
  job_grade = 'M5', internal_mobility_flag = FALSE
WHERE id = 'e0000000-0000-0000-0000-000000000007';

-- Sarah Williams — Director of Product
UPDATE public.employees SET
  salary = 228000, salary_band = 'D1',
  salary_band_min = 200000, salary_band_max = 260000,
  last_review_date = '2026-01-28', next_review_date = '2026-07-28',
  leave_balance = 19.5, sick_days_taken = 0,
  job_grade = 'D1', internal_mobility_flag = FALSE
WHERE id = 'e0000000-0000-0000-0000-000000000010';

-- Robert Kim — Principal Data Engineer
UPDATE public.employees SET
  salary = 210000, salary_band = 'D1',
  salary_band_min = 195000, salary_band_max = 250000,
  last_review_date = '2026-02-10', next_review_date = '2026-08-10',
  leave_balance = 20.0, sick_days_taken = 1,
  job_grade = 'D1', internal_mobility_flag = TRUE
WHERE id = 'e0000000-0000-0000-0000-000000000011';

-- Lisa Anderson — Senior UX Researcher (Manager)
UPDATE public.employees SET
  salary = 175000, salary_band = 'M4',
  salary_band_min = 160000, salary_band_max = 210000,
  last_review_date = '2025-10-12', next_review_date = '2026-10-12',
  leave_balance = 14.0, sick_days_taken = 5,
  job_grade = 'M4', internal_mobility_flag = FALSE
WHERE id = 'e0000000-0000-0000-0000-000000000012';

-- Jennifer Martinez — Senior Software Engineer
UPDATE public.employees SET
  salary = 185000, salary_band = 'IC5',
  salary_band_min = 170000, salary_band_max = 220000,
  last_review_date = '2026-03-20', next_review_date = '2026-09-20',
  leave_balance = 18.5, sick_days_taken = 2,
  job_grade = 'IC5', internal_mobility_flag = TRUE
WHERE id = 'e0000000-0000-0000-0000-000000000001';

-- James O'Connor — DevOps Engineer
UPDATE public.employees SET
  salary = 148000, salary_band = 'IC4',
  salary_band_min = 130000, salary_band_max = 170000,
  last_review_date = '2025-09-05', next_review_date = '2026-09-05',
  leave_balance = 12.0, sick_days_taken = 4,
  job_grade = 'IC4', internal_mobility_flag = FALSE
WHERE id = 'e0000000-0000-0000-0000-000000000004';

-- Marcus Johnson — QA Engineer (On Leave) — salary below band_min to flag out-of-band
UPDATE public.employees SET
  salary = 108000, salary_band = 'IC3',
  salary_band_min = 110000, salary_band_max = 145000,
  last_review_date = '2025-07-01', next_review_date = '2026-07-01',
  leave_balance = 0.0, sick_days_taken = 8,
  job_grade = 'IC3', internal_mobility_flag = FALSE
WHERE id = 'e0000000-0000-0000-0000-000000000009';

-- Kevin Murphy — Software Engineer II (Terminated)
UPDATE public.employees SET
  salary = 132000, salary_band = 'IC2',
  salary_band_min = 100000, salary_band_max = 130000,
  last_review_date = '2025-08-15', next_review_date = NULL,
  leave_balance = 0.0, sick_days_taken = 6,
  job_grade = 'IC2', internal_mobility_flag = FALSE
WHERE id = 'e0000000-0000-0000-0000-000000000017';

-- Michael Thompson — Product Manager
UPDATE public.employees SET
  salary = 155000, salary_band = 'M4',
  salary_band_min = 140000, salary_band_max = 180000,
  last_review_date = '2026-01-05', next_review_date = '2026-07-05',
  leave_balance = 16.0, sick_days_taken = 0,
  job_grade = 'M4', internal_mobility_flag = FALSE
WHERE id = 'e0000000-0000-0000-0000-000000000002';

-- Aisha Patel — Data Scientist
UPDATE public.employees SET
  salary = 142000, salary_band = 'IC4',
  salary_band_min = 130000, salary_band_max = 170000,
  last_review_date = '2026-01-10', next_review_date = '2026-07-10',
  leave_balance = 21.0, sick_days_taken = 1,
  job_grade = 'IC4', internal_mobility_flag = TRUE
WHERE id = 'e0000000-0000-0000-0000-000000000003';

-- Emily Nakamura — UX Designer
UPDATE public.employees SET
  salary = 118000, salary_band = 'IC3',
  salary_band_min = 110000, salary_band_max = 145000,
  last_review_date = '2025-12-18', next_review_date = '2026-06-18',
  leave_balance = 20.5, sick_days_taken = 0,
  job_grade = 'IC3', internal_mobility_flag = FALSE
WHERE id = 'e0000000-0000-0000-0000-000000000005';

-- Carlos Rodriguez — Security Analyst
UPDATE public.employees SET
  salary = 138000, salary_band = 'IC4',
  salary_band_min = 130000, salary_band_max = 165000,
  last_review_date = '2025-12-01', next_review_date = '2026-06-01',
  leave_balance = 17.0, sick_days_taken = 3,
  job_grade = 'IC4', internal_mobility_flag = FALSE
WHERE id = 'e0000000-0000-0000-0000-000000000006';

-- Rachel Kowalski — Customer Success Manager
UPDATE public.employees SET
  salary = 128000, salary_band = 'M3',
  salary_band_min = 120000, salary_band_max = 155000,
  last_review_date = '2025-08-20', next_review_date = '2026-08-20',
  leave_balance = 11.5, sick_days_taken = 2,
  job_grade = 'M3', internal_mobility_flag = TRUE
WHERE id = 'e0000000-0000-0000-0000-000000000008';

-- ── 3. leave_requests table ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.leave_requests (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  type        TEXT        NOT NULL CHECK (type IN ('Annual', 'Sick', 'Personal', 'Unpaid')),
  start_date  DATE        NOT NULL,
  end_date    DATE        NOT NULL,
  days        NUMERIC(5,1) NOT NULL CHECK (days > 0),
  status      TEXT        NOT NULL DEFAULT 'Pending'
                          CHECK (status IN ('Pending', 'Approved', 'Rejected')),
  reason      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_end_after_start CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_leave_requests_employee_id ON public.leave_requests (employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status      ON public.leave_requests (status);

-- ── 4. RLS on leave_requests ──────────────────────────────────────────────────

ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leave_requests_hr_admin_all"
  ON public.leave_requests FOR ALL TO authenticated
  USING      (public.my_role() = 'hr_admin')
  WITH CHECK (public.my_role() = 'hr_admin');

CREATE POLICY "leave_requests_manager_self_and_reports"
  ON public.leave_requests FOR SELECT TO authenticated
  USING (
    public.my_role() = 'manager'
    AND employee_id IN (
      SELECT id FROM public.employees
       WHERE id = public.my_employee_id()
          OR manager_id = public.my_employee_id()
    )
  );

CREATE POLICY "leave_requests_self_only"
  ON public.leave_requests FOR SELECT TO authenticated
  USING (
    public.my_role() = 'employee'
    AND employee_id = public.my_employee_id()
  );

-- ── 5. Seed leave requests (mix of statuses for demo realism) ────────────────

INSERT INTO public.leave_requests (employee_id, type, start_date, end_date, days, status, reason) VALUES

-- Jennifer Martinez: pending annual leave
('e0000000-0000-0000-0000-000000000001', 'Annual',
 '2026-06-09', '2026-06-13', 5.0, 'Pending', 'Summer vacation'),

-- David Chen: pending annual leave
('e0000000-0000-0000-0000-000000000007', 'Annual',
 '2026-07-14', '2026-07-18', 5.0, 'Pending', 'Family holiday'),

-- Aisha Patel: approved (for historical record)
('e0000000-0000-0000-0000-000000000003', 'Personal',
 '2026-04-10', '2026-04-10', 1.0, 'Approved', 'Personal appointment'),

-- Rachel Kowalski: pending personal leave
('e0000000-0000-0000-0000-000000000008', 'Annual',
 '2026-06-02', '2026-06-06', 5.0, 'Pending', NULL),

-- Carlos Rodriguez: pending sick leave
('e0000000-0000-0000-0000-000000000006', 'Sick',
 '2026-05-22', '2026-05-22', 1.0, 'Pending', NULL),

-- Marcus Johnson: approved sick (he is On Leave)
('e0000000-0000-0000-0000-000000000009', 'Sick',
 '2026-04-14', '2026-05-16', 25.0, 'Approved', 'Medical leave'),

-- Emily Nakamura: approved annual
('e0000000-0000-0000-0000-000000000005', 'Annual',
 '2026-05-04', '2026-05-08', 5.0, 'Approved', 'Spring break'),

-- Robert Kim: pending annual
('e0000000-0000-0000-0000-000000000011', 'Annual',
 '2026-08-03', '2026-08-07', 5.0, 'Pending', 'Holiday trip'),

-- Michael Thompson: rejected
('e0000000-0000-0000-0000-000000000002', 'Annual',
 '2026-05-25', '2026-05-29', 5.0, 'Rejected', 'Product launch conflict');
