"use client";

import { useState } from "react";
import Link from "next/link";
import { SmartphoneIcon } from "@/components/icons";

/** No .shortcut file to hand out — iOS Safari can't let a PWA register its
 *  own URL scheme, and there's no way to author/host an iCloud-shared
 *  Shortcuts file from here either. The only real path is Shortcuts' own
 *  "Get Contents of URL" action POSTing straight to /api/finance/apple-pay/
 *  receive, so this screen's job is generating the token that action needs
 *  and walking through building it by hand — a few taps in the Команди app,
 *  not a redirect to some slick one-tap installer. */
export default function ApplePaySetupPage() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedField, setCopiedField] = useState<"url" | "token" | null>(null);

  const receiveUrl = typeof window !== "undefined" ? `${window.location.origin}/api/finance/apple-pay/receive` : "";

  async function connect() {
    setLoading(true);
    try {
      const res = await fetch("/api/finance/apple-pay/setup", { method: "POST" });
      const data = (await res.json()) as { token: string };
      setToken(data.token);
    } finally {
      setLoading(false);
    }
  }

  async function copy(field: "url" | "token", value: string) {
    await navigator.clipboard.writeText(value);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1500);
  }

  return (
    <div>
      <Link href="/balance/settings" className="mb-2 flex items-center gap-2 pt-2 text-[12.5px] text-text-dim">
        <span className="flex h-7 w-7 items-center justify-center rounded-icon border border-border bg-surface">
          ‹
        </span>
        Налаштування
      </Link>
      <div className="mb-1 pt-2 font-heading text-lg font-semibold text-text">Швидка категоризація Apple Pay</div>
      <div className="mb-4 text-[11.5px] leading-relaxed text-text-faint">
        Одразу після оплати Apple Pay застосунок пришле пуш із пропозицією категорії — тапнути й готово.
        Потребує один раз вручну налаштувати автоматизацію в застосунку Команди (~2 хв).
      </div>

      {!token ? (
        <button
          onClick={connect}
          disabled={loading}
          className="card-raised mb-4 flex w-full items-center justify-center gap-2 rounded-card bg-surface py-3.5 text-[13px] font-bold text-sage disabled:opacity-50"
        >
          <SmartphoneIcon className="h-4 w-4" />
          {loading ? "Генерую..." : "Отримати токен"}
        </button>
      ) : (
        <>
          <div className="card-raised mb-4 rounded-card bg-surface p-4">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-text-faint">URL для дії &quot;Отримати вміст URL&quot;</div>
            <div className="mb-2 break-all rounded-input bg-surface-2 p-2.5 font-mono text-[11px] text-text">{receiveUrl}</div>
            <button onClick={() => copy("url", receiveUrl)} className="text-[11px] font-semibold text-sage">
              {copiedField === "url" ? "Скопійовано ✓" : "Копіювати URL"}
            </button>

            <div className="mb-1 mt-3.5 text-[10px] font-bold uppercase tracking-wide text-text-faint">Токен (для JSON-тіла)</div>
            <div className="mb-2 break-all rounded-input bg-surface-2 p-2.5 font-mono text-[11px] text-text">{token}</div>
            <button onClick={() => copy("token", token)} className="text-[11px] font-semibold text-sage">
              {copiedField === "token" ? "Скопійовано ✓" : "Копіювати токен"}
            </button>
          </div>

          <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-text-faint">Як налаштувати</div>
          <ol className="space-y-2.5">
            {[
              "Відкрий застосунок Команди → вкладка Автоматизація → + → Створити особисту автоматизацію.",
              "Обери тригер «Гаманець» (Wallet) → познач картку(и), за якими стежити.",
              "Вимкни «Запитувати перед запуском» — інакше кожна оплата питатиме підтвердження.",
              "Додай дію «Текст»: введи { \"token\": \" вставивши скопійований токен \", \"amount\": вставивши змінну «Сума транзакції» , \"merchant\": \" вставивши змінну «Мерчант транзакції» \" } — фігурні дужки й лапки вводяться вручну, змінні додаються через кнопку зі змінними над клавіатурою.",
              "Додай дію «Отримати вміст URL»: встав скопійований URL, метод POST, заголовок Content-Type: application/json, тіло запиту — вміст попередньої дії «Текст».",
              "Збережи. Після наступної оплати Apple Pay прийде пуш із пропозицією категорії.",
            ].map((step, i) => (
              <li key={i} className="card-raised flex gap-2.5 rounded-card-sm bg-surface p-3">
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-sage-soft text-[10px] font-bold text-sage">
                  {i + 1}
                </span>
                <span className="text-[12px] leading-relaxed text-text-dim">{step}</span>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
