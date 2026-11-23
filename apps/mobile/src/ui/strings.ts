/**
 * English copy in one module so a later i18n pass can replace it.
 * The location explainer is interim until worksheet 6.4.
 */
export const strings = {
  chronicle: "Chronicle",
  embark: "Embark",
  journal: "Journal",
  settings: "Settings",
  appearance: "Appearance",
  matchStory: "Match the story's day and night",
  followPhone: "Follow my phone",
  settingsLater: "Mixer, Hush, downloads, and privacy land in later milestones.",
  chronicleLater: "The Chronicle opens after a story has been heard on site.",
  embarkLater: "Embark opens in a later milestone.",
  journalLater: "The Journal opens in a later milestone.",
  devData: "Data layer",
  devAudio: "Audio spike",
  devWordmark: "dev",
  /** Interim, until worksheet 6.4 replaces this explainer. */
  locationExplainer:
    "This app uses your location while it is open, so a story can start when you arrive. Your location stays on this phone.",
  locationContinue: "Continue",
  recenter: "Recenter on your location",
  settingsButton: "Settings",
  groveChip: "Grove",
  scanHere: "Scan the code here to listen.",
  closeCard: "Close",
  installDemo: "Install demo grove",
  installStress: "Install 300-marker grove",
} as const;
