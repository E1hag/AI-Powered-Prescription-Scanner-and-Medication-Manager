alter table public.prescriptions
  drop constraint if exists prescriptions_status_check;

alter table public.prescriptions
  add constraint prescriptions_status_check
  check (
    status::text in (
      'draft',
      'processing',
      'needs_review',
      'ocr_failed',
      'ready_for_schedule',
      'finalized'
    )
  )
  not valid;
