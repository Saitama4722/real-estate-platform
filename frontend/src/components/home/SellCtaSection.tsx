import { Container } from "@/components/layout/container";
import { ButtonLink } from "@/components/ui/button-link";

/**
 * Homepage call-to-action inviting property owners to submit their property for
 * sale. Links to the public /sell form (owner submission → CRM review).
 */
export function SellCtaSection() {
  return (
    <section className="ctr-sec">
      <Container>
        {/* One of the two or three dark bands the design allows per page.
            GRADIENT, not a flat fill — the kit's `.band` is
            linear-gradient(120deg, blue-600 → blue-800). Written as an arbitrary
            value so the two brand stops stay named tokens. */}
        <div className="flex flex-col items-start justify-between gap-[18px] rounded-2xl bg-[linear-gradient(120deg,var(--color-blue-600),var(--color-blue-800))] px-[22px] py-[26px] text-white md:flex-row md:items-center md:gap-10 md:px-12 md:py-11">
          <div>
            {/* 22/28 mobile → h2 (28/36, 700) desktop, per the two kits. */}
            <h2 className="text-[22px] leading-7 font-bold md:text-h2">
              Хотите продать недвижимость?
            </h2>
            <p className="mt-2 max-w-[560px] text-[13px] leading-[19px] text-white/80 md:text-small">
              Оставьте заявку — наш риэлтор оценит объект, подготовит объявление и
              поможет продать быстрее и выгоднее. Ваш телефон видят только сотрудники
              агентства.
            </p>
          </div>
          {/* Was another hand-rolled copy of the primary button, in white-on-blue.
              `inverse` is exactly that variant, so it can no longer drift. */}
          <ButtonLink href="/sell" variant="inverse" size="lg" className="shrink-0">
            Продать недвижимость
          </ButtonLink>
        </div>
      </Container>
    </section>
  );
}
