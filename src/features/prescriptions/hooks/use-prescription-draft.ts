import { useEffect, useState } from "react";

import { prescriptionService } from "@/src/features/prescriptions/services/prescription-service";

type ReviewDraft = Awaited<
  ReturnType<typeof prescriptionService.getReviewDraft>
>;

export function usePrescriptionDraft(prescriptionId: string) {
  const [data, setData] = useState<ReviewDraft | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    setIsLoading(true);
    setError(null);

    prescriptionService
      .getReviewDraft(prescriptionId)
      .then((result) => {
        if (!isMounted) {
          return;
        }

        setData(result);
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }

        setError("Unable to load the prescription draft.");
      })
      .finally(() => {
        if (!isMounted) {
          return;
        }

        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [prescriptionId]);

  return { data, isLoading, error };
}
