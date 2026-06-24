import { generateTTS } from './api';

class VoiceService {
  constructor() {
    this.isListening  = false;
    this.isSpeaking   = false;
    this.isPaused     = false; // Sleep Mode Support
    this.recognition  = null;
    this.onUserSpeech = null;
    this.currentAudio = null;
    this.cachedVoice  = null;

    // Language: 'en-IN' or 'hi-IN'
    this.language = 'en-IN';

    this.init();
  }

  // ─── LANGUAGE SWITCHING ──────────────────────────────────────────────────────
  setLanguage(lang) {
    if (lang === 'hi' || lang === 'hi-IN') {
      this.language = 'hi-IN';
      console.log('🌐 [VoiceService] Language → Hindi (hi-IN)');
    } else {
      this.language = 'en-IN';
      console.log('🌐 [VoiceService] Language → English (en-IN)');
    }
    if (this.recognition) this.recognition.lang = this.language;
    this.cachedVoice = null;
  }

  getLanguage() { return this.language; }
  isHindi()     { return this.language === 'hi-IN'; }

  detectLanguage(text) {
    if (!text) return 'en-IN';
    const devanagari = (text.match(/[\u0900-\u097F]/g) || []).length;
    const total      = text.replace(/\s/g, '').length;
    return (total > 0 && devanagari / total > 0.3) ? 'hi-IN' : 'en-IN';
  }

  // ─── SPEECH RECOGNITION INIT ─────────────────────────────────────────────────
  init() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.recognition = new SpeechRecognition();
      this.recognition.continuous      = true;
      this.recognition.interimResults  = false;
      this.recognition.lang            = this.language;
      this.recognition.maxAlternatives = 1;

      this.recognition.onstart = () => {
        console.log('🎤 [VoiceService] Listening started');
        this.isListening = true;
      };

      this.recognition.onresult = (event) => {
        const current = event.resultIndex;
        const transcript = event.results[current][0].transcript.trim();
        console.log('🗣️ [VoiceService] User said:', transcript);
        if (transcript && this.onUserSpeech) {
          this.onUserSpeech(transcript);
        }
      };

      this.recognition.onerror = (event) => {
        console.error('🎤 [VoiceService] Recognition error:', event.error);
        this.isListening = false;
        if ((event.error === 'no-speech' || event.error === 'audio-capture') && !this.isSpeaking) {
          setTimeout(() => this.restartListening(), 2000);
        }
      };

      this.recognition.onend = () => {
        console.log('🎤 [VoiceService] Recognition ended');
        this.isListening = false;
        if (!this.isSpeaking && this.onUserSpeech) {
          setTimeout(() => this.restartListening(), 1000);
        }
      };
    } else {
      console.warn('⚠️ [VoiceService] Speech recognition not supported in this browser');
    }
  }

  // ─── MALE VOICE DETECTION (browser TTS fallback only) ───────────────────────
  isMaleVoice(voice) {
    if (voice.gender && voice.gender.toLowerCase() === 'male') return true;
    const maleNames = [
      'david','mark','james','daniel','alex','george','fred','tom','mike',
      'richard','paul','eric','aaron','brian','carlos','diego','luca','marco',
      'oliver','william','arthur','rishi','raj','arjun','vikram','rahul','amit',
      'suresh','ramesh','mahesh','rohan','nikhil','guy','lee','ryan','chris',
      'peter','john','robert','michael','nathan','sean','reed','eddy','neel','ravi','aarav'
    ];
    const n = voice.name.toLowerCase();
    if (maleNames.some(m => n.includes(m))) return true;
    if (/\bmale\b/i.test(voice.name)) return true;
    return false;
  }

  // ─── PICK FEMALE VOICE (browser TTS fallback only) ───────────────────────────
  pickFemaleVoice() {
    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return null;

    const indianFemale  = ['veena','heera','priya','divya','aditi','raveena','sunita','lekha','neerja','kajal','tanvee','latha'];
    const westernFemale = ['samantha','karen','moira','tessa','fiona','victoria','allison','ava','susan','linda','lisa','kathy','kate','catherine','julie','joanna','salli','ivy','kendra','kimberly','aria','jenny','michelle','hazel','natasha','zira','cortana'];

    const t1 = voices.find(v => v.lang === 'en-IN' && /female|woman|girl|lady/i.test(v.name) && !this.isMaleVoice(v));
    if (t1) return t1;
    const t2 = voices.find(v => indianFemale.some(n => v.name.toLowerCase().includes(n)) && !this.isMaleVoice(v));
    if (t2) return t2;
    const t3 = voices.find(v => v.lang === 'en-IN' && !this.isMaleVoice(v));
    if (t3) return t3;
    const t4 = voices.find(v => westernFemale.some(n => v.name.toLowerCase().includes(n)) && !this.isMaleVoice(v));
    if (t4) return t4;
    const t5 = voices.find(v => v.lang.startsWith('en') && /female|woman|girl/i.test(v.name) && !this.isMaleVoice(v));
    if (t5) return t5;
    const t6 = voices.find(v => v.lang.startsWith('en') && !this.isMaleVoice(v));
    if (t6) return t6;
    return voices.find(v => !this.isMaleVoice(v)) || voices[0] || null;
  }

  // ─── NUMBER TO WORDS ─────────────────────────────────────────────────────────
  numberToWords(num) {
    if (isNaN(num)) return String(num);
    const n = parseFloat(num);
    const ones = ['','one','two','three','four','five','six','seven','eight','nine',
      'ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];
    const tens = ['','','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'];

    const below1000 = (x) => {
      if (x === 0) return '';
      if (x < 20)  return ones[x];
      if (x < 100) return tens[Math.floor(x/10)] + (x%10 ? ' '+ones[x%10] : '');
      return ones[Math.floor(x/100)] + ' hundred' + (x%100 ? ' and '+below1000(x%100) : '');
    };

    if (n === 0) return 'zero';
    if (n < 0)   return 'minus ' + this.numberToWords(Math.abs(n));
    if (!Number.isInteger(n)) {
      const parts = String(n).split('.');
      const dec   = parts[1].split('').map(d => ones[parseInt(d)] || 'zero').join(' ');
      return this.numberToWords(parseInt(parts[0])) + ' point ' + dec;
    }
    if (n >= 10000000) return below1000(Math.floor(n/10000000)) + ' crore'    + (n%10000000 ? ' '+this.numberToWords(n%10000000) : '');
    if (n >= 100000)   return below1000(Math.floor(n/100000))   + ' lakh'     + (n%100000   ? ' '+this.numberToWords(n%100000)   : '');
    if (n >= 1000)     return below1000(Math.floor(n/1000))     + ' thousand' + (n%1000     ? ' '+below1000(n%1000)              : '');
    return below1000(n);
  }

  // ─── INDIAN WORD PHONETICS ───────────────────────────────────────────────────
  applyIndianPhonetics(text) {
    const map = {
      'namaste':'nuh-muh-stay','namaskar':'nuh-muh-skaar',
      'ji':'jee','bhai':'b-high','didi':'dee-dee',
      'chacha':'chaa-chaa','chachi':'chaa-chee',
      'nana':'naa-naa','nani':'naa-nee','dada':'daa-daa','dadi':'daa-dee',
      'beti':'bay-tee','beta':'bay-taa',
      'accha':'ach-chaa','acha':'ach-chaa','achha':'ach-chaa',
      'theek hai':'theek hey','theek':'theek',
      'bilkul':'bil-kul','bahut':'buh-hut',
      'haan':'haan','nahin':'nuh-heen',
      'kya':'kyaa','aap':'aap','tum':'tum','yaar':'yaar','arre':'uh-ray',
      'roti':'row-tee','daal':'daal','dal':'daal','sabzi':'sub-zee',
      'chai':'chaa-ee','lassi':'lus-see','paneer':'puh-neer','ghee':'ghee',
      'masala':'muh-saa-laa','biryani':'bir-yaa-nee','paratha':'puh-raa-thaa',
      'puri':'poo-ree','halwa':'hul-vaa','mithai':'mit-high',
      'khichdi':'khich-dee','samosa':'suh-mow-saa','chutney':'chut-nee',
      'mumbai':'mum-buy','delhi':'del-ee',
      'bengaluru':'ben-guh-loo-roo','bangalore':'bang-uh-lore',
      'chennai':'chen-nigh','kolkata':'kol-kaa-taa',
      'hyderabad':'high-duh-ruh-baad','pune':'poo-nay',
      'ahmedabad':'ah-med-uh-baad','jaipur':'jy-poor',
      'lucknow':'luck-now','varanasi':'vuh-raa-nuh-see',
      'agra':'aa-graa','goa':'go-uh',
      'rupee':'roo-pee','rupees':'roo-peez','paise':'pie-say',
      'sharma':'shaar-maa','gupta':'gup-taa','verma':'ver-maa',
      'singh':'sing','patel':'puh-tel','kumar':'koo-maar',
      'devi':'day-vee','laxmi':'luck-shmee','lakshmi':'luck-shmee',
      'ganesh':'guh-naysh','krishna':'krish-nuh','rama':'raa-maa',
    };
    let t = text;
    Object.entries(map).forEach(([w, p]) => {
      const esc = w.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
      t = t.replace(new RegExp('\\b'+esc+'\\b','gi'), p);
    });
    return t;
  }

  // ─── TEXT PREPROCESSING ──────────────────────────────────────────────────────
  preprocessTextForSpeech(text) {
    if (!text) return '';
    let t = text;

    t = t.replace(/\*\*(.*?)\*\*/g,'$1').replace(/\*(.*?)\*/g,'$1')
         .replace(/`(.*?)`/g,'$1').replace(/#{1,6}\s/g,'');
    t = t.replace(/[\u{1F300}-\u{1FAFF}]/gu,'').replace(/[\u{2600}-\u{27BF}]/gu,'');

    t = t.replace(/₹\s?(\d[\d,]*\.?\d*)/g, (_,n) => this.numberToWords(parseFloat(n.replace(/,/g,''))) + ' rupees');
    t = t.replace(/\$\s?(\d[\d,]*\.?\d*)/g, (_,n) => this.numberToWords(parseFloat(n.replace(/,/g,''))) + ' dollars');
    t = t.replace(/(\d+\.?\d*)%/g, (_,n) => this.numberToWords(parseFloat(n)) + ' percent');

    t = t.replace(/\b(\d+)(st|nd|rd|th)\b/gi, (_,n) => {
      const m = {'1':'first','2':'second','3':'third','4':'fourth','5':'fifth',
                 '6':'sixth','7':'seventh','8':'eighth','9':'ninth','10':'tenth',
                 '11':'eleventh','12':'twelfth'};
      return m[n] || this.numberToWords(parseInt(n)) + 'th';
    });

    t = t.replace(/\b(\d{1,2}):(\d{2})\s?(AM|PM|am|pm)?\b/g, (_,h,m,ap) => {
      const hw = this.numberToWords(parseInt(h));
      const mw = m==='00' ? "o'clock" : parseInt(m)<10
        ? 'oh '+this.numberToWords(parseInt(m)) : this.numberToWords(parseInt(m));
      return hw+' '+mw+(ap?' '+ap.toLowerCase():'');
    });

    t = t.replace(/\b(\d{1,3}(?:,\d{3})+)\b/g, m => this.numberToWords(parseInt(m.replace(/,/g,''))));
    t = t.replace(/\b(\d+\.\d+)\b/g, (_,n) => this.numberToWords(parseFloat(n)));
    t = t.replace(/\b(\d+)\b/g, (_,n) => this.numberToWords(parseInt(n)));

    t = this.applyIndianPhonetics(t);

    const abbr = {
      'Dr.':'Doctor','Mr.':'Mister','Mrs.':'Missus','Ms.':'Miss',
      'Prof.':'Professor','Sr.':'Senior','Jr.':'Junior',
      'e.g.':'for example','i.e.':'that is','etc.':'and so on',
      'vs.':'versus','approx.':'approximately','dept.':'department',
      'govt.':'government','max.':'maximum',
      'km':'kilometres','kg':'kilograms','mg':'milligrams',
      'ml':'millilitres','lt':'litres','hr':'hours','hrs':'hours',
    };
    Object.entries(abbr).forEach(([k,v]) => {
      const esc = k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      t = t.replace(new RegExp('(?<![\\w])'+esc+'(?![\\w])','g'), v);
    });

    const contractions = {
      "don't":"do not","doesn't":"does not","can't":"cannot","won't":"will not",
      "I'm":"I am","I've":"I have","I'll":"I will","I'd":"I would",
      "you're":"you are","you've":"you have","you'll":"you will","you'd":"you would",
      "it's":"it is","it'll":"it will","that's":"that is","there's":"there is",
      "they're":"they are","they've":"they have","we're":"we are","we've":"we have",
      "we'll":"we will","let's":"let us","isn't":"is not","aren't":"are not",
      "wasn't":"was not","weren't":"were not","hasn't":"has not",
      "haven't":"have not","hadn't":"had not","couldn't":"could not",
      "shouldn't":"should not","wouldn't":"would not"
    };
    Object.entries(contractions).forEach(([k,v]) => {
      t = t.replace(new RegExp('\\b'+k.replace(/'/g,"'")+'\\b','gi'), v);
    });

    const interjections = [
      'hush','shh','shhh','alas','oh dear','oh no','oh my','oh','ah','hmm',
      'well','now','right','so','you see','of course','certainly','absolutely',
      'indeed','now then','come now','there there','goodness','my goodness','dear me','arre'
    ];
    interjections.forEach(w => {
      const esc = w.replace(/\s/g,'\\s');
      t = t.replace(new RegExp('\\b('+esc+')\\b(?![,\\.!?])','gi'),'$1,');
    });

    t = t.replace(/,\s*,/g,',').replace(/\s{2,}/g,' ');
    return t.trim();
  }

  // ─── SENTENCE SPLITTING & PAUSE ──────────────────────────────────────────────
  splitIntoSentences(text) {
    return text.split(/(?<=[.!?…])\s+/).map(s => s.trim()).filter(Boolean);
  }

  pauseAfterSentence(sentence) {
    if (/[.…]$/.test(sentence))  return 480;
    if (/[!]$/.test(sentence))   return 400;
    if (/[?]$/.test(sentence))   return 530;
    if (/[,;—]$/.test(sentence)) return 220;
    return 340;
  }

  // ─── MAIN SPEAK ENTRY ────────────────────────────────────────────────────────
  async speak(text, onEnd = null) {
    if (!text) { if (onEnd) onEnd(); return; }

    console.log('[VoiceService] speak() called');
    console.log('[VoiceService] Text:', text.substring(0, 80));

    await this.stopSpeaking();
    this.stopListening();
    this.isSpeaking = true;

    const detected = this.detectLanguage(text);
    if (detected !== this.language) {
      console.log('[VoiceService] Auto-switching language to:', detected);
      this.setLanguage(detected);
    }

    // Hindi → send raw (Gemini handles Devanagari natively)
    // English → preprocess for natural speech
    const cleaned = this.isHindi() ? text.trim() : this.preprocessTextForSpeech(text);

    try {
      const success = await this.speakWithGemini(cleaned, onEnd);
      if (success) return;
      console.warn('[VoiceService] Backend TTS failed — falling back to browser TTS');
      this.speakWithBrowser(cleaned, onEnd);
    } catch (error) {
      console.error('[VoiceService] speak() error:', error);
      this.isSpeaking = false;
      this.speakWithBrowser(cleaned, onEnd);
    }
  }

  // ─── GEMINI TTS WITH AUTO KEY ROTATION ───────────────────────────────────────
  // Voice: Kore — warm, soft, female, Indian-accented
  // Other female voices: 'Aoede', 'Leda', 'Zephyr'
  //
  // Gemini returns raw PCM (audio/L16) — converted to WAV before playback.
  // On 429: automatically rotates to the next key and retries once.
  // On all keys exhausted: returns false → browser TTS fallback kicks in.
  async speakWithGemini(text, onEnd = null) {
    const voiceName = 'Kore';
    const langCode = this.language;

    console.log(`[VoiceService] Gemini TTS (via Backend) — voice: ${voiceName}, lang: ${langCode}`);

    try {
      const data = await generateTTS(text, langCode, voiceName);
      
      if (!data || !data.success || !data.audioData) {
        console.warn('[VoiceService] Backend TTS failed or returned no audio');
        return false;
      }


      const mimeType = data.mimeType || 'audio/mp3';
      const audioData = data.audioData;

      // ── KEY FIX: Convert raw PCM (audio/L16) → WAV so browser can play it ────
      let audioBlob;
      if (mimeType.includes('L16') || mimeType.includes('pcm')) {
        const rateMatch  = mimeType.match(/rate=(\d+)/);
        const sampleRate = rateMatch ? parseInt(rateMatch[1]) : 24000;
        console.log('[VoiceService] PCM → WAV conversion. Sample rate:', sampleRate);
        audioBlob = this.pcmBase64ToWavBlob(audioData, sampleRate);
      } else {
        audioBlob = this.base64ToBlob(audioData, mimeType);
      }

      const audioUrl = URL.createObjectURL(audioBlob);
      this.currentAudio = new Audio(audioUrl);

      return new Promise((resolve) => {
        this.currentAudio.onplay = () =>
          console.log(`▶️ [VoiceService] Gemini playing — ${voiceName}`);

        this.currentAudio.onended = () => {
          console.log('✅ [VoiceService] Gemini audio finished');
          this.isSpeaking = false;
          URL.revokeObjectURL(audioUrl);
          if (onEnd) onEnd();
          setTimeout(() => {
            if (this.onUserSpeech && !this.isSpeaking) this.restartListening();
          }, 1000);
          resolve(true);
        };

        this.currentAudio.onerror = (err) => {
          console.error('[VoiceService] Audio playback error:', err);
          this.isSpeaking = false;
          URL.revokeObjectURL(audioUrl);
          if (onEnd) onEnd();
          resolve(false);
        };

        this.currentAudio.play()
          .then(() => console.log('[VoiceService] Audio.play() success'))
          .catch(err => { console.error('[VoiceService] Audio.play() rejected:', err); resolve(false); });
      });

    } catch (error) {
      console.error('[VoiceService] speakWithGemini exception:', error);
      return false;
    }
  }

  // ─── PCM → WAV CONVERSION ────────────────────────────────────────────────────
  // Gemini returns raw PCM (audio/L16) which browsers cannot play.
  // This wraps the PCM bytes in a proper 44-byte WAV header.
  pcmBase64ToWavBlob(base64, sampleRate = 24000) {
    const raw      = atob(base64);
    const pcmBytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) pcmBytes[i] = raw.charCodeAt(i);

    const numChannels   = 1;
    const bitsPerSample = 16;
    const byteRate      = sampleRate * numChannels * (bitsPerSample / 8);
    const blockAlign    = numChannels * (bitsPerSample / 8);
    const dataSize      = pcmBytes.length;
    const buffer        = new ArrayBuffer(44 + dataSize);
    const view          = new DataView(buffer);

    const writeStr = (offset, str) => {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    };

    writeStr(0,  'RIFF');
    view.setUint32(4,  36 + dataSize, true);
    writeStr(8,  'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16,            true); // PCM chunk size
    view.setUint16(20, 1,             true); // PCM format
    view.setUint16(22, numChannels,   true);
    view.setUint32(24, sampleRate,    true);
    view.setUint32(28, byteRate,      true);
    view.setUint16(32, blockAlign,    true);
    view.setUint16(34, bitsPerSample, true);
    writeStr(36, 'data');
    view.setUint32(40, dataSize,      true);
    new Uint8Array(buffer, 44).set(pcmBytes);

    return new Blob([buffer], { type: 'audio/wav' });
  }

  // ─── BROWSER TTS (LAST RESORT FALLBACK) ─────────────────────────────────────
  speakWithBrowser(text, onEnd = null) {
    console.log('[VoiceService] speakWithBrowser() — last resort fallback');

    if (!window.speechSynthesis) {
      this.isSpeaking = false;
      if (onEnd) onEnd();
      return;
    }

    window.speechSynthesis.cancel();
    const sentences = this.splitIntoSentences(text);
    if (sentences.length === 0) { this.isSpeaking = false; if (onEnd) onEnd(); return; }

    let index = 0;
    const speakNext = () => {
      if (index >= sentences.length) {
        this.isSpeaking = false;
        if (onEnd) onEnd();
        setTimeout(() => { if (this.onUserSpeech && !this.isSpeaking) this.restartListening(); }, 1000);
        return;
      }
      const sentence  = sentences[index++];
      const utterance = new SpeechSynthesisUtterance(sentence);
      utterance.lang   = this.language;
      utterance.rate   = 0.88;   // slightly faster feels more natural
      utterance.pitch  = 1.1;    // gentle feminine pitch, not exaggerated
      utterance.volume = 1.0;

      if (!this.cachedVoice) this.cachedVoice = this.pickFemaleVoice();
      if (this.cachedVoice && this.isMaleVoice(this.cachedVoice)) {
        this.cachedVoice = this.pickFemaleVoice();
      }
      if (this.cachedVoice) utterance.voice = this.cachedVoice;

      utterance.onend   = () => setTimeout(speakNext, this.pauseAfterSentence(sentence));
      utterance.onerror = () => setTimeout(speakNext, 300);
      window.speechSynthesis.speak(utterance);
    };

    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.onvoiceschanged = null;
        this.cachedVoice = null;
        speakNext();
      };
    } else {
      speakNext();
    }
  }

  // ─── CONVENIENCE METHODS ─────────────────────────────────────────────────────
  async speakAsAmy(text, onEnd = null)       { await this.speak(text, onEnd); }
  async speakSoothingly(text, onEnd = null)  { await this.speak(text, onEnd); }
  async speakCheerfully(text, onEnd = null)  { await this.speak(text, onEnd); }

  async speakNumberedList(items, onEnd = null) {
    const ones = ['','one','two','three','four','five','six','seven','eight','nine','ten'];
    const t = Array.isArray(items)
      ? items.map((item, i) => {
          const n = i + 1;
          return 'Number ' + (n <= 10 ? ones[n] : this.numberToWords(n)) + '. ' + item + '.';
        }).join('  ')
      : items;
    await this.speak(t, onEnd);
  }

  // ─── UTILITIES ───────────────────────────────────────────────────────────────
  base64ToBlob(base64, mimeType) {
    const bytes = atob(base64);
    const arr   = [];
    for (let i = 0; i < bytes.length; i += 512) {
      arr.push(new Uint8Array([...bytes.slice(i, i+512)].map(c => c.charCodeAt(0))));
    }
    return new Blob(arr, { type: mimeType });
  }

  startContinuousListening(callback) {
    if (!this.recognition) { console.error('[VoiceService] Speech recognition not available'); return false; }
    this.onUserSpeech = callback;
    if (this.isListening) return true;

    const start = () => setTimeout(() => this.startRecognition(), 500);
    if (navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: true }).then(start).catch(start);
    } else {
      start();
    }
    return true;
  }

  startRecognition() {
    if (this.isListening || this.isSpeaking) return false;
    try {
      this.recognition.start();
      return true;
    } catch (e) {
      setTimeout(() => { if (!this.isSpeaking) this.startRecognition(); }, 2000);
      return false;
    }
  }

  restartListening() {
    if (this.isSpeaking || this.isPaused) return;
    this.stopListening();
    setTimeout(() => this.startRecognition(), 1000);
  }

  pauseListening() {
    console.log('🔇 [VoiceService] Paused listening (Sleep Mode)');
    this.isPaused = true;
    this.stopListening();
  }

  resumeListening() {
    console.log('🔊 [VoiceService] Resumed listening');
    this.isPaused = false;
    this.restartListening();
  }

  stopListening() {
    if (this.recognition && this.isListening) {
      try { this.recognition.stop(); } catch (e) {}
      this.isListening = false;
    }
  }

  async stopSpeaking() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      // Cleanup the blob URL to prevent memory leaks
      if (this.currentAudio.src && this.currentAudio.src.startsWith('blob:')) {
        URL.revokeObjectURL(this.currentAudio.src);
      }
      this.currentAudio = null;
    }
    window.speechSynthesis?.cancel();
    this.isSpeaking = false;
  }

  isSpeechAvailable()           { return true; } // Backend provides TTS
  isVoiceRecognitionAvailable() { return !!this.recognition; }
}

const voiceService = new VoiceService();
export default voiceService;