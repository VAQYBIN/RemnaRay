import type { Metadata } from 'next';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';

import { Button, Card, CardContent, CardHeader, CardTitle } from '@remnaray/ui';

import { Link } from '../../i18n/navigation';
import { routing, type Locale } from '../../i18n/routing';

type PageProps = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale: value } = await params;
  const locale = normalizeLocale(value);
  const t = await getTranslations({ locale, namespace: 'seo' });
  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: `/${locale}`,
      languages: { ru: '/ru', en: '/en', 'x-default': '/ru' },
    },
    openGraph: {
      title: t('title'),
      description: t('description'),
      images: ['/themes/manta/og.png'],
    },
  };
}

export default async function LandingPage() {
  const t = await getTranslations('landing');
  const plans = await getPlans();
  const features = t.raw('features') as string[];
  const steps = t.raw('steps') as string[];
  const faq = t.raw('faq') as Array<{ question: string; answer: string }>;

  return (
    <main>
      <section className="relative overflow-hidden px-6 py-20 sm:py-28">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-primary">
              {t('hero.eyebrow')}
            </p>
            <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
              {t('hero.title')}
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-muted-foreground">{t('hero.description')}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/terms">
                <Button size="lg">{t('hero.cta')}</Button>
              </Link>
              <Link href="/privacy">
                <Button variant="secondary" size="lg">
                  {t('hero.secondary')}
                </Button>
              </Link>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-md overflow-hidden rounded-3xl border border-border bg-dark-background p-3 shadow-xl">
            <Image
              src="/themes/manta/og.png"
              alt={t('hero.imageAlt')}
              width={1200}
              height={630}
              className="h-auto w-full rounded-2xl"
              priority
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16" aria-labelledby="features-heading">
        <h2 id="features-heading" className="text-3xl font-bold">
          {t('featuresTitle')}
        </h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {features.map((feature) => (
            <Card key={feature}>
              <CardContent className="p-6 text-lg font-medium">{feature}</CardContent>
            </Card>
          ))}
        </div>
      </section>

      {plans.length > 0 ? (
        <section className="bg-surface px-6 py-16" aria-labelledby="plans-heading">
          <div className="mx-auto max-w-6xl">
            <h2 id="plans-heading" className="text-3xl font-bold">
              {t('plansTitle')}
            </h2>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {plans.map((plan) => (
                <Card key={plan.slug}>
                  <CardHeader>
                    <CardTitle>{plan.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{plan.priceMinor} ₽</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {plan.durationDays} {t('days')}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="mx-auto max-w-6xl px-6 py-16" aria-labelledby="steps-heading">
        <h2 id="steps-heading" className="text-3xl font-bold">
          {t('stepsTitle')}
        </h2>
        <ol className="mt-8 grid gap-4 md:grid-cols-3">
          {steps.map((step, index) => (
            <li key={step} className="rounded-lg border border-border bg-surface p-6">
              <span className="text-sm font-semibold text-primary">0{index + 1}</span>
              <p className="mt-3 text-lg">{step}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-16" aria-labelledby="faq-heading">
        <h2 id="faq-heading" className="text-3xl font-bold">
          {t('faqTitle')}
        </h2>
        <div className="mt-6 divide-y divide-border rounded-lg border border-border bg-surface">
          {faq.map((item) => (
            <details key={item.question} className="p-5">
              <summary className="cursor-pointer font-semibold">{item.question}</summary>
              <p className="mt-3 text-muted-foreground">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className="border-t border-border px-6 py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
          <span>{t('footer')}</span>
          <nav className="flex gap-4">
            <Link href="/terms">{t('legal.terms')}</Link>
            <Link href="/privacy">{t('legal.privacy')}</Link>
            <Link href="/offer">{t('legal.offer')}</Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}

function normalizeLocale(value: string): Locale {
  return routing.locales.includes(value as Locale) ? (value as Locale) : routing.defaultLocale;
}

async function getPlans(): Promise<
  Array<{ slug: string; name: string; priceMinor: string; durationDays: number }>
> {
  try {
    const response = await fetch(
      `${process.env.INTERNAL_API_URL ?? 'http://api:3000'}/api/v1/public/plans`,
      { next: { revalidate: 60 } },
    );
    if (!response.ok) return [];
    const payload = (await response.json()) as {
      items?: Array<{
        slug: string;
        name: Record<string, string>;
        priceMinor: string;
        durationDays: number;
      }>;
    };
    return (payload.items ?? []).map((item) => ({
      slug: item.slug,
      name: item.name.en ?? item.slug,
      priceMinor: item.priceMinor,
      durationDays: item.durationDays,
    }));
  } catch {
    return [];
  }
}
