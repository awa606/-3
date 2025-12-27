
import React, { useState, useEffect, useRef } from 'react';
import ThreeScene, { ThreeSceneRef } from './components/ThreeScene';
import { handTrackingService } from './services/HandTrackingService';

const App: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [uiHidden, setUiHidden] = useState(false);
  const [handDetected, setHandDetected] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const sceneRef = useRef<ThreeSceneRef>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'h') setUiHidden(prev => !prev);
    };
    window.addEventListener('keydown', handleKeyDown);

    const setupCV = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: 640, height: 480, facingMode: "user" } 
        }).catch(err => {
          setCamError("Camera restricted - Hand tracking disabled");
          return null;
        });

        if (stream && videoRef.current) {
          videoRef.current.srcObject = stream;
          await handTrackingService.initialize(videoRef.current);
          
          const detectLoop = () => {
            const result = handTrackingService.detect();
            if (result && result.detected) {
              setHandDetected(true);
              const thumbTip = result.landmarks[4];
              const indexTip = result.landmarks[8];
              const palmCenter = result.landmarks[9];

              // 捏合手势检测
              const distance = Math.sqrt(
                Math.pow(thumbTip.x - indexTip.x, 2) + 
                Math.pow(thumbTip.y - indexTip.y, 2)
              );
              const isPinching = distance < 0.055;

              if (sceneRef.current) {
                sceneRef.current.updateHandInteraction(palmCenter.x, palmCenter.y, isPinching);
              }
            } else {
              setHandDetected(false);
            }
            requestAnimationFrame(detectLoop);
          };
          detectLoop();
        }
      } catch (err) {
        setCamError("Hand tracking service unavailable");
      }
    };

    setupCV();
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && sceneRef.current) {
      const url = URL.createObjectURL(file);
      sceneRef.current.addMemory(url);
    }
  };

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden select-none font-serif text-[#fceea7]">
      <ThreeScene ref={sceneRef} onLoad={() => setTimeout(() => setLoading(false), 1000)} />

      {/* Loading Screen */}
      <div className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-black transition-opacity duration-1000 ${loading ? 'opacity-100' : 'loader-fade-out'}`}>
        <div className="spinner mb-6"></div>
        <p className="tracking-[0.5em] text-[#d4af37] text-[10px] font-bold uppercase opacity-80">Assembling Holiday Magic</p>
      </div>

      {/* Main UI Overlay */}
      <div className={`relative z-10 w-full h-full flex flex-col items-center justify-between py-16 transition-all duration-1000 ease-in-out ${uiHidden ? 'ui-hidden' : 'opacity-100'}`}>
        <div className="text-center group">
          <h1 className="text-5xl md:text-8xl font-bold bg-gradient-to-b from-white via-[#fceea7] to-[#d4af37] bg-clip-text text-transparent drop-shadow-[0_0_25px_rgba(212,175,55,0.3)] transition-all duration-700">
            Merry Christmas
          </h1>
          <div className="h-[1px] w-24 mx-auto bg-gradient-to-r from-transparent via-[#d4af37] to-transparent mt-8 opacity-40"></div>
          <p className="mt-8 text-[#fceea7] opacity-40 italic tracking-[0.3em] text-[10px] uppercase">Where stars align with your spirit</p>
        </div>

        <div className="flex flex-col items-center space-y-10">
          <div className="upload-wrapper relative">
            <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="glass px-14 py-5 text-[#d4af37] border border-[#d4af37]/20 rounded-full tracking-[0.4em] hover:bg-[#d4af37] hover:text-black hover:border-white transition-all duration-500 shadow-2xl active:scale-95 text-[10px] font-black uppercase"
            >
              Add Memories
            </button>
          </div>
          
          <div className="text-center space-y-4">
             <p className="text-[#fceea7] text-[9px] opacity-30 uppercase tracking-[0.4em]">
              Tap <span className="text-[#d4af37] border border-[#d4af37]/30 px-2 py-0.5 rounded mx-1 font-sans">H</span> to Focus on Art
            </p>
            <div className={`flex items-center justify-center transition-all duration-500 ${handDetected ? 'opacity-100 scale-105' : 'opacity-30'}`}>
              <div className={`w-1 h-1 rounded-full mr-3 ${handDetected ? 'bg-amber-300 shadow-[0_0_12px_#fbbf24] animate-pulse' : 'bg-gray-600'}`}></div>
              <p className="text-[#fceea7] text-[8px] uppercase tracking-[0.2em] font-bold">
                {camError ? camError : (handDetected ? 'Soul Connection Active (Pinch to Pulse)' : 'Wave to connect with the stars')}
              </p>
            </div>
          </div>
        </div>
      </div>

      <video ref={videoRef} autoPlay playsInline muted className="hidden" />
      
      {/* Dynamic Ambient Background Glow */}
      <div className="fixed inset-0 pointer-events-none opacity-20 bg-[radial-gradient(circle_at_50%_50%,_#d4af37_0%,_transparent_75%)] transition-opacity duration-1000"></div>
    </div>
  );
};

export default App;
