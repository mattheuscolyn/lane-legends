/**
 * Resolve session nicknames to real player names.
 * Mattheus, Shelley, and Emily each use multiple alter egos per session.
 */
const NICKNAME_TO_PLAYER = {
  // Mattheus
  SHREKK: 'Mattheus',
  MATE: 'Mattheus',
  MA: 'Mattheus',
  MAP: 'Mattheus',
  MAE: 'Mattheus',
  MEH: 'Mattheus',
  // Shelley
  MAFUS: 'Shelley',
  SHRIMP: 'Shelley',
  SHEL: 'Shelley',
  SHE: 'Shelley',
  WIMBY: 'Shelley',
  // Emily
  EMLIE: 'Emily',
  EH: 'Emily',
};

function resolvePlayerFromNickname(nickname) {
  const key = String(nickname || '').trim().toUpperCase();
  return NICKNAME_TO_PLAYER[key] || null;
}

module.exports = { NICKNAME_TO_PLAYER, resolvePlayerFromNickname };
