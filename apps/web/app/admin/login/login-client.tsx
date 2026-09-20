'use client';

import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { z } from 'zod';

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  useToast,
} from '@remnaray/ui';

import { adminApi, errorCode, setAdminCsrfToken } from '../../../lib/admin-client';

const challengeSchema = z.object({ requiresTotp: z.boolean(), challengeId: z.string() });
const setupSchema = z.object({ otpauthUrl: z.string(), qrPng: z.string() });
const sessionSchema = z.object({
  admin: z.object({ id: z.string(), email: z.string(), role: z.string() }),
  csrfToken: z.string(),
});

type Step = 'password' | 'totp' | 'setup';

export default function AdminLoginClient() {
  const t = useTranslations('admin');
  const errors = useTranslations('errors');
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [setup, setSetup] = useState<{ otpauthUrl: string; qrPng: string } | null>(null);
  const [pending, setPending] = useState(false);

  const fail = useCallback(
    (error: unknown) => {
      const code = errorCode(error).toLowerCase();
      toast({
        title: t('errorTitle'),
        description: errors.has(code) ? errors(code) : errors('internal_error', { incidentId: '' }),
        variant: 'danger',
      });
    },
    [errors, t, toast],
  );

  const submitPassword = useCallback(() => {
    setPending(true);
    adminApi()
      .send('POST', 'api/admin/v1/auth/login', challengeSchema, { email, password })
      .then(
        async (challenge) => {
          setChallengeId(challenge.challengeId);
          try {
            const enrolment = await adminApi().send(
              'POST',
              'api/admin/v1/auth/totp/setup',
              setupSchema,
              { challengeId: challenge.challengeId },
            );
            setSetup(enrolment);
            setStep('setup');
          } catch {
            setStep('totp');
          }
        },
        (error: unknown) => {
          fail(error);
        },
      )
      .finally(() => {
        setPending(false);
      });
  }, [email, fail, password]);

  const submitCode = useCallback(() => {
    setPending(true);
    adminApi()
      .send(
        'POST',
        step === 'setup' ? 'api/admin/v1/auth/totp/confirm' : 'api/admin/v1/auth/totp',
        sessionSchema,
        { challengeId, code },
      )
      .then(
        (session) => {
          setAdminCsrfToken(session.csrfToken);
          router.replace('/admin');
        },
        (error: unknown) => {
          fail(error);
        },
      )
      .finally(() => {
        setPending(false);
      });
  }, [challengeId, code, fail, router, step]);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md items-center px-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>
            {step === 'password'
              ? t('login.title')
              : step === 'setup'
                ? t('login.setupTitle')
                : t('login.totpTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {step === 'password' ? (
            <>
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">{t('login.email')}</Label>
                <Input
                  autoComplete="username"
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                  }}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="password">{t('login.password')}</Label>
                <Input
                  autoComplete="current-password"
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                  }}
                />
              </div>
              <Button disabled={pending || !email || !password} onClick={submitPassword}>
                {t('login.submit')}
              </Button>
            </>
          ) : (
            <>
              {step === 'setup' && setup ? (
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-muted-foreground">{t('login.setupHint')}</p>
                  <img
                    alt={t('login.setupAlt')}
                    className="size-48 self-center rounded-md border border-border bg-white p-2"
                    height={192}
                    src={`data:image/png;base64,${setup.qrPng}`}
                    width={192}
                  />
                  <details>
                    <summary className="cursor-pointer text-xs text-muted-foreground">
                      {t('login.manualSecret')}
                    </summary>
                    <p className="mt-2 break-all font-mono text-xs">{setup.otpauthUrl}</p>
                  </details>
                </div>
              ) : null}
              <div className="flex flex-col gap-2">
                <Label htmlFor="code">{t('login.totpCode')}</Label>
                <Input
                  autoComplete="one-time-code"
                  id="code"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(event) => {
                    setCode(event.target.value.replaceAll(/\D/gu, ''));
                  }}
                />
              </div>
              <Button disabled={pending || code.length !== 6} onClick={submitCode}>
                {t('login.totpSubmit')}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
