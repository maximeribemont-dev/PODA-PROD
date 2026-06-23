import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const Layout = ({ title, children }) => (
    <div className="max-w-3xl mx-auto px-6 sm:px-10 py-12 sm:py-16">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-widest mb-8 hover:underline">
            <ArrowLeft size={16} /> Retour à l'accueil
        </Link>
        <h1 className="font-display text-4xl sm:text-5xl mb-8">{title}</h1>
        <div className="neo-card p-6 sm:p-10 prose-poda space-y-5 text-[15px] leading-relaxed">
            {children}
        </div>
    </div>
);

const H2 = ({ children }) => (
    <h2 className="font-display text-2xl mt-6 mb-2">{children}</h2>
);

export function CgvPage() {
    return (
        <Layout title="Conditions Générales de Vente">
            <p className="text-sm text-black/60">
                Dernière mise à jour : {new Date().toLocaleDateString("fr-FR")}.
            </p>

            <H2>1. Éditeur du site</H2>
            <p>
                Le site Poda est édité par la <strong>SAS BLEEM</strong>,
                immatriculée au RCS du Mans sous le numéro <strong>953 785 706 00029</strong>,
                au capital social de <strong>1 000 €</strong>, dont le siège social est situé{" "}
                <strong>3 rue des Noisetiers, 72190 Sargé-lès-le-Mans</strong>.
                Email de contact : <strong>lemans@bleem-co.fr</strong>.
            </p>

            <H2>2. Objet et champ d'application</H2>
            <p>
                Les présentes Conditions Générales de Vente (CGV) régissent l'ensemble des ventes de
                produits personnalisés (textile, accessoires et objets) proposés sur la plateforme Poda
                (ci-après « Poda »), accessible à l'adresse <strong>poda.bleem-co.fr</strong>, exploitée
                par la SAS BLEEM. Ces produits sont fabriqués en print on demand (impression à la demande)
                à la demande de l'acheteur, pour le compte d'une association partenaire.
                Toute commande implique l'acceptation pleine et entière des présentes CGV.
            </p>

            <H2>3. Prix</H2>
            <p>
                Les prix affichés sur Poda sont indiqués en euros toutes taxes comprises (TTC).
                La SAS BLEEM se réserve le droit de modifier ses prix à tout moment, étant entendu
                que le prix applicable à la commande est celui en vigueur au moment de la validation
                du paiement. Les frais de livraison éventuels sont indiqués séparément avant la
                confirmation de la commande.
            </p>

            <H2>4. Commande et paiement</H2>
            <p>
                Le client sélectionne ses produits, choisit ses options (taille, couleur, quantité),
                renseigne ses coordonnées, puis procède au paiement. Le paiement est effectué en une
                seule fois, par carte bancaire, via le prestataire sécurisé <strong>Stripe</strong>
                (Stripe Payments Europe, Ltd). Les données bancaires ne sont jamais stockées par BLEEM.
                La commande est ferme et définitive dès validation du paiement par Stripe. Un email
                de confirmation est adressé à l'acheteur à l'adresse email fournie lors de la commande.
            </p>

            <H2>5. Modalités de production — lot collectif</H2>
            <p>
                Les produits sont fabriqués selon le système du <strong>lot collectif</strong> :
                la production est lancée dès que le lot atteint <strong>20 unités commandées et payées</strong>
                (tous produits confondus au sein de la boutique de l'association).
            </p>
            <p>
                <strong>Délai maximum garanti :</strong> Si le seuil de 20 unités n'est pas atteint dans
                un délai de <strong>4 semaines (28 jours calendaires)</strong> à compter de la première
                commande payée du lot en cours, BLEEM lance automatiquement la production avec les commandes
                reçues, quel que soit le nombre d'unités atteint. L'acheteur est informé par email du
                lancement de la production.
            </p>
            <p>
                Le délai de fabrication et d'expédition au bureau de l'association est généralement de
                <strong>10 à 15 jours ouvrés</strong> à compter du lancement de la production.
            </p>

            <H2>6. Option livraison express à domicile</H2>
            <p>
                L'acheteur peut choisir l'option <strong>« Ne pas attendre — livraison directe chez moi »</strong>,
                moyennant un supplément de <strong>20 € TTC</strong> ajouté au panier. Dans ce cas :
            </p>
            <ul className="list-disc pl-6 space-y-1">
                <li>La commande est traitée en priorité, indépendamment du lot collectif en cours.</li>
                <li>La livraison est effectuée directement à l'adresse indiquée par l'acheteur lors de la commande.</li>
                <li>Le délai de livraison est de <strong>8 jours ouvrés</strong> à compter de la validation du paiement.</li>
                <li>Ce supplément de 20 € est dû dès la validation du paiement et ne fait pas l'objet d'un remboursement,
                sauf erreur imputable à BLEEM ou défaut manifeste de fabrication.</li>
            </ul>

            <H2>7. Livraison</H2>
            <p>
                <strong>Lot collectif :</strong> Les commandes sont expédiées groupées au bureau de
                l'association partenaire, qui se charge ensuite de la remise aux acheteurs selon les
                modalités qu'elle définit. BLEEM ne peut être tenu responsable des délais de remise
                finale par l'association.
            </p>
            <p>
                <strong>Livraison express :</strong> Les commandes avec option express sont expédiées
                directement à l'adresse de livraison renseignée par l'acheteur. Il appartient à
                l'acheteur de fournir une adresse complète et exacte. En cas d'adresse erronée ou
                incomplète, BLEEM ne pourra être tenu responsable de la non-livraison.
            </p>
            <p>
                En cas de retard d'expédition imputable à BLEEM, l'acheteur est informé par email
                dans les meilleurs délais. Les produits étant fabriqués sur mesure, aucun remboursement
                ne peut être accordé pour ce seul motif, sauf défaut manifeste de fabrication prévu
                à l'article 9 des présentes CGV.
            </p>

            <H2>8. Droit de rétractation</H2>
            <p className="bg-[#FBEA8C] border-4 border-black p-4">
                <strong>Les produits étant fabriqués sur mesure et personnalisés à la demande</strong>{" "}
                de l'acheteur (print on demand), conformément à l'<strong>article L221-28 12° du Code
                de la consommation</strong>, le droit de rétractation de 14 jours prévu à l'article
                L221-18 du même code <strong>ne s'applique pas</strong>. Toute commande validée et
                payée est définitive et ne peut faire l'objet d'un remboursement, sauf dans les cas
                prévus aux articles 9 et 10 des présentes CGV.
            </p>

            <H2>9. Garanties légales</H2>
            <p>
                Conformément aux articles L217-4 et suivants du Code de la consommation et aux articles
                1641 et suivants du Code civil, l'acheteur bénéficie des garanties légales de conformité
                et des vices cachés. En cas de défaut manifeste imputable à BLEEM (produit endommagé à
                la réception, erreur de personnalisation, produit non conforme à la commande), l'acheteur
                dispose de <strong>14 jours après réception</strong> pour en informer BLEEM par email à
                l'adresse <strong>lemans@bleem-co.fr</strong>, en joignant des photos du défaut constaté.
                BLEEM proposera alors, au choix de l'acheteur, un remplacement ou un remboursement total.
            </p>

            <H2>10. Service client et règlement des litiges</H2>
            <p>
                Pour toute question ou réclamation, l'acheteur peut contacter BLEEM à l'adresse
                email <strong>lemans@bleem-co.fr</strong>. BLEEM s'engage à répondre dans un délai
                de 5 jours ouvrés.
            </p>
            <p>
                Conformément à l'article L612-1 du Code de la consommation, en cas de litige non résolu
                amiablement, l'acheteur peut recourir gratuitement à un médiateur de la consommation.
                BLEEM adhère au service de médiation <strong>CM2C</strong> (Centre de Médiation de la
                Consommation de Conciliateurs de Justice), accessible à l'adresse{" "}
                <strong>www.cm2c.net</strong>.
            </p>
            <p>
                La Commission européenne met également à disposition une plateforme de règlement en ligne
                des litiges (RLL) accessible à l'adresse : <strong>https://ec.europa.eu/consumers/odr</strong>.
            </p>

            <H2>11. Données personnelles</H2>
            <p>
                Les données collectées via le formulaire de commande sont traitées conformément au
                Règlement Général sur la Protection des Données (RGPD) et à la loi Informatique et
                Libertés. Pour plus d'informations, consultez la{" "}
                <Link to="/legal/confidentialite" className="underline font-bold">politique de confidentialité</Link>.
            </p>

            <H2>12. Propriété intellectuelle</H2>
            <p>
                L'ensemble des éléments du site Poda (logo, textes, visuels, architecture) sont la
                propriété exclusive de la SAS BLEEM et sont protégés par le droit de la propriété
                intellectuelle. Toute reproduction ou utilisation sans autorisation préalable est interdite.
            </p>

            <H2>13. Droit applicable et juridiction</H2>
            <p>
                Les présentes CGV sont soumises au droit français. En cas de litige non résolu par
                la voie amiable ou par la médiation, les tribunaux compétents du Mans seront seuls
                compétents, sauf disposition légale contraire applicable au consommateur.
            </p>
        </Layout>
    );
}

export function PrivacyPage() {
    return (
        <Layout title="Politique de confidentialité (RGPD)">
            <p className="text-sm text-black/60">
                Dernière mise à jour : {new Date().toLocaleDateString("fr-FR")}.
            </p>

            <H2>1. Responsable de traitement</H2>
            <p>
                Le responsable du traitement des données est la <strong>SAS BLEEM</strong>,
                immatriculée au RCS du Mans sous le numéro 953 785 706 00029,
                siège social : 3 rue des Noisetiers, 72190 Sargé-lès-le-Mans.
            </p>

            <H2>2. Données collectées</H2>
            <ul className="list-disc pl-6 space-y-1">
                <li>Identité : nom, prénom</li>
                <li>Contact : email, téléphone</li>
                <li>Adresse de livraison : adresse, code postal, ville, pays</li>
                <li>Données de commande : produits achetés, montants, statut de paiement</li>
                <li>Données techniques de paiement (gérées par Stripe, jamais stockées chez nous)</li>
            </ul>

            <H2>3. Finalités</H2>
            <ul className="list-disc pl-6 space-y-1">
                <li>Traitement et expédition de votre commande</li>
                <li>Envoi des emails de confirmation et de suivi</li>
                <li>Obligations légales (facturation, comptabilité)</li>
            </ul>

            <H2>4. Base légale</H2>
            <p>
                Le traitement est fondé sur l'exécution du contrat de vente (article 6.1.b du RGPD)
                et nos obligations légales (article 6.1.c).
            </p>

            <H2>5. Durée de conservation</H2>
            <p>
                Les données de commande sont conservées 10 ans à des fins comptables et fiscales.
                Les emails commerciaux peuvent être conservés 3 ans après le dernier contact.
            </p>

            <H2>6. Destinataires</H2>
            <p>
                Vos données sont accessibles uniquement à la SAS BLEEM, à l'association partenaire
                pour l'expédition, et aux prestataires techniques (Stripe pour le paiement, Resend
                pour les emails). Aucune revente à des tiers.
            </p>

            <H2>7. Vos droits</H2>
            <p>
                Conformément au RGPD, vous disposez d'un droit d'accès, de rectification, d'effacement,
                de limitation et d'opposition. Pour exercer ces droits, contactez-nous à{" "}
                <a href="mailto:lemans@bleem-co.fr" className="underline font-bold">lemans@bleem-co.fr</a>.
                Vous pouvez également saisir la <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" className="underline font-bold">CNIL</a>.
            </p>

            <H2>8. Cookies</H2>
            <p>
                Le site n'utilise que des cookies techniques nécessaires au fonctionnement (panier, session
                admin). Aucun cookie de traçage ou publicitaire.
            </p>
        </Layout>
    );
}

const FAQ_ITEMS = [
    {
        q: "C'est quoi le lot collectif ?",
        a: "PODA fonctionne en impression à la demande groupée. Quand vous commandez, votre article rejoint un lot collectif. Dès que ce lot atteint 20 pièces commandées et payées (tous produits confondus), BLEEM lance la fabrication et expédie l'ensemble au bureau de votre association.",
    },
    {
        q: "Quand vais-je être livré ?",
        a: "Si vous avez choisi la livraison classique (lot collectif) : comptez 10 à 15 jours ouvrés après le lancement du lot. Si vous avez choisi l'option express (+20€) : votre commande est expédiée directement chez vous sous 8 jours ouvrés, sans attendre le lot.",
    },
    {
        q: "Que se passe-t-il si le lot n'atteint jamais 20 pièces ?",
        a: "Pas d'inquiétude — si le lot n'a pas atteint 20 pièces au bout de 4 semaines (28 jours) à compter de la première commande payée, BLEEM lance automatiquement la production avec les commandes reçues. Vous recevrez un email pour vous en informer.",
    },
    {
        q: "C'est quoi l'option « Ne pas attendre — livraison directe chez moi » ?",
        a: "En ajoutant cette option (+20€) à votre panier, votre commande est traitée en priorité et expédiée directement à votre adresse personnelle, sans attendre que le lot atteigne 20 pièces. Idéal si vous en avez besoin rapidement.",
    },
    {
        q: "Ma commande est livrée où ?",
        a: "Par défaut, les commandes sont regroupées et expédiées au bureau de votre association, qui se charge de la distribution aux membres. Si vous avez choisi l'option express, la livraison s'effectue directement à l'adresse que vous avez indiquée lors de la commande.",
    },
    {
        q: "Puis-je annuler ou modifier ma commande ?",
        a: "Non. Les produits étant fabriqués sur mesure et personnalisés à la demande, conformément à l'article L221-28 du Code de la consommation, toute commande validée et payée est définitive. Vous ne pouvez pas modifier votre taille, couleur ou quantité après paiement.",
    },
    {
        q: "Comment je suis informé du lancement de la production ?",
        a: "Vous recevez un email automatique à l'adresse fournie lors de votre commande dès que le lot est lancé en production (20 pièces atteintes ou délai de 4 semaines écoulé).",
    },
    {
        q: "J'ai reçu un produit défectueux, que faire ?",
        a: "Contactez-nous dans les 14 jours suivant la réception à lemans@bleem-co.fr en joignant des photos du défaut constaté. En cas de défaut manifeste imputable à BLEEM (erreur de personnalisation, produit endommagé), nous proposons un remplacement ou un remboursement.",
    },
    {
        q: "Mes données personnelles sont-elles en sécurité ?",
        a: "Oui. Vos données sont utilisées uniquement pour le traitement de votre commande. Les données bancaires sont gérées directement par Stripe (jamais stockées chez nous). Pour plus de détails, consultez notre politique de confidentialité.",
    },
    {
        q: "Qui est BLEEM ?",
        a: "BLEEM est un atelier créatif B2B basé à Sargé-lès-le-Mans (72), spécialisé dans le merchandising identitaire. PODA est notre solution dédiée aux associations, pour leur permettre d'avoir du merch pro sans avancer de trésorerie.",
    },
];

export function FaqPage() {
    return (
        <Layout title="Questions fréquentes">
            <p className="text-sm text-black/60 mb-4">
                Une question sur PODA ? Vous trouverez ici les réponses aux questions les plus fréquentes.
                Si vous ne trouvez pas votre réponse,{" "}
                <a href="mailto:lemans@bleem-co.fr" className="underline font-bold">contactez-nous</a>.
            </p>
            <div className="space-y-4">
                {FAQ_ITEMS.map((item, i) => (
                    <details key={i} className="border-4 border-black group">
                        <summary className="p-4 font-display text-lg cursor-pointer list-none flex items-center justify-between hover:bg-[#FBEA8C] transition-colors">
                            {item.q}
                            <span className="text-2xl font-bold ml-4 group-open:rotate-45 transition-transform inline-block">+</span>
                        </summary>
                        <div className="px-4 pb-4 pt-2 border-t-4 border-black text-[15px] leading-relaxed">
                            {item.a}
                        </div>
                    </details>
                ))}
            </div>
            <div className="mt-8 bg-black text-white p-6 text-center">
                <p className="font-display text-xl mb-2">Votre asso veut son PODA ?</p>
                <a
                    href="https://bleem-co.fr/contactez-nous/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block bg-[#FF6B6B] text-black font-display uppercase text-sm px-6 py-2 border-2 border-[#FF6B6B] hover:bg-transparent hover:text-[#FF6B6B] transition-colors mt-2"
                >
                    Contacte BLEEM →
                </a>
            </div>
        </Layout>
    );
}
