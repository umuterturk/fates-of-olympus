export type CardEntry = {
  id: string;
  name: string;
  /** placeholder tone behind image */
  placeholder: string;
};

export const GODS: CardEntry[] = [
  { id: 'zeus', name: 'Zeus', placeholder: '#1a2332' },
  { id: 'athena', name: 'Athena', placeholder: '#2a2520' },
  { id: 'apollo', name: 'Apollo', placeholder: '#1e2a32' },
  { id: 'ares', name: 'Ares', placeholder: '#321a1a' },
  { id: 'hera', name: 'Hera', placeholder: '#2a1f28' },
  { id: 'hades', name: 'Hades', placeholder: '#0f1a14' },
  { id: 'poseidon', name: 'Poseidon', placeholder: '#132a32' },
  { id: 'hermes', name: 'Hermes', placeholder: '#252018' },
  { id: 'artemis', name: 'Artemis', placeholder: '#1a2820' },
  { id: 'dionysus', name: 'Dionysus', placeholder: '#2a1828' },
  { id: 'hephaestus', name: 'Hephaestus', placeholder: '#2a1c12' },
  { id: 'persephone', name: 'Persephone', placeholder: '#1a1420' },
];

export const HEROES_MONSTERS: CardEntry[] = [
  { id: 'achilles', name: 'Achilles', placeholder: '#1e2228' },
  { id: 'heracles', name: 'Heracles', placeholder: '#242018' },
  { id: 'medusa', name: 'Medusa', placeholder: '#1a2820' },
  { id: 'lernaean_hydra', name: 'Lernaean Hydra', placeholder: '#142618' },
  { id: 'minotaur', name: 'Minotaur', placeholder: '#281a14' },
  { id: 'cerberus', name: 'Cerberus', placeholder: '#121a18' },
  { id: 'typhon', name: 'Typhon', placeholder: '#221818' },
  { id: 'sirens', name: 'Sirens', placeholder: '#1a2430' },
  { id: 'chimera', name: 'Chimera', placeholder: '#2a2010' },
  { id: 'pegasus_rider', name: 'Pegasus Rider', placeholder: '#1e2838' },
  { id: 'kronos', name: 'Kronos', placeholder: '#181420' },
  { id: 'titan_atlas', name: 'Titan Atlas', placeholder: '#1a2228' },
];
