import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchEvents, fetchStats, fetchHealth,
  type EventRow, type StatsResponse,
} from '../api.js';

const FAST = 3000;
const MAX = 15000;

export function nextInterval(s: { changedLastPoll: boolean; current: number }): number {
  if (s.changedLastPoll) return FAST;
  return Math.min(s.current * 2, MAX);
}

export function useEvents(params: URLSearchParams) {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [health, setHealth] = useState<{ status: string; db: string } | null>(null);
  const etag = useRef<string | null>(null);
  const interval = useRef<number>(FAST);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const poll = useCallback(async () => {
    try {
      const res = await fetchEvents(params, etag.current);
      const changed = res.status !== 304;
      if (changed && res.body) {
        etag.current = res.etag;
        setEvents(res.body.events);
        setStats(await fetchStats(params));
      }
      setHealth(await fetchHealth());
      setIsLive(true);
      interval.current = nextInterval({ changedLastPoll: changed, current: interval.current });
    } catch {
      setIsLive(false);
      interval.current = MAX;
    } finally {
      timer.current = setTimeout(poll, interval.current);
    }
  }, [params]);

  useEffect(() => {
    poll();
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [poll]);

  return { events, stats, isLive, health, refresh: poll };
}
