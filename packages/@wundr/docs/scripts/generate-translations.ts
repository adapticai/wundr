#!/usr/bin/env ts-node

/**
 * Translation Generator for Wundr Documentation
 *
 * This script creates base translations for all configured languages
 * and sets up the i18n infrastructure for the documentation site.
 */

import fs from 'fs-extra';
import path from 'path';

interface TranslationConfig {
  locales: string[];
  defaultLocale: string;
  sourceDir: string;
  outputDir: string;
}

interface TranslationStrings {
  [key: string]: string | TranslationStrings;
}

class TranslationGenerator {
  private config: TranslationConfig;
  private baseTranslations: Record<string, TranslationStrings> = {};

  constructor() {
    this.config = {
      locales: ['en', 'es', 'fr', 'de'],
      defaultLocale: 'en',
      sourceDir: path.resolve(__dirname, '..'),
      outputDir: path.resolve(__dirname, '../i18n'),
    };
  }

  async generate(): Promise<void> {
    console.log('🌐 Starting translation generation...');

    // Ensure i18n directory exists
    await fs.ensureDir(this.config.outputDir);

    // Generate base translations
    await this.generateBaseTranslations();

    // Create language-specific directories and files
    for (const locale of this.config.locales) {
      if (locale === this.config.defaultLocale) continue;
      await this.createLocaleFiles(locale);
    }

    // Create translation utilities
    await this.createTranslationUtils();

    console.log('✅ Translation generation completed!');
  }

  private async generateBaseTranslations(): Promise<void> {
    this.baseTranslations = {
      en: {
        'theme.ErrorPageContent.title': 'This page crashed.',
        'theme.ErrorPageContent.tryAgain': 'Try again',
        'theme.NotFound.title': 'Page Not Found',
        'theme.NotFound.p1': 'We could not find what you were looking for.',
        'theme.NotFound.p2': 'Please contact the owner of the site that linked you to the original URL and let them know their link is broken.',
        'theme.BackToTopButton.buttonAriaLabel': 'Scroll back to top',
        'theme.blog.archive.title': 'Archive',
        'theme.blog.archive.description': 'Archive',
        'theme.blog.paginator.navAriaLabel': 'Blog list page navigation',
        'theme.blog.paginator.newerEntries': 'Newer Entries',
        'theme.blog.paginator.olderEntries': 'Older Entries',
        'theme.blog.post.readingTime.plurals': 'One min read|{readingTime} min read',
        'theme.blog.post.readMore': 'Read More',
        'theme.blog.post.paginator.navAriaLabel': 'Blog post page navigation',
        'theme.blog.post.paginator.newerPost': 'Newer Post',
        'theme.blog.post.paginator.olderPost': 'Older Post',
        'theme.blog.sidebar.navAriaLabel': 'Blog recent posts navigation',
        'theme.blog.tagTitle': '{nPosts} tagged with "{tagName}"',
        'theme.tags.tagsPageTitle': 'Tags',
        'theme.tags.tagsPageLink': 'View All Tags',
        'theme.docs.breadcrumbs.home': 'Home page',
        'theme.docs.breadcrumbs.navAriaLabel': 'Breadcrumbs',
        'theme.docs.DocCard.categoryDescription': '{count} items',
        'theme.docs.paginator.navAriaLabel': 'Docs pages',
        'theme.docs.paginator.previous': 'Previous',
        'theme.docs.paginator.next': 'Next',
        'theme.docs.sidebar.collapseButtonTitle': 'Collapse sidebar',
        'theme.docs.sidebar.collapseButtonAriaLabel': 'Collapse sidebar',
        'theme.docs.sidebar.navAriaLabel': 'Docs sidebar',
        'theme.docs.sidebar.closeSidebarButtonAriaLabel': 'Close navigation bar',
        'theme.docs.sidebar.toggleSidebarButtonAriaLabel': 'Toggle navigation bar',
        'theme.navbar.mobileVersionsDropdown.label': 'Versions',
        'theme.TOCCollapsible.toggleButtonLabel': 'On this page',
        'theme.common.editThisPage': 'Edit this page',
        'theme.common.headingLinkTitle': 'Direct link to {heading}',
        'theme.common.skipToMainContent': 'Skip to main content',
        'theme.tags.tagsListLabel': 'Tags:',
        'theme.SearchBar.label': 'Search',
        'theme.SearchBar.seeAll': 'See all {count} results',
        'theme.SearchModal.searchBox.resetButtonTitle': 'Clear the query',
        'theme.SearchModal.searchBox.cancelButtonText': 'Cancel',
        'theme.SearchModal.noResultsText': 'No results for',
        'theme.SearchModal.errorScreen.titleText': 'Unable to fetch results',
        'theme.SearchModal.errorScreen.helpText': 'You might want to check your network connection.',
        'theme.SearchModal.footer.selectText': 'to select',
        'theme.SearchModal.footer.navigateText': 'to navigate',
        'theme.SearchModal.footer.closeText': 'to close',
        'theme.SearchModal.startScreen.recentSearchesTitle': 'Recent',
        'theme.SearchModal.startScreen.noRecentSearchesText': 'No recent searches',
        'theme.SearchModal.startScreen.saveRecentSearchButtonTitle': 'Save this search',
        'theme.SearchModal.startScreen.removeRecentSearchButtonTitle': 'Remove this search from history',
        'theme.SearchModal.startScreen.favoriteSearchesTitle': 'Favorite',
        'theme.SearchModal.startScreen.removeFavoriteSearchButtonTitle': 'Remove this search from favorites',
        'theme.docs.versionBadge.label': 'Version: {versionLabel}',
      },
      es: {
        'theme.ErrorPageContent.title': 'Esta página se ha bloqueado.',
        'theme.ErrorPageContent.tryAgain': 'Inténtalo de nuevo',
        'theme.NotFound.title': 'Página no encontrada',
        'theme.NotFound.p1': 'No pudimos encontrar lo que estabas buscando.',
        'theme.NotFound.p2': 'Ponte en contacto con el propietario del sitio que te vinculó a la URL original y hazle saber que su enlace está roto.',
        'theme.BackToTopButton.buttonAriaLabel': 'Volver arriba',
        'theme.blog.archive.title': 'Archivo',
        'theme.blog.archive.description': 'Archivo',
        'theme.blog.paginator.navAriaLabel': 'Navegación de la lista del blog',
        'theme.blog.paginator.newerEntries': 'Entradas más recientes',
        'theme.blog.paginator.olderEntries': 'Entradas más antiguas',
        'theme.blog.post.readingTime.plurals': '1 min de lectura|{readingTime} min de lectura',
        'theme.blog.post.readMore': 'Leer más',
        'theme.blog.post.paginator.navAriaLabel': 'Navegación de publicación del blog',
        'theme.blog.post.paginator.newerPost': 'Publicación más reciente',
        'theme.blog.post.paginator.olderPost': 'Publicación más antigua',
        'theme.blog.sidebar.navAriaLabel': 'Navegación de publicaciones recientes del blog',
        'theme.blog.tagTitle': '{nPosts} etiquetados con "{tagName}"',
        'theme.tags.tagsPageTitle': 'Etiquetas',
        'theme.tags.tagsPageLink': 'Ver todas las etiquetas',
        'theme.docs.breadcrumbs.home': 'Página de inicio',
        'theme.docs.breadcrumbs.navAriaLabel': 'Migas de pan',
        'theme.docs.DocCard.categoryDescription': '{count} elementos',
        'theme.docs.paginator.navAriaLabel': 'Páginas de documentos',
        'theme.docs.paginator.previous': 'Anterior',
        'theme.docs.paginator.next': 'Siguiente',
        'theme.docs.sidebar.collapseButtonTitle': 'Contraer barra lateral',
        'theme.docs.sidebar.collapseButtonAriaLabel': 'Contraer barra lateral',
        'theme.docs.sidebar.navAriaLabel': 'Barra lateral de documentos',
        'theme.docs.sidebar.closeSidebarButtonAriaLabel': 'Cerrar barra de navegación',
        'theme.docs.sidebar.toggleSidebarButtonAriaLabel': 'Alternar barra de navegación',
        'theme.navbar.mobileVersionsDropdown.label': 'Versiones',
        'theme.TOCCollapsible.toggleButtonLabel': 'En esta página',
        'theme.common.editThisPage': 'Editar esta página',
        'theme.common.headingLinkTitle': 'Enlace directo a {heading}',
        'theme.common.skipToMainContent': 'Saltar al contenido principal',
        'theme.tags.tagsListLabel': 'Etiquetas:',
        'theme.SearchBar.label': 'Buscar',
        'theme.SearchBar.seeAll': 'Ver todos los {count} resultados',
        'theme.SearchModal.searchBox.resetButtonTitle': 'Limpiar la consulta',
        'theme.SearchModal.searchBox.cancelButtonText': 'Cancelar',
        'theme.SearchModal.noResultsText': 'No hay resultados para',
        'theme.SearchModal.errorScreen.titleText': 'No se pueden obtener los resultados',
        'theme.SearchModal.errorScreen.helpText': 'Es posible que desees verificar tu conexión de red.',
        'theme.SearchModal.footer.selectText': 'para seleccionar',
        'theme.SearchModal.footer.navigateText': 'para navegar',
        'theme.SearchModal.footer.closeText': 'para cerrar',
        'theme.SearchModal.startScreen.recentSearchesTitle': 'Recientes',
        'theme.SearchModal.startScreen.noRecentSearchesText': 'No hay búsquedas recientes',
        'theme.SearchModal.startScreen.saveRecentSearchButtonTitle': 'Guardar esta búsqueda',
        'theme.SearchModal.startScreen.removeRecentSearchButtonTitle': 'Eliminar esta búsqueda del historial',
        'theme.SearchModal.startScreen.favoriteSearchesTitle': 'Favoritos',
        'theme.SearchModal.startScreen.removeFavoriteSearchButtonTitle': 'Eliminar esta búsqueda de favoritos',
        'theme.docs.versionBadge.label': 'Versión: {versionLabel}',
      },
      fr: {
        'theme.ErrorPageContent.title': 'Cette page a planté.',
        'theme.ErrorPageContent.tryAgain': 'Réessayez',
        'theme.NotFound.title': 'Page introuvable',
        'theme.NotFound.p1': 'Nous n\'avons pas pu trouver ce que vous cherchiez.',
        'theme.NotFound.p2': 'Veuillez contacter le propriétaire du site qui vous a lié à l\'URL d\'origine et lui faire savoir que son lien est cassé.',
        'theme.BackToTopButton.buttonAriaLabel': 'Retour en haut',
        'theme.blog.archive.title': 'Archive',
        'theme.blog.archive.description': 'Archive',
        'theme.blog.paginator.navAriaLabel': 'Navigation de la liste du blog',
        'theme.blog.paginator.newerEntries': 'Entrées plus récentes',
        'theme.blog.paginator.olderEntries': 'Entrées plus anciennes',
        'theme.blog.post.readingTime.plurals': '1 min de lecture|{readingTime} min de lecture',
        'theme.blog.post.readMore': 'Lire la suite',
        'theme.blog.post.paginator.navAriaLabel': 'Navigation des articles du blog',
        'theme.blog.post.paginator.newerPost': 'Article plus récent',
        'theme.blog.post.paginator.olderPost': 'Article plus ancien',
        'theme.blog.sidebar.navAriaLabel': 'Navigation des articles récents du blog',
        'theme.blog.tagTitle': '{nPosts} tagués avec "{tagName}"',
        'theme.tags.tagsPageTitle': 'Tags',
        'theme.tags.tagsPageLink': 'Voir tous les tags',
        'theme.docs.breadcrumbs.home': 'Page d\'accueil',
        'theme.docs.breadcrumbs.navAriaLabel': 'Fil d\'Ariane',
        'theme.docs.DocCard.categoryDescription': '{count} éléments',
        'theme.docs.paginator.navAriaLabel': 'Pages de documents',
        'theme.docs.paginator.previous': 'Précédent',
        'theme.docs.paginator.next': 'Suivant',
        'theme.docs.sidebar.collapseButtonTitle': 'Réduire la barre latérale',
        'theme.docs.sidebar.collapseButtonAriaLabel': 'Réduire la barre latérale',
        'theme.docs.sidebar.navAriaLabel': 'Barre latérale des documents',
        'theme.docs.sidebar.closeSidebarButtonAriaLabel': 'Fermer la barre de navigation',
        'theme.docs.sidebar.toggleSidebarButtonAriaLabel': 'Basculer la barre de navigation',
        'theme.navbar.mobileVersionsDropdown.label': 'Versions',
        'theme.TOCCollapsible.toggleButtonLabel': 'Sur cette page',
        'theme.common.editThisPage': 'Modifier cette page',
        'theme.common.headingLinkTitle': 'Lien direct vers {heading}',
        'theme.common.skipToMainContent': 'Passer au contenu principal',
        'theme.tags.tagsListLabel': 'Tags :',
        'theme.SearchBar.label': 'Rechercher',
        'theme.SearchBar.seeAll': 'Voir tous les {count} résultats',
        'theme.SearchModal.searchBox.resetButtonTitle': 'Effacer la requête',
        'theme.SearchModal.searchBox.cancelButtonText': 'Annuler',
        'theme.SearchModal.noResultsText': 'Aucun résultat pour',
        'theme.SearchModal.errorScreen.titleText': 'Impossible de récupérer les résultats',
        'theme.SearchModal.errorScreen.helpText': 'Vous devriez vérifier votre connexion réseau.',
        'theme.SearchModal.footer.selectText': 'pour sélectionner',
        'theme.SearchModal.footer.navigateText': 'pour naviguer',
        'theme.SearchModal.footer.closeText': 'pour fermer',
        'theme.SearchModal.startScreen.recentSearchesTitle': 'Récentes',
        'theme.SearchModal.startScreen.noRecentSearchesText': 'Aucune recherche récente',
        'theme.SearchModal.startScreen.saveRecentSearchButtonTitle': 'Sauvegarder cette recherche',
        'theme.SearchModal.startScreen.removeRecentSearchButtonTitle': 'Supprimer cette recherche de l\'historique',
        'theme.SearchModal.startScreen.favoriteSearchesTitle': 'Favoris',
        'theme.SearchModal.startScreen.removeFavoriteSearchButtonTitle': 'Supprimer cette recherche des favoris',
        'theme.docs.versionBadge.label': 'Version : {versionLabel}',
      },
      de: {
        'theme.ErrorPageContent.title': 'Diese Seite ist abgestürzt.',
        'theme.ErrorPageContent.tryAgain': 'Erneut versuchen',
        'theme.NotFound.title': 'Seite nicht gefunden',
        'theme.NotFound.p1': 'Wir konnten nicht finden, wonach Sie gesucht haben.',
        'theme.NotFound.p2': 'Bitte wenden Sie sich an den Besitzer der Website, die Sie zur ursprünglichen URL verlinkt hat, und teilen Sie ihm mit, dass ihr Link defekt ist.',
        'theme.BackToTopButton.buttonAriaLabel': 'Zurück nach oben scrollen',
        'theme.blog.archive.title': 'Archiv',
        'theme.blog.archive.description': 'Archiv',
        'theme.blog.paginator.navAriaLabel': 'Blog-Listen-Seitennavigation',
        'theme.blog.paginator.newerEntries': 'Neuere Einträge',
        'theme.blog.paginator.olderEntries': 'Ältere Einträge',
        'theme.blog.post.readingTime.plurals': '1 Min. Lesezeit|{readingTime} Min. Lesezeit',
        'theme.blog.post.readMore': 'Weiterlesen',
        'theme.blog.post.paginator.navAriaLabel': 'Blog-Post-Seitennavigation',
        'theme.blog.post.paginator.newerPost': 'Neuerer Post',
        'theme.blog.post.paginator.olderPost': 'Älterer Post',
        'theme.blog.sidebar.navAriaLabel': 'Navigation für aktuelle Blog-Posts',
        'theme.blog.tagTitle': '{nPosts} mit "{tagName}" getaggt',
        'theme.tags.tagsPageTitle': 'Tags',
        'theme.tags.tagsPageLink': 'Alle Tags anzeigen',
        'theme.docs.breadcrumbs.home': 'Startseite',
        'theme.docs.breadcrumbs.navAriaLabel': 'Brotkrumen',
        'theme.docs.DocCard.categoryDescription': '{count} Elemente',
        'theme.docs.paginator.navAriaLabel': 'Dokumentenseiten',
        'theme.docs.paginator.previous': 'Zurück',
        'theme.docs.paginator.next': 'Weiter',
        'theme.docs.sidebar.collapseButtonTitle': 'Seitenleiste einklappen',
        'theme.docs.sidebar.collapseButtonAriaLabel': 'Seitenleiste einklappen',
        'theme.docs.sidebar.navAriaLabel': 'Dokumente-Seitenleiste',
        'theme.docs.sidebar.closeSidebarButtonAriaLabel': 'Navigationsleiste schließen',
        'theme.docs.sidebar.toggleSidebarButtonAriaLabel': 'Navigationsleiste umschalten',
        'theme.navbar.mobileVersionsDropdown.label': 'Versionen',
        'theme.TOCCollapsible.toggleButtonLabel': 'Auf dieser Seite',
        'theme.common.editThisPage': 'Diese Seite bearbeiten',
        'theme.common.headingLinkTitle': 'Direkter Link zu {heading}',
        'theme.common.skipToMainContent': 'Zum Hauptinhalt springen',
        'theme.tags.tagsListLabel': 'Tags:',
        'theme.SearchBar.label': 'Suchen',
        'theme.SearchBar.seeAll': 'Alle {count} Ergebnisse anzeigen',
        'theme.SearchModal.searchBox.resetButtonTitle': 'Die Abfrage löschen',
        'theme.SearchModal.searchBox.cancelButtonText': 'Abbrechen',
        'theme.SearchModal.noResultsText': 'Keine Ergebnisse für',
        'theme.SearchModal.errorScreen.titleText': 'Ergebnisse konnten nicht abgerufen werden',
        'theme.SearchModal.errorScreen.helpText': 'Sie sollten Ihre Netzwerkverbindung überprüfen.',
        'theme.SearchModal.footer.selectText': 'zum Auswählen',
        'theme.SearchModal.footer.navigateText': 'zum Navigieren',
        'theme.SearchModal.footer.closeText': 'zum Schließen',
        'theme.SearchModal.startScreen.recentSearchesTitle': 'Zuletzt verwendet',
        'theme.SearchModal.startScreen.noRecentSearchesText': 'Keine aktuellen Suchen',
        'theme.SearchModal.startScreen.saveRecentSearchButtonTitle': 'Diese Suche speichern',
        'theme.SearchModal.startScreen.removeRecentSearchButtonTitle': 'Diese Suche aus der Historie entfernen',
        'theme.SearchModal.startScreen.favoriteSearchesTitle': 'Favoriten',
        'theme.SearchModal.startScreen.removeFavoriteSearchButtonTitle': 'Diese Suche aus den Favoriten entfernen',
        'theme.docs.versionBadge.label': 'Version: {versionLabel}',
      },
    };
  }

  private async createLocaleFiles(locale: string): Promise<void> {
    console.log(`📝 Creating files for locale: ${locale}`);

    const localeDir = path.join(this.config.outputDir, locale);
    await fs.ensureDir(localeDir);

    // Create code.json with theme translations
    const codeFile = path.join(localeDir, 'code.json');
    await fs.writeJSON(codeFile, this.baseTranslations[locale] || {}, {
      spaces: 2,
    });

    // Create docusaurus-plugin-content-docs directory
    const docsPluginDir = path.join(localeDir, 'docusaurus-plugin-content-docs');
    await fs.ensureDir(docsPluginDir);

    // Create current.json for main docs
    const currentFile = path.join(docsPluginDir, 'current.json');
    await fs.writeJSON(currentFile, {
      'sidebar.tutorialSidebar.category.Getting Started': this.getTranslation(locale, 'Comenzar', 'Commencer', 'Erste Schritte'),
      'sidebar.tutorialSidebar.category.Core Concepts': this.getTranslation(locale, 'Conceptos Básicos', 'Concepts de Base', 'Kernkonzepte'),
      'sidebar.tutorialSidebar.category.CLI Commands': this.getTranslation(locale, 'Comandos CLI', 'Commandes CLI', 'CLI-Befehle'),
      'sidebar.tutorialSidebar.category.Web Dashboard': this.getTranslation(locale, 'Panel Web', 'Tableau de Bord Web', 'Web-Dashboard'),
      'sidebar.tutorialSidebar.category.Integration': this.getTranslation(locale, 'Integración', 'Intégration', 'Integration'),
      'sidebar.tutorialSidebar.category.Advanced Topics': this.getTranslation(locale, 'Temas Avanzados', 'Sujets Avancés', 'Erweiterte Themen'),
      'sidebar.tutorialSidebar.category.Migration Guides': this.getTranslation(locale, 'Guías de Migración', 'Guides de Migration', 'Migrationsanleitungen'),
      'sidebar.tutorialSidebar.category.Troubleshooting': this.getTranslation(locale, 'Solución de Problemas', 'Dépannage', 'Fehlerbehebung'),
    }, { spaces: 2 });

    // Create API docs translations
    const apiDocsDir = path.join(localeDir, 'docusaurus-plugin-content-docs-api');
    await fs.ensureDir(apiDocsDir);
    const apiCurrentFile = path.join(apiDocsDir, 'current.json');
    await fs.writeJSON(apiCurrentFile, {
      'sidebar.apiSidebar.category.Analysis': this.getTranslation(locale, 'Análisis', 'Analyse', 'Analyse'),
      'sidebar.apiSidebar.category.Reports': this.getTranslation(locale, 'Informes', 'Rapports', 'Berichte'),
      'sidebar.apiSidebar.category.Configuration': this.getTranslation(locale, 'Configuración', 'Configuration', 'Konfiguration'),
      'sidebar.apiSidebar.category.Batch Operations': this.getTranslation(locale, 'Operaciones por Lotes', 'Opérations par Lots', 'Batch-Operationen'),
    }, { spaces: 2 });

    // Create guides translations
    const guidesDocsDir = path.join(localeDir, 'docusaurus-plugin-content-docs-guides');
    await fs.ensureDir(guidesDocsDir);
    const guidesCurrentFile = path.join(guidesDocsDir, 'current.json');
    await fs.writeJSON(guidesCurrentFile, {
      'sidebar.guidesSidebar.category.Quick Start': this.getTranslation(locale, 'Inicio Rápido', 'Démarrage Rapide', 'Schnellstart'),
      'sidebar.guidesSidebar.category.Videos': this.getTranslation(locale, 'Videos', 'Vidéos', 'Videos'),
      'sidebar.guidesSidebar.category.Best Practices': this.getTranslation(locale, 'Mejores Prácticas', 'Meilleures Pratiques', 'Best Practices'),
    }, { spaces: 2 });

    // Create blog translations
    const blogPluginDir = path.join(localeDir, 'docusaurus-plugin-content-blog');
    await fs.ensureDir(blogPluginDir);
    const blogFile = path.join(blogPluginDir, 'options.json');
    await fs.writeJSON(blogFile, {
      title: this.getTranslation(locale, 'Blog', 'Blog', 'Blog'),
      description: this.getTranslation(locale, 'Blog de Wundr', 'Blog de Wundr', 'Wundr Blog'),
    }, { spaces: 2 });

    // Create navbar translations
    const navbarFile = path.join(localeDir, 'docusaurus-theme-classic', 'navbar.json');
    await fs.ensureDir(path.dirname(navbarFile));
    await fs.writeJSON(navbarFile, {
      'item.label.Documentation': this.getTranslation(locale, 'Documentación', 'Documentation', 'Dokumentation'),
      'item.label.API Reference': this.getTranslation(locale, 'Referencia API', 'Référence API', 'API-Referenz'),
      'item.label.Guides': this.getTranslation(locale, 'Guías', 'Guides', 'Anleitungen'),
      'item.label.Playground': this.getTranslation(locale, 'Playground', 'Playground', 'Playground'),
      'item.label.Blog': this.getTranslation(locale, 'Blog', 'Blog', 'Blog'),
      'item.label.GitHub': 'GitHub',
    }, { spaces: 2 });

    console.log(`✅ Created files for locale: ${locale}`);
  }

  private getTranslation(locale: string, es: string, fr: string, de: string): string {
    switch (locale) {
      case 'es': return es;
      case 'fr': return fr;
      case 'de': return de;
      default: return es; // fallback
    }
  }

  private async createTranslationUtils(): Promise<void> {
    const utilsDir = path.join(this.config.sourceDir, 'src/utils');
    await fs.ensureDir(utilsDir);

    const i18nUtilsContent = `/**
 * Internationalization utilities for Wundr Documentation
 */

export interface SupportedLocales {
  en: 'English';
  es: 'Español';
  fr: 'Français';
  de: 'Deutsch';
}

export const SUPPORTED_LOCALES: Record<keyof SupportedLocales, string> = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
};

export const DEFAULT_LOCALE = 'en';

export function getLocalizedPath(path: string, locale: string): string {
  if (locale === DEFAULT_LOCALE) {
    return path;
  }
  return \`/\${locale}\${path === '/' ? '' : path}\`;
}

export function getLocaleFromPath(path: string): string {
  const pathSegments = path.split('/').filter(Boolean);
  const firstSegment = pathSegments[0];
  
  if (firstSegment && Object.keys(SUPPORTED_LOCALES).includes(firstSegment)) {
    return firstSegment;
  }
  
  return DEFAULT_LOCALE;
}

export function stripLocaleFromPath(path: string): string {
  const locale = getLocaleFromPath(path);
  if (locale === DEFAULT_LOCALE) {
    return path;
  }
  
  return path.replace(new RegExp(\`^/\${locale}\`), '') || '/';
}

export function isLocaleSupported(locale: string): locale is keyof SupportedLocales {
  return Object.keys(SUPPORTED_LOCALES).includes(locale);
}
`;

    await fs.writeFile(
      path.join(utilsDir, 'i18n.ts'),
      i18nUtilsContent
    );

    console.log('📚 Created i18n utilities');
  }
}

// Run the generator
if (require.main === module) {
  const generator = new TranslationGenerator();
  generator.generate().catch(console.error);
}

export { TranslationGenerator };