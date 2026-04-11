import type { Metadata } from "next";
import { Container } from "@/components/layout/container";
import { siteOrigin } from "@/lib/articleSeo";
import { PageHeading } from "@/components/layout/page-heading";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Политика обработки персональных данных — Centreal",
    description:
      "Какие персональные данные собирает сайт Centreal, цели обработки, сроки хранения и права пользователей.",
    alternates: { canonical: `${siteOrigin()}/privacy` },
  };
}

export default function PrivacyPage() {
  return (
    <div className="py-6 md:py-8">
      <Container>
        <Breadcrumbs
          items={[
            { label: "Главная", href: "/" },
            { label: "Политика обработки персональных данных" },
          ]}
        />
        <PageHeading title="Политика обработки персональных данных" />

        <div className="mt-8 max-w-4xl space-y-6 text-gray-700">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              1. Общие положения
            </h2>
            <p className="text-sm md:text-base leading-relaxed">
              Настоящая Политика обработки персональных данных (далее — Политика) определяет порядок
              обработки персональных данных пользователей сайта Centreal (далее — Сайт).
              Оператором персональных данных является владелец Сайта.
            </p>
            <p className="text-sm md:text-base leading-relaxed mt-2">
              Используя Сайт и отправляя свои персональные данные через формы обратной связи,
              вы подтверждаете своё согласие с условиями настоящей Политики.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              2. Какие персональные данные мы собираем
            </h2>
            <p className="text-sm md:text-base leading-relaxed">
              При использовании форм обратной связи на Сайте могут быть собраны следующие данные:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-sm md:text-base">
              <li>Имя (или псевдоним)</li>
              <li>Номер телефона</li>
              <li>Текст сообщения или комментария</li>
              <li>Технические данные (IP-адрес, тип браузера, время обращения)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              3. Цели обработки персональных данных
            </h2>
            <p className="text-sm md:text-base leading-relaxed">
              Персональные данные обрабатываются в следующих целях:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-sm md:text-base">
              <li>Обработка заявок и обращений пользователей</li>
              <li>Связь с пользователями для консультации по объектам недвижимости</li>
              <li>Улучшение качества работы Сайта и предоставляемых услуг</li>
              <li>Выполнение обязательств перед пользователями</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              4. Правовые основания обработки
            </h2>
            <p className="text-sm md:text-base leading-relaxed">
              Обработка персональных данных осуществляется на основании:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-sm md:text-base">
              <li>Согласия субъекта персональных данных (при отправке формы с установленной галочкой согласия)</li>
              <li>Федерального закона от 27.07.2006 № 152-ФЗ «О персональных данных»</li>
              <li>Необходимости исполнения договора или предоставления информации по запросу пользователя</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              5. Хранение и защита данных
            </h2>
            <p className="text-sm md:text-base leading-relaxed">
              Персональные данные хранятся на защищённых серверах. Мы применяем организационные
              и технические меры для защиты данных от несанкционированного доступа, изменения,
              раскрытия или уничтожения.
            </p>
            <p className="text-sm md:text-base leading-relaxed mt-2">
              Данные хранятся в течение срока, необходимого для достижения целей обработки,
              либо до момента отзыва согласия пользователем.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              6. Права субъектов персональных данных
            </h2>
            <p className="text-sm md:text-base leading-relaxed">
              Вы имеете право:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-sm md:text-base">
              <li>Получать информацию о том, какие ваши персональные данные обрабатываются</li>
              <li>Требовать уточнения, блокирования или удаления ваших данных</li>
              <li>Отозвать согласие на обработку персональных данных</li>
              <li>Обжаловать действия оператора в уполномоченном органе по защите прав субъектов персональных данных</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              7. Передача данных третьим лицам
            </h2>
            <p className="text-sm md:text-base leading-relaxed">
              Мы не передаём ваши персональные данные третьим лицам, за исключением случаев,
              когда это необходимо для обработки вашего обращения (например, передача контактов
              риэлтору для связи с вами) или требуется законодательством Российской Федерации.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              8. Изменение Политики
            </h2>
            <p className="text-sm md:text-base leading-relaxed">
              Мы оставляем за собой право вносить изменения в настоящую Политику.
              Актуальная версия всегда доступна на данной странице. Рекомендуем периодически
              проверять содержание Политики для ознакомления с возможными изменениями.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              9. Контактная информация
            </h2>
            <p className="text-sm md:text-base leading-relaxed">
              По вопросам, связанным с обработкой персональных данных, вы можете обратиться
              к нам через формы обратной связи на Сайте или по контактным данным, указанным
              в разделе «Контакты».
            </p>
          </section>

          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              Дата последнего обновления: {new Date().toLocaleDateString("ru-RU")}
            </p>
          </div>
        </div>
      </Container>
    </div>
  );
}
