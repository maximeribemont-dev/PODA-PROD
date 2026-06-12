# Poda — Merch d'association en print on demand

## Problem statement
Créer une page Poda : merch d'association en print on demand. 6 produits, formulaire 1-clic (nom/prénom/adresse/email/téléphone/taille/couleur), paiement Stripe, incrémentation 1/20 par produit ; au 20ᵉ le lot est expédié au bureau de l'asso. Dashboard admin, emails de confirmation.

## Architecture
- **Backend**: FastAPI (`/app/backend/server.py`) + MongoDB (collections `orders`, `payment_transactions`)
- **Frontend**: React + react-router + sonner + lucide-react ; design neo-brutalist
- **Stripe**: `emergentintegrations.payments.stripe.checkout` avec `STRIPE_API_KEY=sk_test_emergent`
- **Email**: Resend (MOCKÉ — clé absente, simulation par log dans backend.out.log)
- **Routes frontend**: `/`, `/commander/:productId`, `/success?session_id=...`, `/admin`

## User personas
- **Visiteur / soutien de l'asso** : choisit un produit, remplit le formulaire, paie.
- **Admin de l'asso** : suit la progression des lots et marque l'expédition.

## Core requirements (static)
- 6 produits (t-shirt, sweat, tote bag, mug, casquette, veste) avec prix EUR définis backend
- Compteur de lot incrémental par produit, taille `BATCH_SIZE=20`
- Paiement Stripe checkout sécurisé (prix défini serveur, urls dynamiques success/cancel)
- Email de confirmation (mocked tant que `RESEND_API_KEY` est vide)
- Dashboard admin protégé par mot de passe (`ADMIN_PASSWORD`)
- Interface 100% française

## Implemented (v1 — 2026-02-11)
- ✅ Catalogue 6 produits, Stripe Checkout, polling, webhook, email mocked, admin dashboard v1, design neo-brutalist

## Implemented (v2 — 2026-02-12)
- ✅ **Panier multi-produits** (CartContext + localStorage, fusion auto même variante)
- ✅ **Compteur global** : 20 unités confondues (1 cmde de 3 t-shirts = +3 au compteur)
- ✅ **Upload logo asso** (base64 dans MongoDB, max 2 Mo) + nom d'asso configurable
- ✅ Page `/cart` avec form de livraison intégré, success page affichant les positions globales
- ✅ Admin v2 : stats globales, action « marquer lot #N expédié », section branding
- ✅ Tests : 21/21 backend pytest + 100% frontend Playwright

## Backlog (P0 / P1 / P2)
- **P1** Ajouter la vraie clé Resend pour envoyer les emails (juste `RESEND_API_KEY=re_...` dans `.env`)
- **P1** Permettre à l'admin d'uploader les vrais visuels produits (object storage)
- **P1** Page « mes commandes » par email (suivi client)
- **P2** Notifier les acheteurs quand un lot atteint 20/20
- **P2** Code promo / parrainage
- **P2** Index Mongo unique sur `stripe_session_id`
- **P2** Webhook secret Stripe + lifespan handler (au lieu de `on_event`)
- **P2** Stockage prix en cents (`int`) au lieu de `float`

## Test credentials
Voir `/app/memory/test_credentials.md`.
