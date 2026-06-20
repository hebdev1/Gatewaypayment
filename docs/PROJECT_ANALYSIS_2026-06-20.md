# HaitiPay — analyse de cohérence du projet

**Période couverte** : 2026-06-15 → 2026-06-20 (5 jours)
**Auteur** : Claude (assistant) — analyse rétrospective
**État** : MVP livré + brainstorming Fee Collection en cours

---

## 1. Résumé exécutif

**Ce qui existe en prod** : un MVP de payment gateway pour Haïti, déployé sur
Vercel + Supabase, avec auth marchand, dashboard, admin panel séparé, paiements
via MonCash sandbox-ready, refunds, webhooks signés, payment links, factures,
QR codes, multi-devises, KYC avec upload Storage, 2FA TOTP, emails
transactionnels, rate limiting, status page, SDK Node.js, OpenAPI, Postman.

**Ce qui reste en brainstorming** : système de collecte des 2.5% de fees
gateway (Modèle C — pull par transaction depuis le wallet marchand via
MonCash `/v1/Transfert`).

**Cohérence globale** : **bonne** — patterns réutilisés systématiquement
(outbox + cron + retry, AES-GCM, RLS via helpers, état pending → processing
→ succeeded/failed). **Un pivot architectural majeur** documenté à signaler
(Payouts → Fee Collection au jour 5).

**Production-ready** : ~85 %. Bloque sur des actions manuelles (secrets
Resend, credentials MonCash, consentement marchand fee collection) et un
sprint NatCash non démarré.

---

## 2. Inventaire technique (au 2026-06-20)

### Base de données — 23 tables

| Domaine | Tables |
|---|---|
| Tenancy & auth | `merchants`, `merchant_members`, `app_admins`, `admin_audit_log` |
| API access | `api_keys`, `api_key_secrets`, `rate_limit_buckets` |
| Provider creds | `payment_provider_accounts`, `payment_provider_credentials` |
| Paiements | `payments`, `payment_events`, `refunds` |
| Webhooks | `webhook_endpoints`, `webhook_endpoint_secrets`, `webhook_deliveries` |
| Self-service | `payment_links`, `invoices`, `invoice_items`, `currency_rates` |
| KYC | `kyc_submissions` + bucket Storage `kyc-documents` |
| Email | `email_outbox` |
| Fee collection (jour 5) | `fee_collections`, `merchant_debts` |

**Toutes les tables ont RLS activée.** 100 % des secrets sont hashés
(api_keys) ou chiffrés AES-GCM (provider creds, webhook secrets).

### Edge functions — 7

| Function | Version | Rôle |
|---|---|---|
| `create-payment` | v9 | Bearer auth + rate limit + adapter MonCash CreatePayment |
| `verify-payment` | v8 | Internal-or-bearer + adapter MonCash RetrievePayment |
| `create-refund` | v3 | Bearer + insertion refund + appel adapter refund (si dispo) |
| `provider-webhook` | v7 | Réception MonCash callback (token validation + idempotence 5 min) |
| `dispatch-webhooks` | v7 | Cron-triggered : envoi outbound webhooks signés HMAC |
| `send-emails` | v1 | Cron-triggered : envoi via Resend depuis email_outbox |
| `fetch-rates` | v1 | Cron-triggered : refresh currency_rates depuis exchangerate.host |

### Cron jobs — 4 actifs

| Job | Fréquence | Cible |
|---|---|---|
| `dispatch-webhooks-tick` | toutes les minutes | `/dispatch-webhooks` |
| `send-emails-tick` | toutes les minutes | `/send-emails` |
| `rate-limit-cleanup` | hourly à :17 | DELETE buckets > 24 h |
| `fetch-rates-tick` | daily à 06:07 | `/fetch-rates` |

### Migrations — 16 appliquées

```
20260616025928  initial_payment_gateway              (J1)
20260616213523  fix_merchant_rls_recursion           (J1)
20260617042459  security_hardening_and_fk_indexes    (J2)
20260617042546  enable_pg_cron_and_pg_net            (J2)
20260617042621  webhook_dispatcher_cron_job          (J2)
20260617043425  refunds_schema                       (J2)
20260617044357  provider_inbound_webhook_token       (J2)
20260617044747  kyc_submissions                      (J2)
20260617044919  harden_new_security_definer_funcs    (J2)
20260617161848  app_admins_and_admin_policies        (J2)
20260619023955  sprint_1_1_rate_limit_email_outbox   (J4)
20260619025212  multi_currency_links_invoices        (J4)
20260619211728  kyc_documents_bucket                 (J4)
20260619211932  customer_email_receipt               (J4)
20260619212855  i18n_and_api_key_allowlist           (J4)
20260620042248  fee_collection_system                (J5)
```

### Codebase

- **~129 fichiers** source non-node_modules
- **114 TypeScript/TSX**
- **14 fichiers SQL** dans `supabase/migrations/`
- **21 commits git** (initial + 13 features + 5 fixes/redesigns + 2 docs)
- **3 langues** dans le dictionnaire i18n (EN / FR / HT)
- **SDK Node.js** dans `packages/node-sdk/` prêt à publier

---

## 3. Timeline jour par jour

| Jour | Date | Livré |
|---|---|---|
| J0 | 06-15 | Initial commit (avant cette session) |
| J1 | 06-16 | Reprise du MVP existant + analyse + corrections RLS |
| J2 | 06-17 | Audit complet + admin panel + refunds + webhooks scheduler + sécurité hardening + admin policies + KYC + dashboard redesign |
| J3 | 06-18 | Sprint 1.1 (rate limit, email outbox, 2FA, status, Sentry deferred) + Sprint 1.2 (payment links, QR, invoices, multi-currency) + redesign Finance SaaS + roadmap |
| J4 | 06-19 | Reste Sprint 1.2 (CSV export, KYC upload, customer receipts) + i18n + SDK + OpenAPI + Postman + webhook simulator |
| J5 | 06-20 | Brainstorming Payouts → pivot Fee Collection (Modèle C) + migration data model |

**Rythme** : ~3 features + 1 migration par jour. Tenable mais intense.

---

## 4. Cohérence — points forts

### 4.1 Patterns architecturaux réutilisés systématiquement

| Pattern | Utilisations |
|---|---|
| **Outbox + cron + retry** (pending → processing → succeeded/failed) | webhook_deliveries, email_outbox, fee_collections |
| **Chiffrement AES-GCM avec nonce** | payment_provider_credentials, webhook_endpoint_secrets, plus tard fee collection (en option) |
| **Helpers RLS** (`is_merchant_member`, `is_app_admin`) | utilisés dans 11+ policies |
| **Cron via Vault** (secret stocké, plpgsql wrapper, pg_net) | 4 jobs identiques en forme |
| **Audit trail** | admin_audit_log pour actions admin, payment_events pour cycle de vie |
| **State machine enum** | payment_status, refund_status, webhook_delivery_status, fee_collection_status |
| **Bearer + hash SHA-256** | api_keys + api_key_secrets (séparation des concerns) |

### 4.2 Séparation des rôles cohérente

- **Admin et merchant** strictement isolés (redirect mutuel, sidebars différentes,
  bootstrap admin via SQL)
- **Anon / authenticated / service_role** explicites dans chaque GRANT/REVOKE
- **`SECURITY DEFINER`** révoqué de PUBLIC sur 11+ fonctions (advisor green)

### 4.3 Évolutions UI/UX cohérentes

- Design system tokens-based (60+ variables CSS) appliqué uniformément
- Sidebar avec section labels + active-state (composant client `NavLink`)
  réutilisé entre `/dashboard` et `/admin`
- Status pills, mode pills, metric cards — un seul vocabulaire visuel

---

## 5. Pivots & incohérences à signaler

### 5.1 ⚠️ Pivot architectural Payouts → Fee Collection (jour 5)

**Le plus important.** Au jour 5, on a brainstormé un système de "Payouts"
(HaitiPay paie les marchands via MonCash B2C). On a discuté data model
(`payouts`, `payout_destinations`), state machine, cron flow. **Puis l'user
a posé la vraie question** : "comment moi en tant que CEO je touche mes 2.5 % ?"

Cette question a révélé que le modèle implicite jusque-là (marchand encaisse,
HaitiPay accumule des fees jamais collectées) était cassé. L'user a choisi
**Modèle C** (collecte forcée par transaction, sens inverse : marchand →
HaitiPay).

**Conséquences** :
- Le brainstorming Payouts est devenu obsolète à mi-chemin
- 4 tâches supprimées (`#36-#39`)
- Le data model Payouts n'a **jamais été appliqué en DB**
- À la place, `fee_collections` + `merchant_debts` ont été appliqués
- Le ROADMAP.md original mentionne encore "Payouts" comme Phase 2 — **à mettre à jour**

**Verdict** : pivot normal et sain (la bonne question a été posée), bien
documenté dans l'historique des tâches, mais le ROADMAP.md n'a pas suivi.

### 5.2 Sprint 2.1 (NatCash) jamais démarré

Le ROADMAP.md disait "NatCash adapter" comme priorité de Sprint 2.1. L'user
a choisi de sauter directement à i18n + Sprint 2.2 (SDK + DX). NatCash reste
**non implémenté**. Cohérent (choix utilisateur explicite) mais ROADMAP à
synchroniser.

### 5.3 i18n partiel

Infrastructure complète + 3 pages traduites (login, register, checkout).
**6 autres pages publiques** restent en EN hardcodé : `/forgot-password`,
`/reset-password`, `/login/mfa`, `/pay/[slug]`, `/i/[slug]`,
`/checkout/[id]/return`. Documenté ; bug ouvert à finir.

### 5.4 Fee collection : opt-in non encore exposé en UI

La nouvelle migration crée le système Fee Collection, mais :
- Le trigger DB ne fire **que si** `merchants.auto_fee_collection_enabled = true`
  ET `merchants.fee_collection_consent_at IS NOT NULL`
- **Aucune UI ne permet au marchand de donner ce consentement**
- Aucune UI admin ne montre les fee_collections ou merchant_debts
- L'edge function `collect-fees` **n'est pas encore implémentée** (était la
  section 3 du brainstorming en cours)

Donc à ce stade le système est **inert** côté DB — c'est cohérent avec
l'opt-in design, mais ça veut dire que **techniquement, aucune fee n'est
collectée aujourd'hui** même si tu actives Resend et MonCash.

### 5.5 Petits points de friction

| # | Observation | Impact |
|---|---|---|
| 5.5.1 | `verify-payment` v8 n'a pas été redéployé avec le nouveau `_shared/auth.ts` (rate limiting). Il appelle `authorizeInternalOrApiKey` qui n'utilise pas `enforceRateLimit` → pas un bug, mais asymétrique | Faible |
| 5.5.2 | `payments.fee_collection_status` default NULL — les paiements pré-migration restent NULL au lieu de 'skipped' | Cosmétique |
| 5.5.3 | Le tile "Gateway fees" sur le dashboard merchant montre l'accounting (somme `gateway_fee_amount`), pas le réel collecté. À ajuster après implém Fee Collection | Minor |
| 5.5.4 | Sentry deferred — pas de monitoring d'erreurs runtime côté Vercel/Edge | Important pour prod |
| 5.5.5 | Pas de tests automatisés (zero `*.test.ts`) ni CI GitHub Actions | Important long terme |

---

## 6. Décisions architecturales clés (résumé)

| Décision | Choix | Justification |
|---|---|---|
| Stack frontend | Next.js 15 App Router + Server Actions | Choix de départ du projet existant |
| Backend | Supabase (Postgres + Auth + Edge Functions + Storage) | Tout-en-un, RLS native, pg_cron |
| Encryption | AES-GCM 256 avec nonce | Standard, Web Crypto natif Deno |
| Webhook signature | HMAC-SHA-256 façon Stripe (`t=…,v1=…`) | Industry standard, replay protection |
| Rate limit | Bucket DB per minute + RPC atomique | Pas de Redis nécessaire, simple |
| Multi-tenant | RLS + helper `is_merchant_member` | Sécurité défense en profondeur |
| Email provider | Resend (free 3k/mois) | API simple, free tier généreux |
| Translations | Dict statique TS + résolution cookie/header | Léger, pas de dépendance externe |
| Charts | SVG inline (sparkline, area) | Pas de lib, build léger |
| QR codes | `qrcode` npm (server-side SVG + PNG) | Standard, petite empreinte |
| **Settlement** | **Modèle C** : marchand encaisse, HaitiPay collecte 2.5% via MonCash Transfert | Pas de licence BRH requise, collecte garantie |

---

## 7. Actions manuelles requises (côté utilisateur, non-codables)

### Bloquantes pour activer Fee Collection
- [ ] Compte MonCash business HaitiPay (numéro destinataire des fees)
- [ ] Vérifier que MonCash Transfert est activé pour ce compte
- [ ] Setter env `HAITIPAY_MASTER_MONCASH_PHONE` dans Edge Function Secrets
- [ ] Pour chaque marchand : faire signer le consentement légal (TOS update)

### Bloquantes pour activer email
- [ ] Compte Resend + domaine vérifié
- [ ] Setter `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_SENDER_SECRET` dans Edge Function Secrets

### Bloquantes pour activer dispatcher webhooks
- [ ] Setter `DISPATCHER_SECRET` (déjà fait selon le test cron du jour 4)

### Bloquantes pour MonCash réel
- [ ] Credentials MonCash sandbox (clientId + clientSecret) pour chaque marchand
- [ ] Saisir dans `/dashboard/provider-settings`

### Pour la prod publique
- [ ] Activer "Leaked password protection" dans Supabase Auth
- [ ] Custom domain + SSL
- [ ] Redirect URLs Supabase Auth pour `<domain>/auth/callback` + `<domain>/login/mfa`
- [ ] SMTP custom Supabase Auth (sinon limité à 3 mails/heure pour le password reset/email verification)

---

## 8. Évaluation de la cohérence (note globale : 8/10)

### Ce qui est très cohérent (+)
- **Patterns réutilisés** : outbox+cron+retry partout, c'est devenu une grammaire
- **Sécurité par défaut** : RLS partout, secrets jamais en clair, `SECURITY DEFINER` révoqué de PUBLIC
- **Décisions documentées** : chaque pivot a été expliqué et tracé dans les tâches
- **Migration progressive** : opt-in pour Fee Collection, mode `sandbox|live` partout, feature flag implicite via `auto_fee_collection_enabled`
- **Roadmap suivi à 80 %** : Sprint 1.1 + 1.2 + DX (Sprint 2.2) faits

### Ce qui est moins cohérent (-)
- **ROADMAP.md obsolète** depuis le pivot Payouts → Fee Collection
- **i18n incomplet** : 3/9 pages
- **Sprint 2.1 NatCash sauté** sans mise à jour du roadmap
- **Tests absents** (zéro) — c'est documenté comme priorité long-terme mais pas encore commencé
- **Sentry / observability** deferred sans date

### Risque résiduel principal
La fragilité de **MonCash Transfert** : on a la doc officielle, on connaît les endpoints, mais on ne sait pas si :
- Les wallets marchands ordinaires ont la capability `Transfert` activée
- Le wallet "où arrive le CreatePayment" est le même que le "PrefundedBalance" utilisé par Transfert

Si la réponse aux deux questions est **non**, le Modèle C ne marche pas et il faut re-pivoter vers Modèle B (invoicing mensuel). Le design actuel **prévoit** ce cas (fallback manuel admin + state `merchant_debts`), mais pas en mode "tout le monde a besoin de payer manuellement".

---

## 9. Recommandations prioritaires

1. **Mettre à jour ROADMAP.md** pour refléter le pivot Fee Collection et le retrait de NatCash de Sprint 2.1
2. **Terminer le brainstorming Fee Collection** (sections 4-5 + spec doc) avant de coder l'implémentation
3. **Faire un test sandbox MonCash Transfert** dès que tu as un compte business actif, pour valider l'hypothèse Modèle C
4. **Activer Resend + envoyer un email test** pour valider la chaîne email outbox → cron → Resend → Inbox
5. **Compléter l'i18n** (FR/HT) sur les 6 pages restantes — petit effort, gros impact UX local
6. **Ajouter Sentry** ou équivalent (Vercel monitoring intégré) avant d'ouvrir aux vrais marchands
7. **Écrire au moins 5 tests E2E** sur les flows critiques (signup → KYC → payment → webhook → refund)
8. **Documenter le pivot Fee Collection** dans le commit de la migration 20260620 (déjà fait en partie) et dans le README

---

## 10. Verdict

Le projet est **un MVP techniquement crédible** avec une architecture solide,
des patterns reproduits, et une trajectoire claire. Les pivots ont été des
améliorations (notamment Fee Collection qui résout un trou business critique
que personne n'avait identifié au départ).

**Pour ouvrir aux 10 premiers marchands amis (live MonCash)** : ~1 semaine
de travail manuel (actions §7) + finir Fee Collection (sections 4-5) +
1 test E2E sandbox.

**Pour atteindre un produit "complet pour tous types de marchands"** : il
reste les sprints 3-5 du roadmap (subscriptions, WooCommerce, cards, marketplace,
fraud) — environ 3-4 mois supplémentaires au rythme actuel, plus les
intégrations bancaires/légales qui sont hors-code.
