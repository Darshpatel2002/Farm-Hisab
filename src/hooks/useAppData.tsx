import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { listRows, getRow } from '../lib/supabase/crud';
import { indexUnits, type UnitMap } from '../lib/calculations/units';
import { configureFormatting } from '../lib/formatting/number';
import { setLanguage } from '../i18n';
import { useAuth } from './useAuth';
import type { Crop, Farm, HouseholdSettings, Season, Unit } from '../types/db';

/**
 * Reference data that nearly every screen needs: settings, units, seasons,
 * farms and crops. Loaded once and cached so screens do not refetch it.
 */

const SEASON_KEY = 'farm-hisab-season';

interface AppDataValue {
  settings: HouseholdSettings | null;
  units: Unit[];
  unitMap: UnitMap;
  seasons: Season[];
  farms: Farm[];
  crops: Crop[];
  seasonId: string | null;
  season: Season | null;
  setSeasonId: (id: string) => void;
  loading: boolean;
  refresh: () => Promise<void>;
  farmById: Map<string, Farm>;
  cropById: Map<string, Crop>;
  /** Crop name in the active language. */
  cropName: (id: string | null | undefined) => string;
}

const AppDataContext = createContext<AppDataValue | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const { session, profile } = useAuth();
  const queryClient = useQueryClient();
  const enabled = Boolean(session && profile);
  const householdId = profile?.household_id;

  const settingsQuery = useQuery({
    queryKey: ['settings', householdId],
    enabled,
    queryFn: async () => (householdId ? getRow('household_settings', householdId) : null),
  });

  const unitsQuery = useQuery({
    queryKey: ['units', householdId],
    enabled,
    queryFn: () => listRows('units', { orderBy: { column: 'sort_order' }, includeDeleted: true }),
  });

  const seasonsQuery = useQuery({
    queryKey: ['seasons', householdId],
    enabled,
    queryFn: () => listRows('seasons', { orderBy: { column: 'year', ascending: false } }),
  });

  const farmsQuery = useQuery({
    queryKey: ['farms', householdId],
    enabled,
    queryFn: () => listRows('farms', { orderBy: { column: 'name' } }),
  });

  const cropsQuery = useQuery({
    queryKey: ['crops', householdId],
    enabled,
    queryFn: () => listRows('crops', { orderBy: { column: 'name' } }),
  });

  const settings = settingsQuery.data ?? null;
  const units = useMemo(() => unitsQuery.data ?? [], [unitsQuery.data]);
  const seasons = useMemo(() => seasonsQuery.data ?? [], [seasonsQuery.data]);
  const farms = useMemo(() => farmsQuery.data ?? [], [farmsQuery.data]);
  const crops = useMemo(() => cropsQuery.data ?? [], [cropsQuery.data]);

  const [seasonId, setSeasonIdState] = useState<string | null>(() => localStorage.getItem(SEASON_KEY));

  // Pick a sensible season on first load: saved -> household default -> running -> newest.
  useEffect(() => {
    if (seasons.length === 0) return;
    const valid = seasonId && seasons.some((s) => s.id === seasonId);
    if (valid) return;
    const fallback =
      seasons.find((s) => s.id === settings?.default_season_id) ??
      seasons.find((s) => s.status === 'active') ??
      seasons[0];
    if (fallback) {
      setSeasonIdState(fallback.id);
      localStorage.setItem(SEASON_KEY, fallback.id);
    }
  }, [seasons, settings?.default_season_id, seasonId]);

  // Currency, number formatting and theme follow the household settings.
  useEffect(() => {
    if (!settings) return;
    configureFormatting({ currency: settings.currency, locale: settings.locale });
    const dark =
      settings.theme === 'dark' ||
      (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
  }, [settings]);

  useEffect(() => {
    if (profile?.language) setLanguage(profile.language);
  }, [profile?.language]);

  const setSeasonId = useCallback((id: string) => {
    setSeasonIdState(id);
    localStorage.setItem(SEASON_KEY, id);
  }, []);

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries();
  }, [queryClient]);

  const value = useMemo<AppDataValue>(() => {
    const farmById = new Map(farms.map((f) => [f.id, f]));
    const cropById = new Map(crops.map((c) => [c.id, c]));
    const language = profile?.language ?? 'en';
    return {
      settings,
      units,
      unitMap: indexUnits(units),
      seasons,
      farms,
      crops,
      seasonId,
      season: seasons.find((s) => s.id === seasonId) ?? null,
      setSeasonId,
      loading:
        enabled &&
        (settingsQuery.isLoading || unitsQuery.isLoading || seasonsQuery.isLoading || farmsQuery.isLoading || cropsQuery.isLoading),
      refresh,
      farmById,
      cropById,
      cropName: (id) => {
        if (!id) return '';
        const crop = cropById.get(id);
        if (!crop) return '';
        return language === 'gu' && crop.name_gu ? crop.name_gu : crop.name;
      },
    };
  }, [
    settings,
    units,
    seasons,
    farms,
    crops,
    seasonId,
    setSeasonId,
    enabled,
    settingsQuery.isLoading,
    unitsQuery.isLoading,
    seasonsQuery.isLoading,
    farmsQuery.isLoading,
    cropsQuery.isLoading,
    refresh,
    profile?.language,
  ]);

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData(): AppDataValue {
  const context = useContext(AppDataContext);
  if (!context) throw new Error('useAppData must be used inside AppDataProvider');
  return context;
}
