'use client';

import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';

import { anonymizationRequestSchema, userMeSchema, type UserMeView } from '@remnaray/domain';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useToast,
} from '@remnaray/ui';

import { browserApi } from '../../../../lib/api';
import { invalidate, useResource } from '../../../../lib/resource';
import { useRouter } from '../../../../i18n/navigation';
import { routing, type Locale } from '../../../../i18n/routing';
import { AccountHeading } from '../account-chrome';
import { ResourceSection, useErrorMessage } from '../states';

export default function SettingsClient({ locale }: { locale: Locale }) {
  const t = useTranslations('account');
  const common = useTranslations('common');
  const { toast } = useToast();
  const message = useErrorMessage();
  const router = useRouter();
  const [draft, setDraft] = useState<{
    language: string;
    email: string;
    marketingOptOut: boolean;
  } | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const resource = useResource<UserMeView>('me', () => browserApi().get('api/v1/me', userMeSchema));

  const save = useCallback(
    (value: { language: string; email: string; marketingOptOut: boolean }) => {
      setPending(true);
      browserApi()
        .send('PATCH', 'api/v1/me', userMeSchema, {
          language: value.language,
          email: value.email === '' ? null : value.email,
          marketingOptOut: value.marketingOptOut,
        })
        .then(
          (updated) => {
            invalidate('me');
            toast({ title: t('settings.saved') });
            const next = routing.locales.find((item) => item === updated.language);
            if (next && next !== locale) router.replace('/account/settings', { locale: next });
          },
          (error: unknown) => {
            toast({
              title: t('errorTitle'),
              description: message(codeOf(error)),
              variant: 'danger',
            });
          },
        )
        .finally(() => {
          setPending(false);
        });
    },
    [locale, message, router, t, toast],
  );

  return (
    <section>
      <AccountHeading description={t('settings.description')} title={t('settings.title')} />
      <ResourceSection refresh={resource.refresh} state={resource.state}>
        {(data) => {
          const value = draft ?? {
            language: data.language,
            email: data.email ?? '',
            marketingOptOut: data.marketingOptOut,
          };
          return (
            <div className="flex max-w-xl flex-col gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>{t('settings.title')}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-5">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="language">{t('settings.language')}</Label>
                    <Select
                      value={value.language}
                      onValueChange={(next) => {
                        setDraft({ ...value, language: next });
                      }}
                    >
                      <SelectTrigger id="language">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {routing.locales.map((item) => (
                          <SelectItem key={item} value={item}>
                            {common(`language.${item}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="email">{t('settings.email')}</Label>
                    <Input
                      autoComplete="email"
                      id="email"
                      type="email"
                      value={value.email}
                      onChange={(event) => {
                        setDraft({ ...value, email: event.target.value });
                      }}
                    />
                    <p className="text-xs text-muted-foreground">{t('settings.emailHint')}</p>
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      checked={!value.marketingOptOut}
                      id="marketing"
                      type="checkbox"
                      onChange={(event) => {
                        setDraft({ ...value, marketingOptOut: !event.target.checked });
                      }}
                    />
                    <Label htmlFor="marketing">{t('settings.marketing')}</Label>
                  </div>

                  <div>
                    <Button
                      disabled={pending}
                      onClick={() => {
                        save(value);
                      }}
                    >
                      {t('settings.save')}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t('settings.deleteAccount')}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <p className="text-sm text-muted-foreground">{t('settings.deleteDescription')}</p>
                  <div>
                    <Button
                      variant="danger"
                      onClick={() => {
                        setConfirmDelete(true);
                      }}
                    >
                      {t('settings.deleteAccount')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          );
        }}
      </ResourceSection>

      <ConfirmDialog
        description={t('settings.deleteDescription')}
        destructive
        labels={{ cancel: common('cancel'), confirm: common('confirm'), reasonLabel: '' }}
        onConfirm={() => {
          setPending(true);
          browserApi()
            .send('POST', 'api/v1/me/anonymize-request', anonymizationRequestSchema)
            .then(
              () => {
                setConfirmDelete(false);
                toast({ title: t('settings.deleteRequested') });
              },
              (error: unknown) => {
                toast({
                  title: t('errorTitle'),
                  description: message(codeOf(error)),
                  variant: 'danger',
                });
              },
            )
            .finally(() => {
              setPending(false);
            });
        }}
        onOpenChange={setConfirmDelete}
        open={confirmDelete}
        pending={pending}
        title={t('settings.deleteTitle')}
      />
    </section>
  );
}

function codeOf(error: unknown): string {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String(error.code)
    : 'INTERNAL_ERROR';
}
