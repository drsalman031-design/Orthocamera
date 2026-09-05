/**
 * VoiceGuidanceEngine.ts
 *
 * Real-time spoken clinical audio guidance using browser SpeechSynthesis API.
 * Provides clear auditory directional prompts so the clinician can focus on patient
 * positioning without watching the screen constantly.
 *
 * Features:
 * - Intelligent phrase mapping and debouncing (minimum interval 1800ms)
 * - Urgent priority override for "Hold still" and "Captured"
 * - Automatically cancels outdated speech utterances to prevent queue buildup
 */

import { LiveGuidanceState } from '../types';

export class VoiceGuidanceEngine {
  private isEnabled: boolean = false;
  private lastSpokenCue: string = '';
  private lastSpokenTime: number = 0;
  private minIntervalMs: number = 1800; // Debounce normal directional cues
  private synth: SpeechSynthesis | null = null;
  private selectedVoice: SpeechSynthesisVoice | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
      this.initVoice();
    }
  }

  private initVoice(): void {
    if (!this.synth) return;
    const loadVoices = () => {
      const voices = this.synth?.getVoices() || [];
      // Prefer clean English voice
      const preferred =
        voices.find((v) => v.lang.startsWith('en') && /natural|google|samantha|karen/i.test(v.name)) ||
        voices.find((v) => v.lang.startsWith('en')) ||
        voices[0] ||
        null;
      this.selectedVoice = preferred;
    };

    loadVoices();
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = loadVoices;
    }
  }

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    if (!enabled && this.synth) {
      this.synth.cancel();
    }
  }

  public getIsEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Evaluates current guidance and delivers spoken cue if appropriate.
   */
  public update(guidance: LiveGuidanceState, now: number = Date.now()): void {
    if (!this.isEnabled || !this.synth) return;

    // 1. Determine spoken cue from primary message or rejection reason
    let cue = '';
    const isUrgent = guidance.isReady || guidance.guidanceStage === 'CAPTURED';

    if (guidance.guidanceStage === 'CAPTURED') {
      cue = 'Photo captured';
    } else if (guidance.isReady || guidance.guidanceStage === 'STABILITY_CONFIRMATION') {
      cue = 'Hold still';
    } else if (guidance.rejectionReason) {
      cue = this.normalizeRejectionToSpeech(guidance.rejectionReason);
    } else if (guidance.highestPriorityCorrection) {
      cue = this.normalizeCorrectionToSpeech(guidance.highestPriorityCorrection);
    }

    if (!cue) return;

    // 2. Debounce identical or frequent phrases
    const isSameAsLast = cue === this.lastSpokenCue;
    const timeSinceLast = now - this.lastSpokenTime;

    if (isSameAsLast && timeSinceLast < 4500) {
      return; // Do not repeat identical cue within 4.5s
    }

    if (!isUrgent && timeSinceLast < this.minIntervalMs) {
      return; // Debounce non-urgent directional adjustments
    }

    this.speak(cue, isUrgent);
    this.lastSpokenCue = cue;
    this.lastSpokenTime = now;
  }

  public speakImmediate(phrase: string): void {
    if (!this.isEnabled || !this.synth) return;
    this.speak(phrase, true);
  }

  private speak(text: string, urgent: boolean = false): void {
    if (!this.synth) return;

    try {
      if (urgent || this.synth.speaking) {
        this.synth.cancel(); // Stop current speech to deliver latest prompt
      }

      const utterance = new SpeechSynthesisUtterance(text);
      if (this.selectedVoice) {
        utterance.voice = this.selectedVoice;
      }
      utterance.rate = 1.05; // Slightly brisk for clinical cadence
      utterance.pitch = 1.0;
      utterance.volume = 0.9;
      this.synth.speak(utterance);
    } catch {
      // Audio permission or browser restriction
    }
  }

  private normalizeRejectionToSpeech(reason: string): string {
    const r = reason.toLowerCase();
    if (r.includes('closer')) return 'Move closer';
    if (r.includes('back')) return 'Move back';
    if (r.includes('right')) {
      return r.includes('turn') ? 'Turn right' : 'Move right';
    }
    if (r.includes('left')) {
      return r.includes('turn') ? 'Turn left' : 'Move left';
    }
    if (r.includes('level') || r.includes('tilt')) return 'Level head';
    if (r.includes('raise chin') || r.includes('chin up')) return 'Raise chin';
    if (r.includes('lower chin') || r.includes('chin down')) return 'Lower chin';
    if (r.includes('smile')) return 'Smile naturally';
    if (r.includes('motion') || r.includes('steady')) return 'Hold steady';
    if (r.includes('focus') || r.includes('blurry')) return 'Hold steady to focus';
    if (r.includes('dark')) return 'Needs more light';
    if (r.includes('guide') || r.includes('align')) return 'Align face in guide';
    return reason;
  }

  private normalizeCorrectionToSpeech(msg: string): string {
    const m = msg.toUpperCase();
    if (m.includes('MOVE CLOSER')) return 'Move closer';
    if (m.includes('MOVE BACK')) return 'Move back';
    if (m.includes('MOVE RIGHT')) return 'Move right';
    if (m.includes('MOVE LEFT')) return 'Move left';
    if (m.includes('MOVE UP')) return 'Move up';
    if (m.includes('MOVE DOWN')) return 'Move down';
    if (m.includes('TURN RIGHT')) return 'Turn right';
    if (m.includes('TURN LEFT')) return 'Turn left';
    if (m.includes('LEVEL HEAD')) return 'Level head';
    if (m.includes('RAISE CHIN')) return 'Raise chin';
    if (m.includes('LOWER CHIN')) return 'Lower chin';
    if (m.includes('SMILE')) return 'Smile';
    if (m.includes('HOLD STILL')) return 'Hold still';
    return msg;
  }

  public stop(): void {
    if (this.synth) {
      this.synth.cancel();
    }
  }
}

export const VoiceGuidance = new VoiceGuidanceEngine();
