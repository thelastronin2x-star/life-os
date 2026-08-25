"use client";

import { useCalendarStore } from "./calendar-store";
import { useJournalStore } from "./journal-store";
import { useFinanceStore } from "./finance-store";
import { usePropAccountsStore } from "./prop-accounts-store";
import { usePersonalTradingAccountsStore } from "./personal-trading-accounts-store";
import { useMonobankLinkStore } from "./monobank-store";
import { useAssistantStore } from "./assistant-store";
import { useMerchantRulesStore } from "./merchant-rules-store";

/** Clears all locally-stored personal data (trades, transactions, calendar
 *  events, prop accounts, assistant history/reports) while leaving app
 *  configuration intact (profile, theme, nickname, avatar, reference
 *  libraries like journal tags/instruments/sessions). */
export function deleteAllUserData(): void {
  useCalendarStore.setState({ items: [] });
  useJournalStore.setState({ trades: [] });
  useFinanceStore.setState({ accounts: [], goals: [], budgetCategories: [], transactions: [] });
  usePropAccountsStore.setState({ accounts: [] });
  usePersonalTradingAccountsStore.setState({ accounts: [] });
  useMonobankLinkStore.setState({ links: [] });
  useMerchantRulesStore.setState({ rules: {} });
  useAssistantStore.setState({ messages: [], reports: [], contextInsights: {} });
}
