import { Mail, Send } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Пользовательское соглашение | Your Sign AI',
  description: 'Пользовательское соглашение сервиса Your Sign AI',
};

export default function TermsPage() {
  return (
    <div className='space-y-6'>
      <h1 className='text-3xl font-bold'>Пользовательское соглашение</h1>
      <p className='text-muted-foreground'>
        Последнее обновление: {new Date().toLocaleDateString('ru-RU')}
      </p>

      <section className='space-y-4'>
        <h2 className='text-2xl font-semibold'>1. Введение</h2>
        <p>
          Добро пожаловать в <strong>Your Sign AI</strong>! Это сервис для
          анализа подписей с помощью искусственного интеллекта.
        </p>
        <p>
          Используя наш сервис, вы соглашаетесь с условиями, описанными ниже.
          Если вы не согласны — тогда просто не используйте сервис.
        </p>
      </section>

      <section className='space-y-4'>
        <h2 className='text-2xl font-semibold'>2. Что это вообще такое?</h2>
        <p>
          <strong>Your Sign AI</strong> — это платформа, где вы можете:
        </p>
        <ul className='list-disc list-inside space-y-2 ml-4'>
          <li>Попробовать подделать чужую подпись (это для исследований)</li>
          <li>
            Сохранить свою настоящую подпись, если вы авторизованы (анонимы
            могут только подделывать)
          </li>
          <li>
            Получить оценку качества вашей подделки от нашего ИИ (он довольно
            корявый, но более-менее рабочий)
          </li>
        </ul>
        <p>
          Все это делается в образовательных и исследовательских целях. Мы не
          учим вас подделывать документы, мы просто изучаем, как работает
          распознавание подписей.
        </p>
      </section>

      <section className='space-y-4'>
        <h2 className='text-2xl font-semibold'>3. Возрастные ограничения</h2>
        <p>
          Наш сервис предназначен для пользователей старше{' '}
          <strong>12 лет</strong>.
        </p>
      </section>

      <section className='space-y-4'>
        <h2 className='text-2xl font-semibold'>
          4. Что можно и что нельзя делать
        </h2>
        <h3 className='text-xl font-medium'>Можно:</h3>
        <ul className='list-disc list-inside space-y-2 ml-4'>
          <li>
            Использовать сервис по назначению (подделывать подписи для теста)
          </li>
          <li>Сохранять свои настоящие подписи, если вы авторизованы</li>
          <li>
            Запрещать использование вашей подписи как примера для подделки (есть
            такая настройка в личном кабинете)
          </li>
          <li>
            Веселиться и экспериментировать (в разумных пределах, конечно)
          </li>
        </ul>

        <h3 className='text-xl font-medium mt-4'>Нельзя:</h3>
        <ul className='list-disc list-inside space-y-2 ml-4'>
          <li>
            Использовать подделки для реальных документов (это незаконно, и мы
            не несем ответственности)
          </li>
          <li>Пытаться взломать сервис или причинить ему вред ()</li>
          <li>Использовать сервис для любых незаконных целей</li>
          <li>
            Жаловаться, что ИИ слишком плохо/строго оценивает ваши подделки
          </li>
        </ul>
      </section>

      <section className='space-y-4'>
        <h2 className='text-2xl font-semibold'>
          5. Особенности работы с подписями
        </h2>
        <p>Вот как у нас все устроено (мы старались сделать это понятным):</p>
        <ul className='list-disc list-inside space-y-2 ml-4'>
          <li>
            <strong>Анонимные пользователи</strong> могут подделывать чужие
            подписи, и эти подделки сохраняются. Но сохранить свою собственную
            подпись они не могут — для этого нужна авторизация.
          </li>
          <li>
            <strong>Авторизованные пользователи</strong> могут сохранять свои
            настоящие подписи. Все ваши подписи автоматически участвуют в
            обучении нейросети (это помогает ей становиться умнее).
          </li>
          <li>
            Вы можете запретить использование вашей подписи как примера для
            подделки другими пользователями. Это настройка в личном кабинете. Но
            даже если вы запретите, ваша подпись все равно будет участвовать в
            обучении модели (иначе как она научится распознавать подделки?).
          </li>
        </ul>
      </section>

      <section className='space-y-4'>
        <h2 className='text-2xl font-semibold'>6. Платные функции</h2>
        <p>
          Их нет. Сервис полностью бесплатный. Если в будущем мы решим что-то
          монетизировать, мы обязательно об этом сообщим (и вы сможете решить,
          оставаться или нет).
        </p>
      </section>

      <section className='space-y-4'>
        <h2 className='text-2xl font-semibold'>
          7. Интеллектуальная собственность
        </h2>
        <p>
          Все права на сервис, код, дизайн и прочее принадлежат нам. Ваши
          подписи — это ваши подписи, но загружая их, вы даете нам право
          использовать их для обучения модели и предоставления сервиса.
        </p>
      </section>

      <section className='space-y-4'>
        <h2 className='text-2xl font-semibold'>
          8. Ограничение ответственности
        </h2>
        <p>
          Мы предоставляем сервис &quot;как есть&quot;. Мы стараемся сделать его
          максимально качественным, но не гарантируем, что он всегда будет
          работать идеально (баги случаются).
        </p>
        <p>Мы не несем ответственности за:</p>
        <ul className='list-disc list-inside space-y-2 ml-4'>
          <li>
            Любой ущерб, который может возникнуть при использовании сервиса
          </li>
          <li>
            Неправильные результаты анализа (ИИ тоже может ошибаться, он не
            идеален)
          </li>
          <li>Использование подделок во зло</li>
          <li>
            Ваше разочарование, если ваша подделка получила низкую оценку
            (попробуйте еще раз!)
          </li>
        </ul>
      </section>

      <section className='space-y-4'>
        <h2 className='text-2xl font-semibold'>9. Изменение условий</h2>
        <p>
          Мы можем в любой момент изменить это соглашение. Мы постараемся
          уведомить вас об изменениях, но не гарантируем, что вы это заметите.
          Поэтому периодически заглядывайте сюда (или не заглядывайте, если вам
          все равно).
        </p>
      </section>

      <section className='space-y-4'>
        <h2 className='text-2xl font-semibold'>10. Контакты</h2>
        <p>
          Если у вас есть вопросы, предложения или вы просто хотите
          поздороваться, можете связаться с нами:
        </p>
        <ul className='list-none space-y-2 ml-4'>
          <li className='flex items-center gap-2'>
            <Mail /> Email:{' '}
            <a
              href='mailto:kirilloleshkevich7@gmail.com'
              className='text-primary hover:underline'
            >
              kirilloleshkevich7@gmail.com
            </a>
          </li>
          <li className='flex items-center gap-2'>
            <Send /> Telegram:{' '}
            <a
              href='https://t.me/chiscake'
              target='_blank'
              rel='noopener noreferrer'
              className='text-primary hover:underline'
            >
              @chiscake
            </a>
          </li>
        </ul>
      </section>

      <section className='space-y-4 mt-8 p-6 bg-muted/50 rounded-lg border border-border'>
        <h2 className='text-2xl font-semibold'>Важное примечание</h2>
        <p className='text-sm text-muted-foreground italic'>
          Автор данного проекта никакой ответственности не несет, данное
          Пользовательское соглашение было сгенерировано с помощью
          Искусственного Интеллекта (мной) — Auto (AI Assistant от Cursor).
        </p>
        <p className='mt-4'>
          С уважением,
          <br />
          <strong>Команда (1 человек + ИИ) Your Sign AI</strong>
        </p>
      </section>
    </div>
  );
}
