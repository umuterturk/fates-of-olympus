export type Language = 'en' | 'es-mx' | 'tr';

export const translations = {
  en: {
    hero: {
      title: 'Fates of Olympus',
      subtitle: 'Strategic mythic card battles.',
      tagline: 'Now on iPhone.',
      cta: 'Download on the App Store',
    },
    gods: {
      title: 'Command the gods',
      subtitle: 'Twelve Olympians await your strategy',
    },
    monsters: {
      title: 'Face legendary foes',
      subtitle: 'Heroes and monsters from ancient myth',
    },
    download: {
      title: 'Begin your odyssey',
      subtitle: 'Strategic card battles await on iPhone',
      cta: 'Download on the App Store',
    },
    screenshots: {
      title: 'Experience the myth',
    },
    footer: {
      copyright: 'Fates of Olympus',
      support: 'Support',
    },
    support: {
      title: 'Support',
      reportBug: 'Report a Bug',
      reportBugDesc: 'Found a bug? Let us know on GitHub Issues',
      openIssue: 'Open an Issue',
      discussions: 'Discussions',
      discussionsDesc: 'Join the community, share feedback, and ask questions',
      joinDiscussion: 'Join Discussion',
      backHome: 'Back to Home',
    },
  },
  'es-mx': {
    hero: {
      title: 'Fates of Olympus',
      subtitle: 'Batallas de cartas míticas estratégicas.',
      tagline: 'Ahora en iPhone.',
      cta: 'Descargar en App Store',
    },
    gods: {
      title: 'Comanda a los dioses',
      subtitle: 'Doce Olímpicos esperan tu estrategia',
    },
    monsters: {
      title: 'Enfrenta enemigos legendarios',
      subtitle: 'Héroes y monstruos del mito antiguo',
    },
    download: {
      title: 'Comienza tu odisea',
      subtitle: 'Batallas de cartas estratégicas te esperan en iPhone',
      cta: 'Descargar en App Store',
    },
    screenshots: {
      title: 'Experimenta el mito',
    },
    footer: {
      copyright: 'Fates of Olympus',
      support: 'Soporte',
    },
    support: {
      title: 'Soporte',
      reportBug: 'Reportar un Error',
      reportBugDesc: '¿Encontraste un error? Háznos saber en GitHub Issues',
      openIssue: 'Abrir un Issue',
      discussions: 'Discusiones',
      discussionsDesc: 'Únete a la comunidad, comparte comentarios y haz preguntas',
      joinDiscussion: 'Unirse a la Discusión',
      backHome: 'Volver al inicio',
    },
  },
  tr: {
    hero: {
      title: 'Fates of Olympus',
      subtitle: 'Stratejik mitolojik kart savaşları.',
      tagline: "Artık iPhone'da.",
      cta: "App Store'dan İndir",
    },
    gods: {
      title: 'Tanrıları yönet',
      subtitle: 'On iki Olimpiyalı stratejini bekliyor',
    },
    monsters: {
      title: 'Efsanevi düşmanlarla yüzleş',
      subtitle: 'Antik mitlerden kahramanlar ve canavarlar',
    },
    download: {
      title: 'Macerana başla',
      subtitle: "iPhone'da stratejik kart savaşları seni bekliyor",
      cta: "App Store'dan İndir",
    },
    screenshots: {
      title: 'Miti deneyimle',
    },
    footer: {
      copyright: 'Fates of Olympus',
      support: 'Destek',
    },
    support: {
      title: 'Destek',
      reportBug: 'Hata Bildir',
      reportBugDesc: 'Bir hata mı buldunuz? GitHub Issues üzerinden bildirin',
      openIssue: 'Issue Aç',
      discussions: 'Tartışmalar',
      discussionsDesc: 'Topluluğa katıl, geri bildirim paylaş ve soru sor',
      joinDiscussion: 'Tartışmaya Katıl',
      backHome: 'Ana Sayfaya Dön',
    },
  },
} as const;

export function detectLanguage(): Language {
  if (typeof window === 'undefined') return 'en';
  
  const nav = window.navigator;
  const lang = (nav.languages?.[0] || nav.language || '').toLowerCase();
  
  if (lang.startsWith('es')) return 'es-mx';
  if (lang.startsWith('tr')) return 'tr';
  return 'en';
}
