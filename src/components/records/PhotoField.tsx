import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase/client';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../ui/Toast';
import { Button } from '../ui/Button';

const BUCKET = 'record-photos';
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

/** Small tappable thumbnail for showing an attached photo in a record list. */
export function PhotoThumb({ url, alt }: { url: string; alt?: string }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block">
      <img
        src={url}
        alt={alt ?? ''}
        loading="lazy"
        className="h-16 w-16 rounded-lg border border-slate-200 object-cover dark:border-slate-700"
      />
    </a>
  );
}

/**
 * Optional photo attachment for any record form. Uploads to Supabase Storage
 * and stores the resulting public URL. Never required - a farmer can always
 * save without a photo.
 */
export function PhotoField({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (url: string) => void;
  label?: string;
}) {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const pick = () => inputRef.current?.click();

  const upload = async (file: File) => {
    if (!profile) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      toast.error(t('photo.needsInternet'));
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error(t('photo.tooLarge'));
      return;
    }
    setBusy(true);
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
      const path = `${profile.household_id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || 'image/jpeg',
      });
      if (error) throw error;
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      onChange(data.publicUrl);
    } catch {
      toast.error(t('photo.uploadFailed'));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="mb-4">
      <span className="label">
        {label ?? t('photo.label')} <span className="font-normal text-slate-500">({t('common.optional')})</span>
      </span>

      {value ? (
        <div className="relative inline-block">
          <img src={value} alt={label ?? t('photo.label')} className="max-h-48 rounded-xl border border-slate-200 dark:border-slate-700" />
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label={t('common.delete')}
            className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-lg text-white"
          >
            ✕
          </button>
        </div>
      ) : (
        <div>
          <Button type="button" variant="secondary" loading={busy} onClick={pick} icon={<span aria-hidden="true">📷</span>}>
            {busy ? t('photo.uploading') : t('photo.add')}
          </Button>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
        }}
      />
    </div>
  );
}
