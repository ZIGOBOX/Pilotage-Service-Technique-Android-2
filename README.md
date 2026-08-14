# Pilotage Service Technique — Android

Application Android dédiée qui ouvre :
https://zigobox.github.io/service-Technique-2/

Fonctions :
- ouvre Pilotage Service Technique en plein écran WebView ;
- lit uniquement le calendrier Android professionnel dont le compte contient `auvergnerhonealpes.fr` ;
- importe automatiquement les rendez-vous Outlook dans `personalEvents` de l'application web ;
- conserve date, heure, objet, lieu et description ;
- utilise l'identifiant Outlook pour éviter les doublons à chaque synchronisation ;
- enregistre ensuite via le mécanisme Supabase déjà présent dans Pilotage Service Technique ;
- remplace `window.print()` par l'impression Android native ;
- accepte les sélecteurs de fichiers du site.

## Compilation sans PC

Le workflow GitHub Actions `.github/workflows/build-apk.yml` compile automatiquement l'APK à chaque mise à jour du dépôt.
Dans GitHub : Actions > Construire APK Android > Run workflow, puis télécharger l'artifact `Pilotage-Service-Technique-APK`.
