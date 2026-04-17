const SOUND_URL = "/sounds/crm-inquiry-notify.wav";

let audio: HTMLAudioElement | null = null;

export function playCrmNewInquirySound(): void {
  if (typeof window === "undefined") return;
  try {
    if (!audio) {
      audio = new Audio(SOUND_URL);
      audio.preload = "auto";
      audio.volume = 0.32;
    }
    audio.pause();
    audio.currentTime = 0;
    void audio.play().catch(() => {
      /* autopolicy or missing file — ignore */
    });
  } catch {
    /* ignore */
  }
}
