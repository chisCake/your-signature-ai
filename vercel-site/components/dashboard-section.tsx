export type DashboardSectionProps = {
  title: string;
  children: React.ReactNode;
};

export function DashboardSection({ title, children }: DashboardSectionProps) {
  return (
    <section className='w-full border border-foreground/10 rounded-lg sm:rounded-xl shadow-sm sm:shadow p-4 sm:p-6 flex flex-col items-stretch justify-center h-full'>
      <div className='mb-3 sm:mb-4 pb-2 border-b'>
        <h1 className='text-lg sm:text-xl lg:text-2xl font-bold'>{title}</h1>
      </div>
      <div className='w-full flex flex-col h-full justify-center gap-3 sm:gap-4'>
        {children}
      </div>
    </section>
  );
}
