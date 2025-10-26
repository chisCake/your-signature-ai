import { SignUpForm } from '@/components/forms/sign-up-form';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Регистрация | Your Sign AI',
};

export default function Page() {
  return (
    <div className='flex min-h-content w-full items-center justify-center p-6 md:p-10'>
      <div className='w-full max-w-sm'>
        <SignUpForm />
      </div>
    </div>
  );
}
