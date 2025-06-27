// FILE: components/LeadForm.tsx (Refactored for i18n)
'use client';

import { useState } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toastprovider';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl'; 
import { trackEvent } from '@/lib/analytics';

type FormValues = {
  fullname: string;
  email: string;
  city: string;
  phone?: string;
  revenue?: string;
  ticket?: string;
  wallet_address?: string;
  website?: string;
  deposit_size?: string;
};

// CHANGED: Removed props for title, description, ctaText
type LeadFormProps = {
  type: 'merchant' | 'borrower' | 'lender';
};

export function LeadForm({ type }: LeadFormProps) {
  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormValues>();
  const [isLoading, setIsLoading] = useState(false);
  const { showToast } = useToast();
  
  const t = useTranslations('leadForm');

  const onSubmit: SubmitHandler<FormValues> = async (data: any) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ leadType: type, ...data }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.details || result.error || t('toast.error'));
      }

      // Fire the analytics event upon successful submission.
      trackEvent(
        'generate_lead', // The action that occurred
        type,              // The category (dynamically 'merchant', 'borrower', or 'lender')
        data.email         // The label (using email is useful for tracking uniqueness)
      );

      showToast(t('toast.success'), 'success');
      reset();
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    // CHANGED: Use dynamic translations for title, description, etc.
    <section id="register" className="w-full max-w-2xl mx-auto py-20 px-4">
      <div className="bg-primary/90 p-8 rounded-lg shadow-lg text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-secondary mb-2">{t(`${type}.title`)}</h2>
        <p className="text-lg text-neutral mb-8">{t(`${type}.description`)}</p>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 text-left">
          <div style={{ position: 'absolute', left: '-5000px' }} aria-hidden="true">
            <Input type="text" {...register('website')} tabIndex={-1} autoComplete="off" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Input placeholder={t('placeholders.fullName')} {...register('fullname', { required: true })} className="w-full p-3 rounded-md border border-gray-600 bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-[#50e2c3]" />
              {errors.fullname && <span className="text-red-500 text-sm">{t('errors.fullName')}</span>}
            </div>
            <div>
              <Input placeholder={t('placeholders.email')} {...register('email', { required: true, pattern: /^\S+@\S+$/i })} className="w-full p-3 rounded-md border border-gray-600 bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-[#50e2c3]" />
              {errors.email && <span className="text-red-500 text-sm">{t('errors.email')}</span>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Input placeholder={t('placeholders.city')} {...register('city', { required: true })} className="w-full p-3 rounded-md border border-gray-600 bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-[#50e2c3]" />
              {errors.city && <span className="text-red-500 text-sm">{t('errors.city')}</span>}
            </div>
            <div>
              <Input
                placeholder={t('placeholders.phone')}
                {...register('phone', {
                  required: type === 'merchant' ? t('errors.phoneRequired') : false,
                  minLength: type === 'merchant' ? { value: 8, message: t('errors.phoneMinLength') } : undefined
                })}
                className="w-full p-3 rounded-md border border-gray-600 bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-[#50e2c3]"
              />
              {errors.phone && <span className="text-red-500 text-sm">{errors.phone.message}</span>}
            </div>
          </div>

          {type === 'merchant' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Input
                  placeholder={t('placeholders.revenue')}
                  {...register('revenue', { required: t('errors.revenue') })}
                  className="w-full p-3 rounded-md border border-gray-600 bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-[#50e2c3]"
                />
                {errors.revenue && <span className="text-red-500 text-sm">{errors.revenue.message}</span>}
              </div>
              <div>
                <Input
                  placeholder={t('placeholders.ticket')}
                  {...register('ticket', { required: t('errors.ticket') })}
                  className="w-full p-3 rounded-md border border-gray-600 bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-[#50e2c3]"
                />
                {errors.ticket && <span className="text-red-500 text-sm">{errors.ticket.message}</span>}
              </div>
            </div>
          )}

          {type === 'lender' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Input placeholder={t('placeholders.wallet')} {...register('wallet_address')} className="w-full p-3 rounded-md border border-gray-600 bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-[#50e2c3]" />
              </div>
              <div>
                <Input placeholder={t('placeholders.deposit')} {...register('deposit_size')} className="w-full p-3 rounded-md border border-gray-600 bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-[#50e2c3]" />
              </div>
            </div>
          )}

          <div className="text-center pt-2">
            <Button type="submit" variant="gradient" size="xl" disabled={isLoading} className="w-full md:w-auto py-4 px-8 gap-1.5 mt-8 bg-[#264C73] hover:bg-[#50e2c3] text-white hover:text-gray-900 rounded-full">
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t(`${type}.cta`)}
            </Button>
          </div>
        </form>
      </div>
    </section>
  );
}