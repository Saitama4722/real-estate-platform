# Centreal — развёртывание на сервере Beget

Сервер: Beget VPS, Ubuntu 24.04, 2 vCPU / 4 ГБ / 40 ГБ NVMe, Docker 29, Compose v5,
IP `217.114.1.193`. Домена пока нет — сайт работает по IP, переход на `centreal.ru`
с HTTPS делается правкой настроек (раздел «Переход на домен»).

> ⛔ Docker запускается **только на сервере**. На рабочих компьютерах с Windows
> Docker не используется — ни сборка, ни проверки.

## Что запускается

| Сервис | Что делает | Наружу |
| --- | --- | --- |
| `caddy` | принимает все запросы, раздаёт их сервисам, позже — HTTPS | порты 80 и 443 |
| `frontend` | сайт (Next.js) | нет |
| `backend` | API и админка Django (gunicorn, 3 процесса) | нет |
| `celery` | фоновые задачи: фото, уведомления в Telegram | нет |
| `celery-beat` | задачи по расписанию (очистка токенов в 04:00) | нет |
| `db` | PostgreSQL 18 | **нет** |
| `redis` | очередь задач | **нет** |

Маршруты Caddy: `/api/…`, `/admin/…`, `/static/…` → Django; `/media/…` → файлы
(только при `MEDIA_STORAGE_BACKEND=local`); всё остальное → сайт.

---

## 1. Подготовка сервера (один раз)

Подключиться: `ssh root@217.114.1.193`

Файрвол — открыть только SSH и веб:

```bash
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw enable
ufw status
```

> База и Redis не публикуют порты вообще, поэтому из интернета недоступны даже
> без файрвола. Порты наружу открывает только `caddy`.

## 2. Первая установка

```bash
cd /opt
git clone -b design-system-audit <адрес-репозитория> centreal
cd /opt/centreal
mkdir -p deploy/backups
cp deploy/.env.prod.example deploy/.env.prod
nano deploy/.env.prod
```

В `deploy/.env.prod` заполнить пустые значения (подсказки — в комментариях файла).
Секретный ключ и пароль базы сгенерировать так:

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(50))"   # DJANGO_SECRET_KEY
python3 -c "import secrets; print(secrets.token_hex(24))"       # POSTGRES_PASSWORD
```

> ⚠ Все переменные Django — с префиксом `DJANGO_` (`DJANGO_SECRET_KEY`, не
> `SECRET_KEY`). Без префикса их никто не читает.

Чтобы не писать длинную команду каждый раз, задать сокращение (действует до
выхода из SSH; можно добавить в `~/.bashrc`):

```bash
alias dc='docker compose -f /opt/centreal/docker-compose.prod.yml --env-file /opt/centreal/deploy/.env.prod'
```

Дальше выбрать **один** из вариантов.

### Вариант А — перенести данные с основного компьютера (рекомендуется)

Все данные (пользователи, собственники, объект PID000001) есть только в базе
основного компьютера. Переносятся файлом `pg_dump`:

1. На основном компьютере (сайт остановлен) сделать дамп — см. CLAUDE.md, раздел
   «Each machine has its OWN PostgreSQL».
2. Скопировать его на сервер:
   ```bash
   scp real_estate_db.dump root@217.114.1.193:/opt/centreal/deploy/backups/
   ```
3. На сервере запустить только базу и восстановить дамп:
   ```bash
   dc up -d db
   dc exec -T db pg_restore -U postgres -d real_estate_db --clean --if-exists --no-owner /backups/real_estate_db.dump
   ```
   (`-U` и `-d` — значения `POSTGRES_USER` и `POSTGRES_DB` из `.env.prod`.)
4. Запустить всё:
   ```bash
   dc up -d --build
   ```
   `backend` при старте сам применит новые миграции. Администратор создаваться
   не будет — в восстановленной базе он уже есть.
5. **⛔ Сразу после восстановления — сменить пароли всех суперпользователей.**
   В базе с рабочего компьютера есть учётки для локальной разработки с
   известными паролями; на публичном сервере это открытая дверь в админку.
   Посмотреть, кто есть кто:
   ```bash
   dc exec backend python manage.py shell -c "from users.models import User; [print(u.pk, u.email, u.role, u.is_active) for u in User.objects.filter(is_superuser=True)]"
   ```
   Для каждой нужной учётки задать новый пароль:
   ```bash
   dc exec backend python manage.py changepassword <email>
   ```
   Учётки только для локальной разработки — отключить (не удалять):
   ```bash
   dc exec backend python manage.py shell -c "from users.models import User; User.objects.filter(email='<email>').update(is_active=False)"
   ```

> ⛔ **Никогда не восстанавливать дамп на сервере, не выполнив шаг 5.** Это
> касается любого восстановления, не только первого.

### Вариант Б — пустая база

В `.env.prod` заполнить `INITIAL_ADMIN_EMAIL` и `INITIAL_ADMIN_PASSWORD`
(пароль — не из одних цифр, не короче 8 символов), затем:

```bash
dc up -d --build
```

После первого входа в админку **удалить** строку с паролем из `.env.prod` и
выполнить `dc up -d backend`.

### Проверка

Первая сборка идёт 5–15 минут. Затем:

```bash
dc ps                      # все сервисы running, backend — healthy
curl -I http://217.114.1.193/
curl -I http://217.114.1.193/admin/login/
```

Открыть в браузере `http://217.114.1.193`.

> Если главная сразу после первой сборки показывает пустые блоки — подождать
> 1–2 минуты и обновить. Во время сборки образа сайт не может обратиться к API, поэтому
> страницы, собранные заранее, обновляются уже на работающем сервере.

## 3. Логи

```bash
dc logs -f --tail=100              # все сервисы
dc logs -f --tail=100 backend      # один сервис: backend / frontend / celery / celery-beat / caddy / db
```

В первых строках `backend` Django пишет, к какой базе подключился и какое
хранилище фото использует (`[Centreal] DB …`, `[Centreal] MEDIA …`) — их стоит
проверить после каждого изменения `.env.prod`.

## 4. Обновление сайта

```bash
cd /opt/centreal
git pull
dc up -d --build
```

Пересобираются только изменившиеся образы; миграции применяются при старте `backend`.

## 5. Резервная копия базы с сервера

```bash
dc exec -T db pg_dump -U postgres -Fc real_estate_db > deploy/backups/real_estate_db_$(date +%F).dump
```

Папка `deploy/backups/` не попадает в git — в дампах пароли и контакты клиентов.

## 6. Переход на домен centreal.ru

1. У регистратора создать A-запись `centreal.ru` → `217.114.1.193` и для `www`
   A-запись или CNAME на `centreal.ru`. Дождаться, пока `dig +short centreal.ru @8.8.8.8`
   покажет этот IP. AAAA-записей быть не должно (иначе Let's Encrypt пойдёт по IPv6).
2. В `deploy/.env.prod` изменить (без кавычек):
   ```
   SITE_ADDRESS=centreal.ru, www.centreal.ru
   CANONICAL_HOST=centreal.ru
   PUBLIC_IP=217.114.1.193
   DJANGO_ALLOWED_HOSTS=centreal.ru,www.centreal.ru,217.114.1.193,backend,localhost
   CSRF_TRUSTED_ORIGINS=https://centreal.ru,https://www.centreal.ru
   CORS_ALLOWED_ORIGINS=https://centreal.ru,https://www.centreal.ru
   SITE_URL=https://centreal.ru
   NEXT_PUBLIC_SITE_URL=https://centreal.ru
   NEXT_PUBLIC_API_URL=https://centreal.ru/api
   ```
3. Пересобрать сайт (адреса `NEXT_PUBLIC_*` вшиваются при сборке) и перезапустить остальное:
   ```bash
   dc up -d --build frontend
   dc up -d
   ```
4. Caddy сам получит сертификаты Let's Encrypt (это видно в `dc logs caddy`) и
   начнёт перенаправлять HTTP на HTTPS. Дальше:
   - `www.centreal.ru` → 301 на `https://centreal.ru` (тот же путь);
   - `http://217.114.1.193` → 301 на `https://centreal.ru`;
   - cookie сессии и CSRF становятся `Secure` сами, потому что `SITE_URL` начинается
     с `https://` (`backend/config/settings.py`).
5. HSTS пока не включён. Включать, только когда HTTPS поработает без проблем.

Вернуться к режиму «только IP»: `SITE_ADDRESS=:80`, `CANONICAL_HOST=` и `PUBLIC_IP=`
пустые, адреса снова `http://217.114.1.193` (как в `.env.prod.example`), затем шаг 3.

## 7. Полезное

```bash
dc restart backend                                  # перезапустить сервис
dc exec backend python manage.py createsuperuser    # создать администратора вручную
dc exec backend python manage.py check_media_storage   # проверить доступ к R2 (ничего не загружает)
dc down                                             # остановить всё (данные сохраняются)
```

> ⛔ Никогда не выполнять `dc down -v` — флаг `-v` удаляет тома, то есть **базу данных**.

## 8. Место на диске и автоматическая очистка

База (`centreal_pgdata`) и медиа (`centreal_media`) лежат в **томах Docker**.

> ⛔ Никогда не выполнять `docker system prune -a`, `docker volume prune`,
> `docker volume rm` и `dc down -v`: они удаляют тома, то есть базу и файлы.
> Удалять можно только то, чем ничего не пользуется: висячие образы и старый
> кэш сборки.

Ручная очистка (безопасная):

```bash
df -h / && docker system df                       # что занимает место
docker image prune -f                             # висячие образы старых сборок
docker builder prune -f --filter until=24h        # кэш сборки старше суток
journalctl --vacuum-size=200M
apt-get clean
```

Автоматика (уже установлена 2026-10-18; повторить на новом сервере):

```bash
cd /opt/centreal
install -m 755 deploy/docker-hygiene.sh /usr/local/sbin/centreal-docker-hygiene.sh
install -m 644 deploy/centreal-docker-hygiene.cron /etc/cron.d/centreal-docker-hygiene
mkdir -p /etc/systemd/journald.conf.d
install -m 644 deploy/journald-centreal.conf /etc/systemd/journald.conf.d/99-centreal.conf
systemctl restart systemd-journald
```

- **Каждое воскресенье в 05:00 по Москве** (02:00 UTC) скрипт удаляет висячие
  образы и кэш сборки старше 7 дней. Журнал: `/var/log/centreal-docker-hygiene.log`
  (последние 200 строк).
- **Логи контейнеров** ограничены в `docker-compose.prod.yml` (`x-logging`):
  3 файла по 10 МБ на контейнер. Изменение только `logging` применяется
  командой `dc up -d`, пересборка не нужна.
- **Журнал systemd** ограничен 200 МБ.

## 9. Резервные копии базы (автоматически, каждый день)

**Что делается:** каждый день в **03:30 по Москве** (00:30 UTC) скрипт
`/usr/local/sbin/centreal-db-backup.sh` (исходник: `deploy/db-backup.sh`)
снимает `pg_dump -Fc` базы `real_estate_db` в
`/root/backups/real_estate_db-ГГГГ-ММ-ДД.dump` (папка 700, файлы 600),
проверяет его `pg_restore --list` и хранит **14 последних дневных + 8 последних
воскресных** копий. Удаляются только файлы с именем ровно такого вида. Журнал:
`/var/log/centreal-db-backup.log`. Если копия не создалась или не прошла
проверку, в Telegram-группу (бот из `deploy/.env.prod`) уходит короткое
сообщение.

Установка (уже сделано 2026-10-18; повторить на новом сервере):

```bash
cd /opt/centreal
install -m 700 deploy/db-backup.sh /usr/local/sbin/centreal-db-backup.sh
install -m 644 deploy/centreal-db-backup.cron /etc/cron.d/centreal-db-backup
/usr/local/sbin/centreal-db-backup.sh && tail -3 /var/log/centreal-db-backup.log
```

**Проверка копии (безопасно, раз в месяц):** восстанавливает свежую копию во
**временную** базу `real_estate_db_restoretest`, сравнивает число строк
ключевых таблиц с рабочей базой и удаляет только временную:

```bash
bash /opt/centreal/deploy/db-restore-test.sh                 # самая свежая копия
bash /opt/centreal/deploy/db-restore-test.sh /root/backups/real_estate_db-2026-10-18.dump
```

**Восстановление рабочей базы из копии (авария).** ⚠ Заменяет ВСЕ данные в
`real_estate_db` состоянием на момент копии. Сначала проверьте копию командой
выше.

```bash
cd /opt/centreal
dc stop backend celery celery-beat frontend                 # никто не пишет в базу
/usr/local/sbin/centreal-db-backup.sh                        # копия ТЕКУЩЕГО состояния на всякий случай
dc exec -T db pg_restore -U postgres -d real_estate_db --clean --if-exists --no-owner \
  < /root/backups/real_estate_db-ГГГГ-ММ-ДД.dump
dc up -d                                                     # миграции применятся при старте backend
```

Проверить после: `curl -sI https://centreal.ru/` → 200, число заявок/объектов
в кабинете. ⛔ После восстановления копии с другого компьютера (дампа рабочего
стола) — сразу смените пароли суперадминов (см. «Вариант А»).

> Копии лежат на том же сервере, что и база: если пропадёт сервер, пропадут и
> они. Регулярно забирайте копию куда-нибудь ещё (см. CLAUDE.md → «Резервные
> копии»).
