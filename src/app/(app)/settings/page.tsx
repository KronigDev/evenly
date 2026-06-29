'use client';

import {
  Suspense,
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { Camera, Trash } from '@phosphor-icons/react';
import { ApiClientError, apiFetch } from '@/lib/api/client';
import type { UserDTO } from '@/lib/api/types';
import { CURRENCIES } from '@/lib/currency';
import { useUser } from '@/components/app/user-context';
import { PageHeader } from '@/components/app/page-header';
import { PasswordInput } from '@/components/auth/password-input';
import { MIN_PASSWORD_LENGTH } from '@/components/auth/utils';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';

type SettingsTab = 'profile' | 'preferences' | 'notifications' | 'account';

interface SectionProps {
  user: UserDTO;
  setUser: (user: UserDTO) => void;
}

const MAX_AVATAR_BYTES = 4 * 1024 * 1024;

/* --------------------------------- Profile -------------------------------- */

function ProfileSection({ user, setUser }: SectionProps) {
  const t = useTranslations('settings');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const { toast } = useToast();

  const [name, setName] = useState(user.name);
  const [currency, setCurrency] = useState(user.defaultCurrency);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  const dirty = name.trim() !== user.name || currency !== user.defaultCurrency;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (name.trim().length === 0) return;
    setSaving(true);
    try {
      const updated = await apiFetch<UserDTO>('/api/me', {
        method: 'PATCH',
        body: { name: name.trim(), defaultCurrency: currency },
      });
      setUser(updated);
      toast.success(t('profileUpdated'));
    } catch {
      toast.error(te('generic'));
    } finally {
      setSaving(false);
    }
  }

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > MAX_AVATAR_BYTES) {
      toast.error(te('generic'));
      return;
    }
    setPreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const updated = await apiFetch<UserDTO>('/api/me/avatar', { method: 'POST', body: form });
      setUser(updated);
      setPreview(null);
      toast.success(t('profileUpdated'));
    } catch {
      setPreview(null);
      toast.error(te('generic'));
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-center gap-4">
        <Avatar name={user.name} image={preview ?? user.image} size="lg" />
        <div className="flex flex-col gap-2">
          <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={onFile} />
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Camera size={16} />}
            loading={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {t('changeAvatar')}
          </Button>
          <p className="text-2xs text-content-subtle">{user.email}</p>
        </div>
      </div>

      <form onSubmit={save} className="mt-6 space-y-4">
        <Field label={t('displayName')}>
          <Input
            value={name}
            autoComplete="name"
            onChange={(event) => setName(event.target.value)}
          />
        </Field>

        <Field label={t('defaultCurrency')}>
          <Select value={currency} onChange={(event) => setCurrency(event.target.value)}>
            {CURRENCIES.map((entry) => (
              <option key={entry.code} value={entry.code}>
                {entry.code} — {entry.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={tc('email')} hint={t('emailReadonlyHint')}>
          <Input value={user.email} disabled readOnly />
        </Field>

        <div className="flex justify-end">
          <Button type="submit" loading={saving} disabled={!dirty}>
            {tc('saveChanges')}
          </Button>
        </div>
      </form>
    </Card>
  );
}

/* ------------------------------- Preferences ------------------------------ */

function PreferencesSection({ user, setUser }: SectionProps) {
  const t = useTranslations('settings');
  const te = useTranslations('errors');
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();

  const [mounted, setMounted] = useState(false);
  const [savingLang, setSavingLang] = useState(false);
  useEffect(() => setMounted(true), []);

  async function changeLanguage(locale: string) {
    if (locale === user.locale || savingLang) return;
    setSavingLang(true);
    try {
      const updated = await apiFetch<UserDTO>('/api/me', { method: 'PATCH', body: { locale } });
      await apiFetch('/api/me/locale', { method: 'POST', body: { locale } });
      setUser(updated);
      router.refresh();
    } catch {
      toast.error(te('generic'));
    } finally {
      setSavingLang(false);
    }
  }

  async function changeTheme(choice: 'light' | 'dark' | 'system') {
    setTheme(choice);
    const themeUpper = choice.toUpperCase() as UserDTO['theme'];
    try {
      const updated = await apiFetch<UserDTO>('/api/me', {
        method: 'PATCH',
        body: { theme: themeUpper },
      });
      await apiFetch('/api/me/theme', { method: 'POST', body: { theme: themeUpper } });
      setUser(updated);
    } catch {
      toast.error(te('generic'));
    }
  }

  const currentTheme = (mounted ? theme : user.theme.toLowerCase()) ?? 'system';
  const themeValue: 'light' | 'dark' | 'system' =
    currentTheme === 'light' || currentTheme === 'dark' ? currentTheme : 'system';

  return (
    <Card className="divide-y divide-hairline p-0">
      <div className="flex flex-col gap-3 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-content">{t('language')}</p>
        </div>
        <Select
          aria-label={t('language')}
          value={user.locale === 'de' ? 'de' : 'en'}
          disabled={savingLang}
          onChange={(event) => void changeLanguage(event.target.value)}
          className="sm:w-44"
        >
          <option value="en">English</option>
          <option value="de">Deutsch</option>
        </Select>
      </div>

      <div className="flex flex-col gap-3 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium text-content">{t('theme')}</p>
        <SegmentedControl<'light' | 'dark' | 'system'>
          size="sm"
          aria-label={t('theme')}
          value={themeValue}
          onChange={(value) => void changeTheme(value)}
          options={[
            { value: 'light', label: t('light') },
            { value: 'dark', label: t('dark') },
            { value: 'system', label: t('system') },
          ]}
        />
      </div>
    </Card>
  );
}

/* ------------------------------ Notifications ----------------------------- */

const NOTIFY_KEYS = [
  { key: 'notifyExpenseEmail', label: 'notifyExpenses' },
  { key: 'notifyReminderEmail', label: 'notifyReminders' },
  { key: 'notifyInviteEmail', label: 'notifyInvites' },
  { key: 'notifyCommentEmail', label: 'notifyComments' },
  { key: 'notifyInApp', label: 'inApp' },
] as const;

type NotifyKey = (typeof NOTIFY_KEYS)[number]['key'];

function NotificationsSection({ user, setUser }: SectionProps) {
  const t = useTranslations('settings');
  const te = useTranslations('errors');
  const { toast } = useToast();
  const baseId = useId();

  async function toggle(key: NotifyKey, value: boolean) {
    const previous = user;
    setUser({ ...user, [key]: value });
    try {
      const updated = await apiFetch<UserDTO>('/api/me', {
        method: 'PATCH',
        body: { [key]: value },
      });
      setUser(updated);
    } catch {
      setUser(previous);
      toast.error(te('generic'));
    }
  }

  return (
    <Card className="p-0">
      <div className="border-b border-hairline px-5 py-4">
        <p className="text-sm font-medium text-content">{t('emailNotifications')}</p>
        <p className="mt-0.5 text-xs text-content-muted">{t('manageNotifications')}</p>
      </div>
      <ul className="divide-y divide-hairline">
        {NOTIFY_KEYS.map(({ key, label }) => {
          const id = `${baseId}-${key}`;
          return (
            <li key={key} className="flex items-center justify-between gap-4 px-5 py-4">
              <label htmlFor={id} className="text-sm text-content">
                {t(label)}
              </label>
              <Switch
                id={id}
                aria-label={t(label)}
                checked={user[key]}
                onCheckedChange={(value) => void toggle(key, value)}
              />
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/* -------------------------------- Security -------------------------------- */

function PasswordCard({ user }: { user: UserDTO }) {
  const t = useTranslations('settings');
  const ta = useTranslations('auth');
  const te = useTranslations('errors');
  const { toast } = useToast();

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (next.length < MIN_PASSWORD_LENGTH) {
      setError(ta('passwordRequirements'));
      return;
    }
    if (next !== confirm) {
      setError(ta('passwordsDontMatch'));
      return;
    }

    setSaving(true);
    try {
      await apiFetch('/api/me/password', {
        method: 'POST',
        body: user.hasPassword
          ? { currentPassword: current, newPassword: next }
          : { newPassword: next },
      });
      setCurrent('');
      setNext('');
      setConfirm('');
      toast.success(t('passwordUpdated'));
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 401) {
        setError(ta('invalidCredentials'));
      } else {
        setError(te('generic'));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-sm font-semibold text-content">
        {user.hasPassword ? t('changePassword') : t('setPassword')}
      </h2>
      {!user.hasPassword ? (
        <p className="mt-1 text-xs text-content-muted">{t('noPasswordHint')}</p>
      ) : null}

      <form onSubmit={submit} className="mt-4 space-y-4" noValidate>
        {error ? (
          <p
            role="alert"
            className="rounded-lg border border-negative/30 bg-negative/10 px-3 py-2 text-sm text-negative"
          >
            {error}
          </p>
        ) : null}

        {user.hasPassword ? (
          <Field label={t('currentPassword')}>
            <PasswordInput
              autoComplete="current-password"
              value={current}
              onChange={(event) => setCurrent(event.target.value)}
            />
          </Field>
        ) : null}

        <Field label={t('newPassword')} hint={ta('passwordRequirements')}>
          <PasswordInput
            autoComplete="new-password"
            value={next}
            onChange={(event) => setNext(event.target.value)}
          />
        </Field>

        <Field label={t('confirmNewPassword')}>
          <PasswordInput
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
          />
        </Field>

        <div className="flex justify-end">
          <Button type="submit" loading={saving} disabled={next.length === 0}>
            {user.hasPassword ? t('changePassword') : t('setPassword')}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function DangerZone() {
  const t = useTranslations('settings');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  async function remove() {
    setDeleting(true);
    try {
      await apiFetch('/api/me', { method: 'DELETE' });
      window.location.href = '/login';
    } catch {
      setDeleting(false);
      toast.error(te('generic'));
    }
  }

  return (
    <Card className="border-negative/30 p-5 sm:p-6">
      <h2 className="text-sm font-semibold text-negative">{t('dangerZone')}</h2>
      <p className="mt-1 max-w-prose text-pretty text-sm text-content-muted">
        {t('deleteAccountWarning')}
      </p>
      <div className="mt-4">
        <Button variant="danger" leftIcon={<Trash size={16} />} onClick={() => setOpen(true)}>
          {t('deleteAccount')}
        </Button>
      </div>

      <Dialog
        open={open}
        onOpenChange={(value) => !deleting && setOpen(value)}
        dismissible={!deleting}
        aria-label={t('deleteAccount')}
      >
        <DialogHeader
          title={t('deleteAccount')}
          description={t('deleteAccountWarning')}
          onClose={deleting ? undefined : () => setOpen(false)}
        />
        <DialogBody>
          <Field label={t('deleteAccountConfirm')}>
            <Input
              value={confirmText}
              autoFocus
              onChange={(event) => setConfirmText(event.target.value)}
              placeholder="DELETE"
            />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={deleting}>
            {tc('cancel')}
          </Button>
          <Button
            variant="danger"
            loading={deleting}
            disabled={confirmText !== 'DELETE'}
            onClick={() => void remove()}
          >
            {t('deleteAccount')}
          </Button>
        </DialogFooter>
      </Dialog>
    </Card>
  );
}

function SecuritySection({ user }: { user: UserDTO }) {
  return (
    <div className="space-y-4">
      <PasswordCard user={user} />
      <DangerZone />
    </div>
  );
}

/* --------------------------------- Page ----------------------------------- */

function SettingsContent() {
  const t = useTranslations('settings');
  const ta = useTranslations('auth');
  const { user, setUser } = useUser();
  const { toast } = useToast();
  const params = useSearchParams();

  const [tab, setTab] = useState<SettingsTab>('profile');

  const verified = params.get('verified') === '1';
  const verifiedShown = useRef(false);
  useEffect(() => {
    if (verified && !verifiedShown.current) {
      verifiedShown.current = true;
      toast.success(ta('emailVerified'));
    }
  }, [verified, toast, ta]);

  const tabs: { value: SettingsTab; label: string }[] = [
    { value: 'profile', label: t('profile') },
    { value: 'preferences', label: t('preferences') },
    { value: 'notifications', label: t('notifications') },
    { value: 'account', label: t('account') },
  ];

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <PageHeader title={t('title')} />

      <div className="mt-6">
        <Tabs
          items={tabs}
          value={tab}
          onValueChange={setTab}
          aria-label={t('title')}
          className="overflow-x-auto"
        />
      </div>

      <div role="tabpanel" className="mt-6">
        {tab === 'profile' ? <ProfileSection user={user} setUser={setUser} /> : null}
        {tab === 'preferences' ? <PreferencesSection user={user} setUser={setUser} /> : null}
        {tab === 'notifications' ? <NotificationsSection user={user} setUser={setUser} /> : null}
        {tab === 'account' ? <SecuritySection user={user} /> : null}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <SettingsContent />
    </Suspense>
  );
}
