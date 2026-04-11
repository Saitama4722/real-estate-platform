import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/layout/container";
import { siteOrigin } from "@/lib/articleSeo";
import { PageHeading } from "@/components/layout/page-heading";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Пользовательское соглашение — Centreal",
    description:
      "Условия использования сайта Centreal: информационный характер материалов, формы обратной связи и ограничение ответственности.",
    alternates: { canonical: `${siteOrigin()}/terms` },
  };
}

export default function TermsPage() {
  return (
    <div className="py-6 md:py-8">
      <Container>
        <Breadcrumbs
          items={[
            { label: "Главная", href: "/" },
            { label: "Пользовательское соглашение" },
          ]}
        />
        <PageHeading title="Пользовательское соглашение" />

        <div className="mt-8 max-w-4xl space-y-6 text-gray-700">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              1. Общие условия
            </h2>
            <p className="text-sm md:text-base leading-relaxed">
              Настоящее Пользовательское соглашение (далее — Соглашение) регулирует условия
              использования сайта Centreal (далее — Сайт). Используя Сайт, вы соглашаетесь
              с условиями настоящего Соглашения.
            </p>
            <p className="text-sm md:text-base leading-relaxed mt-2">
              Если вы не согласны с условиями Соглашения, пожалуйста, не используйте Сайт.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              2. Назначение Сайта
            </h2>
            <p className="text-sm md:text-base leading-relaxed">
              Сайт предоставляет информационные услуги в сфере недвижимости Краснодарского края.
              Сайт является платформой для размещения объявлений о продаже недвижимости
              и предоставления контактной информации для связи с риэлторами и владельцами объектов.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              3. Информационный характер
            </h2>
            <p className="text-sm md:text-base leading-relaxed">
              Вся информация на Сайте носит информационный характер и не является публичной офертой.
              Характеристики объектов недвижимости, цены, фотографии и другие данные могут
              изменяться без предварительного уведомления.
            </p>
            <p className="text-sm md:text-base leading-relaxed mt-2">
              Мы не гарантируем постоянную доступность всех объявлений и актуальность всей
              информации на Сайте. Для уточнения деталей рекомендуем связываться с указанными
              контактными лицами.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              4. Использование форм обратной связи
            </h2>
            <p className="text-sm md:text-base leading-relaxed">
              При использовании форм обратной связи на Сайте вы соглашаетесь предоставить
              достоверную информацию о себе. Отправляя форму, вы даёте согласие на обработку
              ваших персональных данных в соответствии с{" "}
              <Link href="/privacy" className="text-blue-600 hover:underline">
                Политикой обработки персональных данных
              </Link>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              5. Интеллектуальная собственность
            </h2>
            <p className="text-sm md:text-base leading-relaxed">
              Все материалы Сайта, включая тексты, изображения, графику, дизайн и программный код,
              защищены авторским правом и другими правами интеллектуальной собственности.
            </p>
            <p className="text-sm md:text-base leading-relaxed mt-2">
              Использование материалов Сайта без письменного разрешения правообладателя запрещено,
              за исключением случаев, предусмотренных законодательством Российской Федерации.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              6. Ограничение ответственности
            </h2>
            <p className="text-sm md:text-base leading-relaxed">
              Сайт и его владелец не несут ответственности за:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-sm md:text-base">
              <li>Неточность или неполноту информации об объектах недвижимости</li>
              <li>Действия третьих лиц (риэлторов, владельцев объектов)</li>
              <li>Временную недоступность Сайта или отдельных его функций</li>
              <li>Убытки, возникшие в результате использования или невозможности использования Сайта</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              7. Запрещённые действия
            </h2>
            <p className="text-sm md:text-base leading-relaxed">
              При использовании Сайта запрещается:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-sm md:text-base">
              <li>Размещать ложную, вводящую в заблуждение или незаконную информацию</li>
              <li>Нарушать права третьих лиц</li>
              <li>Использовать автоматизированные средства для сбора информации с Сайта</li>
              <li>Предпринимать действия, направленные на нарушение работы Сайта</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              8. Изменение условий
            </h2>
            <p className="text-sm md:text-base leading-relaxed">
              Мы оставляем за собой право изменять условия настоящего Соглашения в любое время.
              Актуальная версия Соглашения всегда доступна на данной странице.
            </p>
            <p className="text-sm md:text-base leading-relaxed mt-2">
              Продолжение использования Сайта после внесения изменений означает ваше согласие
              с новыми условиями.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              9. Применимое право
            </h2>
            <p className="text-sm md:text-base leading-relaxed">
              Настоящее Соглашение регулируется законодательством Российской Федерации.
              Все споры, возникающие в связи с использованием Сайта, подлежат разрешению
              в соответствии с законодательством Российской Федерации.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              10. Контактная информация
            </h2>
            <p className="text-sm md:text-base leading-relaxed">
              По вопросам, связанным с использованием Сайта, вы можете обратиться к нам
              через формы обратной связи на Сайте или по контактным данным, указанным
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
