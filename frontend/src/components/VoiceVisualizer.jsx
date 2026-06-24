import { useEffect, useRef } from 'react';

export default function VoiceVisualizer({ isListening, isSpeaking, audioLevel, userEngaged }) {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const barsRef = useRef(Array.from({ length: 64 }, () => 0));

  useEffect(() => {
    let audioContext;
    let analyser;
    let microphone;
    let dataArray;
    let stream;

    const setupAudio = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 128; // 64 frequency bins
        microphone = audioContext.createMediaStreamSource(stream);
        microphone.connect(analyser);
        dataArray = new Uint8Array(analyser.frequencyBinCount);
      } catch (err) {
        console.error("Error setting up Web Audio API:", err);
      }
    };

    // Only set up microphone if listening
    if (isListening) {
      setupAudio();
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    const resizeCanvas = () => {
      canvas.width = canvas.clientWidth * 2;
      canvas.height = 200;
    };
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const drawVisualizer = (time) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const radius = 80;
      const barCount = barsRef.current.length;
      
      // Update bars based on REAL audio level
      if (analyser && isListening) {
        analyser.getByteFrequencyData(dataArray);
        barsRef.current = barsRef.current.map((_, i) => {
          // Normalize byte to 0-1 and scale
          const target = (dataArray[i] / 255) * 80; 
          return target;
        });
      } else if (isSpeaking) {
        // Fallback or simulated for speaking if we don't have speaker loopback
        barsRef.current = barsRef.current.map((bar, i) => {
          const target = audioLevel * 100 * (0.5 + Math.sin(i * 0.3 + time * 0.005) * 0.5);
          return bar + (target - bar) * 0.1;
        });
      } else {
        barsRef.current = barsRef.current.map(bar => bar * 0.9);
      }

      // Draw circular visualizer (Jarvis-style)
      ctx.strokeStyle = isSpeaking ? '#FF6B6B' : isListening ? '#4ECDC4' : '#556270';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.stroke();

      // Draw bars
      barsRef.current.forEach((barHeight, i) => {
        const angle = (i / barCount) * Math.PI * 2;
        const barLength = radius + barHeight;
        const x1 = centerX + Math.cos(angle) * radius;
        const y1 = centerY + Math.sin(angle) * radius;
        const x2 = centerX + Math.cos(angle) * barLength;
        const y2 = centerY + Math.sin(angle) * barLength;
        
        // Gradient based on activity
        const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
        if (isSpeaking) {
          gradient.addColorStop(0, '#FF6B6B');
          gradient.addColorStop(1, '#FFE66D');
        } else if (isListening && userEngaged) {
          gradient.addColorStop(0, '#4ECDC4');
          gradient.addColorStop(1, '#556270');
        } else {
          gradient.addColorStop(0, '#556270');
          gradient.addColorStop(0.5, '#4ECDC4');
          gradient.addColorStop(1, '#FF6B6B');
        }
        
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      });

      // Draw center circle
      const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 30);
      gradient.addColorStop(0, isSpeaking ? '#FF6B6B80' : isListening ? '#4ECDC480' : '#55627080');
      gradient.addColorStop(1, 'transparent');
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 30, 0, Math.PI * 2);
      ctx.fill();

      // Draw pulse effect
      if (isSpeaking || (isListening && audioLevel > 0.1)) {
        const pulseSize = 40 + Math.sin(time * 0.01) * 10;
        ctx.strokeStyle = isSpeaking ? '#FF6B6B40' : '#4ECDC440';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(centerX, centerY, pulseSize, 0, Math.PI * 2);
        ctx.stroke();
      }

      animationRef.current = requestAnimationFrame(drawVisualizer);
    };

    animationRef.current = requestAnimationFrame(drawVisualizer);

    return () => {
      cancelAnimationFrame(animationRef.current);
      window.removeEventListener('resize', resizeCanvas);
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (audioContext && audioContext.state !== 'closed') {
        audioContext.close();
      }
    };
  }, [isListening, isSpeaking, audioLevel, userEngaged]);

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        className="w-full h-48 rounded-2xl bg-gradient-to-b from-white/10 to-transparent border border-white/20"
      />
      
      {/* Status text */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
        <div className="px-4 py-2 bg-white/90 backdrop-blur-sm rounded-full border border-gray-200">
          <span className="text-sm font-medium">
            {isSpeaking ? 'Assistant Speaking...' : 
             isListening ? 'Listening for voice...' : 
             'Voice system ready'}
          </span>
        </div>
      </div>
    </div>
  );
}