import { useEffect, useState } from 'react';
import { ApiError, listRunsByTrigger } from '../../../lib/api-client';
import { whenLabel } from '../../../lib/trigger-schedule';
import type { Run } from '../../../types/run';
import './trigger-activity.css';

interface TriggerActivityProps {
  triggerId: string;
  /** Bumped by the owning editor after a manual run so the list refetches. */
  refreshToken: number;
}

export const TriggerActivity = ({ triggerId, refreshToken }: TriggerActivityProps) => {
  const [runs, setRuns] = useState<Run[]>([]);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(undefined);
    listRunsByTrigger(triggerId)
      .then((fetched) => {
        if (active) {
          setRuns(fetched);
          setError(undefined);
        }
      })
      .catch((thrown: unknown) => {
        if (!active) return;
        setError(
          thrown instanceof ApiError ? thrown.message : "Couldn't load activity. Retry.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    // A response for a trigger the user has navigated away from must not land
    // on the one now on screen.
    return () => {
      active = false;
    };
  }, [triggerId, refreshToken]);

  if (loading) {
    return (
      <p className="trigger-activity__status" role="status">
        Loading activity…
      </p>
    );
  }
  if (error) {
    return (
      <p className="trigger-activity__status" role="alert">
        {error}
      </p>
    );
  }
  if (runs.length === 0) {
    return <p className="trigger-activity__status">No runs yet. Use Run now to try it.</p>;
  }

  return (
    <ul className="trigger-activity">
      {runs.map((run) => (
        <li key={run.id} className="trigger-activity__row">
          <span className="trigger-activity__when">{whenLabel(run.createdAt)}</span>
          <span
            className={
              run.status === 'error'
                ? 'trigger-activity__status-badge trigger-activity__status-badge--error'
                : 'trigger-activity__status-badge'
            }
          >
            {run.status === 'error' ? 'Failed' : 'Done'}
          </span>
          <span className="trigger-activity__answer">{run.error ?? run.answer}</span>
        </li>
      ))}
    </ul>
  );
};
