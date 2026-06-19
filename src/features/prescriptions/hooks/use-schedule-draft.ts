import { useEffect, useState } from 'react';

import { prescriptionService } from '@/src/features/prescriptions/services/prescription-service';

type SchedulePreview = Awaited<ReturnType<typeof prescriptionService.getSchedulePreview>>;

export function useScheduleDraft(prescriptionId: string) {
  const [data, setData] = useState<SchedulePreview>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    setIsLoading(true);
    setError(null);

    prescriptionService
      .getSchedulePreview(prescriptionId)
      .then((result) => {
        if (!isMounted) return;
        setData(result);
      })
      .catch(() => {
        if (!isMounted) return;
        setError('Unable to generate the schedule preview.');
      })
      .finally(() => {
        if (!isMounted) return;
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [prescriptionId]);

  return { data, isLoading, error };
}
