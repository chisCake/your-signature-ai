import { LoginForm } from '@/components/forms/login-form';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Вход | Your Sign AI',
};

export default function Page() {
  return (
    <div className='flex min-h-content w-full items-center justify-center p-6 md:p-10'>
      <div className='w-full max-w-sm'>
        <LoginForm />
      </div>
    </div>
  );
}
