import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Card, PageHeader, SectionTitle } from '../components/ui/Layout';
import { Button } from '../components/ui/Button';
import { CheckboxField, NumberField, SelectField, TextField } from '../components/ui/Field';
import { ConfirmDialog } from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';
import { useAppData } from '../hooks/useAppData';
import { useAuth } from '../hooks/useAuth';
import { useRecords, useSaveRecord } from '../features/common/useRecords';
import { useSyncStatus } from '../hooks/usePreferences';
import { callRpc, updateRow } from '../lib/supabase/crud';
import { flushQueue } from '../lib/offline/queue';
import { exportBackup, importBackup, isBackupFile } from '../lib/export/backup';
import { downloadCsv, downloadJson, timestampedName } from '../lib/export/files';
import { toAppError } from '../lib/errors';
import { SUPPORTED_LANGUAGES, setLanguage } from '../i18n';
import { useSeasonReport } from '../features/reports/useSeasonReport';
import { unitsOfKind } from '../lib/calculations/units';
import type { Language, Profile, Theme, Unit } from '../types/db';

const APP_VERSION = '1.0.0';

export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { profile, isAdmin, refreshProfile, signOut, updatePassword } = useAuth();
  const { settings, units, seasons, seasonId, refresh } = useAppData();
  const syncStatus = useSyncStatus();
  const { dataset } = useSeasonReport(seasonId);

  const saveUnit = useSaveRecord('units');
  const membersQuery = useRecords('profiles', { includeDeleted: true });
  const householdQuery = useRecords('households', { includeDeleted: true });
  const household = householdQuery.data?.[0] ?? null;

  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDemoRemoval, setConfirmDemoRemoval] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  const areaUnits = useMemo(() => unitsOfKind(units, 'area'), [units]);
  const weightUnits = useMemo(() => unitsOfKind(units, 'weight'), [units]);

  const patchSettings = async (values: Record<string, unknown>) => {
    if (!settings) return;
    setBusy('settings');
    try {
      await updateRow('household_settings', settings.household_id, values);
      await queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success(t('common.saved'));
    } catch (error) {
      toast.error(t(toAppError(error).messageKey));
    } finally {
      setBusy(null);
    }
  };

  const changeLanguage = async (language: Language) => {
    setLanguage(language);
    if (profile) {
      await updateRow('profiles', profile.id, { language });
      await refreshProfile();
    }
  };

  const patchUnit = async (unit: Unit, factor: number) => {
    await saveUnit.mutateAsync({ id: unit.id, values: { factor_to_base: factor }, baseUpdatedAt: unit.updated_at });
    await queryClient.invalidateQueries({ queryKey: ['units'] });
  };

  const runRpc = async (fn: 'load_demo_data' | 'remove_demo_data') => {
    setBusy(fn);
    try {
      await callRpc(fn);
      await refresh();
      toast.success(t('common.saved'));
    } catch (error) {
      toast.error(t(toAppError(error).messageKey));
    } finally {
      setBusy(null);
    }
  };

  const doExportJson = async () => {
    setBusy('export');
    try {
      downloadJson(timestampedName('farm-hisab-backup', 'json'), await exportBackup());
    } catch (error) {
      toast.error(t(toAppError(error).messageKey));
    } finally {
      setBusy(null);
    }
  };

  const doImport = async (file: File) => {
    if (!profile) return;
    setBusy('import');
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!isBackupFile(parsed)) throw new Error('Invalid backup file');
      const count = await importBackup(parsed, profile.household_id);
      await refresh();
      toast.success(t('settings.importDone', { count }));
    } catch (error) {
      toast.error(t(toAppError(error).messageKey));
    } finally {
      setBusy(null);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const changeMemberRole = async (member: Profile, role: 'admin' | 'member') => {
    try {
      await updateRow('profiles', member.id, { role });
      await queryClient.invalidateQueries({ queryKey: ['profiles'] });
      toast.success(t('common.saved'));
    } catch (error) {
      toast.error(t(toAppError(error).messageKey));
    }
  };

  return (
    <section>
      <PageHeader title={t('settings.title')} />

      <Card className="mb-4">
        <SectionTitle title={t('settings.language')} />
        <div className="flex gap-3">
          {SUPPORTED_LANGUAGES.map((language) => (
            <Button
              key={language.code}
              variant={i18n.language === language.code ? 'primary' : 'secondary'}
              onClick={() => void changeLanguage(language.code)}
            >
              {language.label}
            </Button>
          ))}
        </div>
      </Card>

      <Card className="mb-4">
        <SectionTitle title={t('settings.title')} />
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label={t('settings.currency')}
            value={settings?.currency ?? 'INR'}
            disabled={!isAdmin}
            onChange={(e) => void patchSettings({ currency: e.target.value.toUpperCase() })}
          />
          <SelectField
            label={t('settings.theme')}
            value={settings?.theme ?? 'light'}
            disabled={!isAdmin}
            options={[
              { value: 'light', label: t('settings.themeLight') },
              { value: 'dark', label: t('settings.themeDark') },
              { value: 'system', label: t('settings.themeSystem') },
            ]}
            onChange={(e) => void patchSettings({ theme: e.target.value as Theme })}
          />
          <SelectField
            label={t('settings.defaultSeason')}
            value={settings?.default_season_id ?? ''}
            placeholder={t('common.select')}
            disabled={!isAdmin}
            options={seasons.map((s) => ({ value: s.id, label: s.name }))}
            onChange={(e) => void patchSettings({ default_season_id: e.target.value || null })}
          />
          <SelectField
            label={t('settings.areaUnits')}
            value={settings?.default_area_unit ?? 'vigha'}
            disabled={!isAdmin}
            options={areaUnits.map((u) => ({ value: u.code, label: u.label_en }))}
            onChange={(e) => void patchSettings({ default_area_unit: e.target.value })}
          />
          <SelectField
            label={t('settings.weightUnits')}
            value={settings?.default_weight_unit ?? 'quintal'}
            disabled={!isAdmin}
            options={weightUnits.map((u) => ({ value: u.code, label: u.label_en }))}
            onChange={(e) => void patchSettings({ default_weight_unit: e.target.value })}
          />
        </div>
        <CheckboxField
          label={t('settings.allowOverallocation')}
          checked={settings?.allow_area_overallocation ?? false}
          disabled={!isAdmin}
          onChange={(checked) => void patchSettings({ allow_area_overallocation: checked })}
        />
        <CheckboxField
          label={t('settings.requireFullAllocation')}
          checked={settings?.require_full_allocation ?? true}
          disabled={!isAdmin}
          onChange={(checked) => void patchSettings({ require_full_allocation: checked })}
        />
        {!isAdmin ? <p className="text-sm text-slate-600 dark:text-slate-400">{t('settings.adminOnly')}</p> : null}
      </Card>

      <Card className="mb-4">
        <SectionTitle title={t('settings.conversion')} />
        <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">{t('settings.conversionHelp')}</p>
        <ul className="space-y-2">
          {areaUnits.map((unit) => (
            <li key={unit.id} className="flex items-end gap-3">
              <div className="flex-1">
                <NumberField
                  label={`1 ${unit.label_en} = ? ${t('common.acres')}`}
                  defaultValue={unit.factor_to_base}
                  disabled={!isAdmin || unit.code === 'acre'}
                  onBlur={(e) => {
                    const factor = Number(e.target.value);
                    if (isAdmin && factor > 0 && factor !== unit.factor_to_base) void patchUnit(unit, factor);
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="mb-4">
        <SectionTitle title={t('settings.family')} />
        {household ? (
          <p className="mb-3 text-base">
            {t('settings.inviteCode')}: <strong className="tracking-widest">{household.invite_code}</strong>
            <span className="block text-sm text-slate-600 dark:text-slate-400">{t('settings.inviteCodeHelp')}</span>
          </p>
        ) : null}
        <ul className="space-y-2">
          {(membersQuery.data ?? []).map((member) => (
            <li key={member.id} className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-base font-semibold">{member.full_name || member.id.slice(0, 8)}</span>
              {isAdmin && member.id !== profile?.id ? (
                <select
                  aria-label={t('settings.role')}
                  value={member.role}
                  onChange={(e) => void changeMemberRole(member, e.target.value as 'admin' | 'member')}
                  className="input max-w-[200px]"
                >
                  <option value="admin">{t('settings.roleAdmin')}</option>
                  <option value="member">{t('settings.roleMember')}</option>
                </select>
              ) : (
                <span className="text-base">{member.role === 'admin' ? t('settings.roleAdmin') : t('settings.roleMember')}</span>
              )}
            </li>
          ))}
        </ul>
      </Card>

      <Card className="mb-4">
        <SectionTitle title={t('settings.sync')} />
        <p className="text-base">{t('settings.pendingChanges', { count: syncStatus.pending })}</p>
        <Button className="mt-2" variant="secondary" onClick={() => void flushQueue()}>
          {t('settings.syncNow')}
        </Button>
      </Card>

      <Card className="mb-4">
        <SectionTitle title={t('auth.setNewPassword')} />
        <TextField
          label={t('auth.password')}
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <Button
          loading={busy === 'password'}
          disabled={newPassword.length < 6}
          onClick={async () => {
            setBusy('password');
            try {
              await updatePassword(newPassword);
              setNewPassword('');
              toast.success(t('auth.passwordUpdated'));
            } catch (error) {
              toast.error(t(toAppError(error).messageKey));
            } finally {
              setBusy(null);
            }
          }}
        >
          {t('common.save')}
        </Button>
      </Card>

      <Card className="mb-4">
        <SectionTitle title={t('settings.backup')} />
        <div className="flex flex-wrap gap-3">
          <Button loading={busy === 'export'} onClick={() => void doExportJson()}>
            {t('settings.exportJson')}
          </Button>
          <Button
            variant="secondary"
            onClick={() => downloadCsv(timestampedName('expenses', 'csv'), dataset.expenses as unknown as Array<Record<string, unknown>>)}
          >
            {t('settings.exportExpenses')}
          </Button>
          <Button
            variant="secondary"
            onClick={() => downloadCsv(timestampedName('harvest', 'csv'), dataset.harvests as unknown as Array<Record<string, unknown>>)}
          >
            {t('settings.exportHarvest')}
          </Button>
          <Button
            variant="secondary"
            onClick={() => downloadCsv(timestampedName('sales', 'csv'), dataset.sales as unknown as Array<Record<string, unknown>>)}
          >
            {t('settings.exportSales')}
          </Button>
        </div>
        <div className="mt-4">
          <label className="label" htmlFor="import-file">
            {t('settings.import')}
          </label>
          <input
            id="import-file"
            ref={fileInput}
            type="file"
            accept="application/json"
            disabled={busy === 'import'}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void doImport(file);
            }}
            className="input"
          />
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t('settings.importHelp')}</p>
        </div>
      </Card>

      {isAdmin ? (
        <Card className="mb-4">
          <SectionTitle title={t('settings.demoData')} />
          <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">{t('settings.demoHelp')}</p>
          <div className="flex flex-wrap gap-3">
            <Button loading={busy === 'load_demo_data'} onClick={() => void runRpc('load_demo_data')}>
              {t('settings.loadDemo')}
            </Button>
            <Button variant="danger" onClick={() => setConfirmDemoRemoval(true)}>
              {t('settings.removeDemo')}
            </Button>
          </div>
        </Card>
      ) : null}

      <Card className="mb-4">
        <SectionTitle title={t('settings.about')} />
        <p className="text-base">{t('settings.aboutText')}</p>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {t('settings.version')}: {APP_VERSION}
        </p>
        <Button className="mt-3" variant="secondary" onClick={() => void signOut()}>
          {t('auth.signOut')}
        </Button>
      </Card>

      <ConfirmDialog
        open={confirmDemoRemoval}
        title={t('settings.removeDemo')}
        message={t('settings.demoHelp')}
        confirmLabel={t('settings.removeDemo')}
        busy={busy === 'remove_demo_data'}
        onCancel={() => setConfirmDemoRemoval(false)}
        onConfirm={async () => {
          await runRpc('remove_demo_data');
          setConfirmDemoRemoval(false);
        }}
      />
    </section>
  );
}
