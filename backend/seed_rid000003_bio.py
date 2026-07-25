"""
One-off local-dev seed: set the public "selling" bio for realtor RID000003.

NOT a migration — this is dev content only. Re-run after a DB reset with:

    backend/.venv/Scripts/python.exe manage.py shell < seed_rid000003_bio.py

(run from the `backend/` directory). Idempotent: uses get_or_create and
overwrites short_bio / is_public each time.
"""
from users.models import RealtorProfile, User

BIO = (
    "Помогаю подобрать недвижимость в Краснодаре и Геленджике — квартиру, дом, "
    "участок или коммерческое помещение. Работаю с разными задачами: кто-то ищет "
    "первую квартиру, кто-то присматривает дом за городом, кто-то планирует "
    "вложить деньги в объект у моря.\n\n"
    "Краснодарский край — рынок неоднородный: в одном районе цены растут, в "
    "соседнем стоят на месте, у новостроек и вторички разная логика. Разбираюсь, "
    "что происходит в конкретном районе и какой вариант реально соответствует "
    "бюджету и целям, а не просто показываю подборку из каталога.\n\n"
    "Сопровождаю сделку от первого звонка до подписания документов: проверка "
    "объекта, переговоры, оформление — всё под контролем, без сюрпризов на "
    "финальном этапе. Если нужно быстро — ищу оперативно, если время есть — "
    "подберём вариант без спешки и компромиссов.\n\n"
    "Пишите или звоните — расскажу, что сейчас интересного есть в Краснодаре и "
    "Геленджике под ваш запрос, и подберём объекты, которые действительно стоит "
    "смотреть."
)

user = User.objects.filter(crm_id__iexact="RID000003").first()
if user is None:
    print("RID000003 not found — nothing seeded.")
else:
    profile, created = RealtorProfile.objects.get_or_create(user=user)
    profile.short_bio = BIO
    profile.is_public = True
    profile.save()
    print(
        f"Seeded RID000003 bio (profile {'created' if created else 'updated'}); "
        f"is_public={profile.is_public}, short_bio length={len(profile.short_bio)}."
    )
