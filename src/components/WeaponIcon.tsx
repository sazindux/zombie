import type { WeaponId } from '../game/types';

export function WeaponIcon({ id, className = '' }: { id: WeaponId; className?: string }) {
  return (
    <svg viewBox="0 0 64 24" className={className} fill="currentColor" aria-hidden>
      {id === 'pistol' && (
        <>
          <rect x="18" y="6" width="30" height="6" rx="1.5" />
          <rect x="20" y="11" width="9" height="11" rx="1.5" transform="rotate(8 24 16)" />
          <rect x="46" y="7" width="5" height="3" />
        </>
      )}
      {id === 'smg' && (
        <>
          <rect x="10" y="6" width="38" height="7" rx="1.5" />
          <rect x="46" y="8" width="12" height="3" />
          <rect x="26" y="12" width="6" height="11" rx="1" />
          <rect x="16" y="12" width="6" height="7" rx="1" transform="rotate(12 19 15)" />
          <rect x="4" y="7" width="8" height="4" />
        </>
      )}
      {id === 'shotgun' && (
        <>
          <rect x="2" y="9" width="16" height="6" rx="2" />
          <rect x="16" y="8" width="44" height="4" rx="1" />
          <rect x="20" y="12" width="26" height="4" rx="1" />
          <rect x="28" y="12" width="8" height="8" rx="1" opacity=".8" />
        </>
      )}
      {id === 'rifle' && (
        <>
          <rect x="2" y="8" width="16" height="7" rx="2" />
          <rect x="16" y="8" width="32" height="5" rx="1" />
          <rect x="46" y="9" width="16" height="2.5" />
          <path d="M26 13 q2 10 8 9 l2 -2 q-3 -2 -3 -7z" />
          <rect x="20" y="13" width="6" height="8" rx="1" />
        </>
      )}
      {id === 'sniper' && (
        <>
          <rect x="1" y="9" width="16" height="6" rx="2" />
          <rect x="15" y="9" width="46" height="3" rx="1" />
          <rect x="24" y="4" width="16" height="4" rx="2" />
          <rect x="30" y="7" width="2" height="3" />
          <rect x="17" y="12" width="8" height="8" rx="1" />
          <rect x="52" y="12" width="2" height="8" />
        </>
      )}
      {id === 'launcher' && (
        <>
          <rect x="6" y="6" width="50" height="9" rx="3" />
          <rect x="54" y="4" width="8" height="13" rx="2" />
          <rect x="22" y="14" width="6" height="9" rx="1" />
          <rect x="36" y="2" width="6" height="5" />
          <circle cx="10" cy="10.5" r="3" opacity=".6" />
        </>
      )}
    </svg>
  );
}
