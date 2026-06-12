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
            </p>

            <H2>2. Objet</H2>
            <p>
                Les présentes CGV régissent la vente de produits personnalisés (textile et accessoires)
                proposés sur Poda, fabriqués en print on demand à la demande de l'acheteur, pour le
                compte d'une association partenaire.
            </p>

            <H2>3. Commande et paiement</H2>
            <p>
                Le client passe commande via le panier en ligne. Le paiement est effectué en une fois
                par carte bancaire via le prestataire <strong>Stripe</strong>. La commande est ferme
                et définitive dès validation du paiement.
            </p>

            <H2>4. Lot collectif et délais de production</H2>
            <p>
                Les produits sont fabriqués en lots de 20 unités confondues. Le lancement en production
                intervient dès que le lot collectif atteint 20 commandes payées. Le délai de fabrication
                puis d'expédition au bureau de l'association est généralement de 2 à 4 semaines à compter
                du démarrage du lot.
            </p>

            <H2>5. Livraison</H2>
            <p>
                Les commandes sont livrées au bureau de l'association, qui se charge ensuite de la
                remise aux acheteurs selon les modalités définies avec elle.
            </p>

            <H2>6. Droit de rétractation</H2>
            <p className="bg-[#FBEA8C] border-4 border-black p-4">
                <strong>Les produits étant personnalisés à la demande</strong>, conformément à
                l'<strong>article L221-28 du Code de la consommation</strong>, le droit de rétractation
                ne s'applique pas. Toute commande validée et payée est définitive et ne peut faire
                l'objet d'un remboursement, sauf défaut manifeste de fabrication.
            </p>

            <H2>7. Garanties</H2>
            <p>
                En cas de défaut manifeste (produit endommagé, erreur de personnalisation imputable à
                Poda), le client dispose de 14 jours après réception pour en informer l'éditeur par
                email. Un remplacement ou un avoir sera alors proposé.
            </p>

            <H2>8. Données personnelles</H2>
            <p>
                Les données collectées via le formulaire de commande sont utilisées exclusivement pour
                le traitement de la commande et la livraison. Pour plus d'informations, consultez la{" "}
                <Link to="/legal/confidentialite" className="underline font-bold">politique de confidentialité</Link>.
            </p>

            <H2>9. Droit applicable</H2>
            <p>
                Les présentes CGV sont soumises au droit français. Tout litige sera soumis aux
                tribunaux compétents du Mans, sauf disposition légale contraire.
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
                <a href="mailto:contact@bleem-co.fr" className="underline font-bold">contact@bleem-co.fr</a>.
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
