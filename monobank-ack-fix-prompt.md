# Промт для Claude Code — фікс ack у Monobank webhook-синхронізації

У проєкті є баг у синхронізації Monobank webhook-подій: транзакції інколи зникають і не потрапляють у додаток.

Причина: черга подій у Redis (`src/lib/monobank-webhook-store.ts`) працює за схемою peek-then-ack, але `ackWebhookEvents(secretId, count)` робить «сліпий» `lpop(count)` — видаляє N найстаріших елементів, не перевіряючи, чи це саме ті події, які клієнт щойно обробив. Якщо два поли накладаються (setInterval + visibilitychange, або два відкриті пристрої), обидва читають однаковий peek і обидва шлють ack. Якщо між цими двома ack Monobank запушив нову подію, другий, застарілий ack видаляє її з черги — вона зникає, так і не імпортувавшись.

Частину вже виправлено: в `src/lib/use-monobank-webhook-sync.ts` доданий `isPolling` ref, що серіалізує поли в межах одного таба. Лишається зробити ack ідемпотентним по id.

## Треба

1. **`src/lib/monobank-webhook-store.ts`** — змінити сигнатуру на `ackWebhookEvents(secretId: string, ids: string[]): Promise<void>`.
   Логіка: пройти чергу з початку і видалити лише **безперервний префікс** елементів, чий `transaction.id` є в переданому наборі; зупинитись на першому неспівпадінні.
   Реалізувати одним `redis.eval` (Lua), щоб read-then-pop був атомарним — інакше та сама race просто переїде на рівень Redis. Скрипт має сам порахувати довжину префікса і зробити `LPOP` рівно на неї.

2. **`src/app/api/finance/monobank/webhook-events/ack/route.ts`** — приймати `{ ids: string[] }` замість `{ count }`.
   Валідувати, що це масив рядків; при невалідному тілі — 400 `invalid_ids`. Порожній масив — просто `{ ok: true }` без звернення до Redis.

3. **`src/lib/use-monobank-webhook-sync.ts`** — слати `ids: data.events.map((e) => e.transaction.id)` замість `count`.

## Перевірка

Переконайся, що більше ніде в коді не залишилось викликів `ackWebhookEvents` зі старою сигнатурою, і що `tsc` та лінт проходять.
