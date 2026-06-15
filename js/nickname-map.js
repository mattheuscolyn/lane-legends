/**
 * Session nicknames → real player names.
 * Shared by dashboard, score entry, and Node import scripts.
 */
const NICKNAME_TO_PLAYER = {
  SHREKK: 'Mattheus',
  MATE: 'Mattheus',
  MA: 'Mattheus',
  MAP: 'Mattheus',
  MAE: 'Mattheus',
  MEH: 'Mattheus',
  MAFUS: 'Shelley',
  SHRIMP: 'Shelley',
  SHEL: 'Shelley',
  SHE: 'Shelley',
  WIMBY: 'Shelley',
  EMLIE: 'Emily',
  EH: 'Emily',
};

function resolvePlayerFromNickname(nickname) {
  const key = String(nickname || '').trim().toUpperCase();
  return NICKNAME_TO_PLAYER[key] || null;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { NICKNAME_TO_PLAYER, resolvePlayerFromNickname };
}
