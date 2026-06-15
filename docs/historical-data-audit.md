# Historical Data Audit

Generated: 2026-06-15 00:28 UTC
Source: `data/scores.csv`

## Summary

- **Player rows:** 110
- **Distinct games:** 48
- **Invalid (red):** 0
- **Suspicious (yellow):** 0
- **Score mismatches:** 0
- **Duplicate player keys:** 0

## Recommendations

- Review nickname rows in the audit — add aliases to both nickname maps, or confirm `player` column is authoritative for historical typos (e.g. swapped SHREKK/MAFUS).

## Invalid rows

_None._

## Suspicious rows

_None._

## Score mismatches

_None._

## Duplicate players in same game

_None._

## Duplicate / crowded games

_None._

## Missing metadata

_None._

## Nickname inconsistencies

- Row 2 (game_id=game-1, SHREKK): nickname 'SHREKK' resolves to 'Mattheus' but player is 'Shelley'
- Row 4 (game_id=game-1, MAFUS): nickname 'MAFUS' resolves to 'Shelley' but player is 'Mattheus'
- Row 5 (game_id=mqbakl1mgdoaf, SHREKK): nickname 'SHREKK' resolves to 'Mattheus' but player is 'Shelley'
- Row 7 (game_id=mqbakl1mgdoaf, MAFUS): nickname 'MAFUS' resolves to 'Shelley' but player is 'Mattheus'
- Row 30 (game_id=mqcnlchpycw92, SHALL): unknown nickname 'SHALL'
- Row 31 (game_id=mqcnlchpycw92, MILEF): unknown nickname 'MILEF'
- Row 32 (game_id=mqcnlchpycw92, EMLOO): unknown nickname 'EMLOO'
- Row 33 (game_id=mqcno4yzygi4v, SHALL): unknown nickname 'SHALL'
- Row 34 (game_id=mqcno4yzygi4v, MILEF): unknown nickname 'MILEF'
- Row 35 (game_id=mqcno4yzygi4v, EMLOO): unknown nickname 'EMLOO'
- Row 36 (game_id=mqcny2qr0cy7j, CHIP): unknown nickname 'CHIP'
- Row 37 (game_id=mqcny2qr0cy7j, MERP): unknown nickname 'MERP'
- Row 38 (game_id=mqco5i8ce3ki9, CHIP): unknown nickname 'CHIP'
- Row 39 (game_id=mqco5i8ce3ki9, MERP): unknown nickname 'MERP'
- Row 40 (game_id=mqco9wkqijtym, MILK): unknown nickname 'MILK'
- Row 41 (game_id=mqco9wkqijtym, MORK): unknown nickname 'MORK'
- Row 42 (game_id=mqcoc4yy9wga0, MILK): unknown nickname 'MILK'
- Row 43 (game_id=mqcoc4yy9wga0, MORK): unknown nickname 'MORK'
- Row 44 (game_id=a4h0fmxzdrk, MAH): unknown nickname 'MAH'
- Row 45 (game_id=a4h0fmxzdrk, SOUP): unknown nickname 'SOUP'
- Row 46 (game_id=nx0v0b5qwy, MAH): unknown nickname 'MAH'
- Row 47 (game_id=nx0v0b5qwy, SOUP): unknown nickname 'SOUP'
- Row 48 (game_id=guq0hovhrls, EEB): unknown nickname 'EEB'
- Row 49 (game_id=guq0hovhrls, SHEEM): unknown nickname 'SHEEM'
- Row 50 (game_id=guq0hovhrls, MATTY): unknown nickname 'MATTY'
- Row 51 (game_id=jr6bmkis5ko, EEB): unknown nickname 'EEB'
- Row 52 (game_id=jr6bmkis5ko, SHEEM): unknown nickname 'SHEEM'
- Row 53 (game_id=jr6bmkis5ko, MATTY): unknown nickname 'MATTY'
- Row 54 (game_id=dat1wxcahuq, MATH): unknown nickname 'MATH'
- Row 55 (game_id=dat1wxcahuq, SCI): unknown nickname 'SCI'
- Row 56 (game_id=jdklb2ds1pm, MATH): unknown nickname 'MATH'
- Row 57 (game_id=jdklb2ds1pm, SCI): unknown nickname 'SCI'
- Row 58 (game_id=peovxbcsao, MATH): unknown nickname 'MATH'
- Row 59 (game_id=peovxbcsao, SUSS): unknown nickname 'SUSS'
- Row 60 (game_id=mmcoe0czuqm, MATH): unknown nickname 'MATH'
- Row 61 (game_id=mmcoe0czuqm, SUSS): unknown nickname 'SUSS'
- Row 62 (game_id=tmfujkx1y9w, SHAM): unknown nickname 'SHAM'
- Row 63 (game_id=tmfujkx1y9w, MOP): unknown nickname 'MOP'
- Row 64 (game_id=8p7pqxm33s, SHAN): unknown nickname 'SHAN'
- Row 65 (game_id=8p7pqxm33s, MOP): unknown nickname 'MOP'
- Row 66 (game_id=g3rsl156i84, MOTHB): unknown nickname 'MOTHB'
- Row 67 (game_id=g3rsl156i84, ELERT): unknown nickname 'ELERT'
- Row 68 (game_id=g3rsl156i84, SHHHH): unknown nickname 'SHHHH'
- Row 69 (game_id=2ords7l5sas, MOTHB): unknown nickname 'MOTHB'
- Row 70 (game_id=2ords7l5sas, ELERT): unknown nickname 'ELERT'
- Row 71 (game_id=2ords7l5sas, SHHHH): unknown nickname 'SHHHH'
- Row 72 (game_id=ovsdlyxhyw8, M): unknown nickname 'M'
- Row 73 (game_id=cxec07jfiq, M): unknown nickname 'M'
- Row 74 (game_id=jvkjwlesmci, MARK): unknown nickname 'MARK'
- Row 75 (game_id=jvkjwlesmci, SHEILA): unknown nickname 'SHEILA'
- Row 76 (game_id=4z2fzeayqbu, MARK): unknown nickname 'MARK'
- Row 77 (game_id=4z2fzeayqbu, SHEILA): unknown nickname 'SHEILA'
- Row 78 (game_id=xwlg8mdsrg, MARLE): unknown nickname 'MARLE'
- Row 79 (game_id=xwlg8mdsrg, SHAM): unknown nickname 'SHAM'
- Row 80 (game_id=eodb5kew7ky, MARLE): unknown nickname 'MARLE'
- Row 81 (game_id=eodb5kew7ky, SHAM): unknown nickname 'SHAM'
- Row 82 (game_id=y48w5mgrtto, ERSH): unknown nickname 'ERSH'
- Row 83 (game_id=y48w5mgrtto, MERSH): unknown nickname 'MERSH'
- Row 84 (game_id=y48w5mgrtto, SHERSH): unknown nickname 'SHERSH'
- Row 85 (game_id=yupf7ug96te, ERSH): unknown nickname 'ERSH'
- Row 86 (game_id=yupf7ug96te, MERS): unknown nickname 'MERS'
- Row 87 (game_id=yupf7ug96te, SHERSH): unknown nickname 'SHERSH'
- Row 88 (game_id=9dxhkrdjgr0, MOP): unknown nickname 'MOP'
- Row 89 (game_id=9dxhkrdjgr0, SLUMP): unknown nickname 'SLUMP'
- Row 90 (game_id=j1qsfzasc, MOP): unknown nickname 'MOP'
- Row 91 (game_id=j1qsfzasc, SLUMP): unknown nickname 'SLUMP'
- Row 92 (game_id=nurl07ryllq, MERLIN): unknown nickname 'MERLIN'
- Row 93 (game_id=nurl07ryllq, EDWIN): unknown nickname 'EDWIN'
- Row 94 (game_id=nurl07ryllq, SHERWI): unknown nickname 'SHERWI'
- Row 95 (game_id=ddhubxn8yhy, MERLIN): unknown nickname 'MERLIN'
- Row 96 (game_id=ddhubxn8yhy, EDWIN): unknown nickname 'EDWIN'
- Row 97 (game_id=ddhubxn8yhy, SHERWI): unknown nickname 'SHERWI'
- Row 98 (game_id=qfyr14clohs, MOOO): unknown nickname 'MOOO'
- Row 99 (game_id=qfyr14clohs, SQUA): unknown nickname 'SQUA'
- Row 100 (game_id=hdgblhukryi, MOOO): unknown nickname 'MOOO'
- Row 101 (game_id=hdgblhukryi, SQUA): unknown nickname 'SQUA'
- Row 102 (game_id=eqaaf8hzs, MELVIN): unknown nickname 'MELVIN'
- Row 103 (game_id=eqaaf8hzs, EMT): unknown nickname 'EMT'
- Row 104 (game_id=eqaaf8hzs, SARCO): unknown nickname 'SARCO'
- Row 105 (game_id=h2idotvfhas, MELVIN): unknown nickname 'MELVIN'
- Row 106 (game_id=h2idotvfhas, EMT): unknown nickname 'EMT'
- Row 107 (game_id=h2idotvfhas, SARCO): unknown nickname 'SARCO'
- Row 108 (game_id=kpdl9ahdotk, SUS): unknown nickname 'SUS'
- Row 109 (game_id=kpdl9ahdotk, MUSK): unknown nickname 'MUSK'
- Row 110 (game_id=rx3hn1aiay, SUS): unknown nickname 'SUS'
- Row 111 (game_id=rx3hn1aiay, MUSK): unknown nickname 'MUSK'

## Notes

- This audit is **read-only** — no data was modified.
- Validation uses `tools/bowling_utils.validate_player_row` (Python canonical validator).
- JS scoring is cross-checked in CI via `tests/golden_games.json`.
