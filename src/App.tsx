import React, { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { 
  Camera, 
  RefreshCw, 
  Zap, 
  Layout as LayoutIcon, 
  Timer, 
  Image as ImageIcon,
  Upload,
  Download,
  Menu,
  X,
  Settings,
  Type,
  History,
  ChevronDown,
  Power,
  PowerOff,
  Loader2,
  Sparkles,
  ChevronLeft,
  Share2,
  Check
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion, AnimatePresence } from 'motion/react';
import { removeBackground, mergeWithBackground, overlayForeground } from './services/geminiService';

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const LAYOUTS = [
  { id: '1x4', name: '1×4 Strips', icon: <LayoutIcon className="w-4 h-4" />, aspect: 'aspect-video' },
  { id: '2x2', name: '2×2 Grid', icon: <LayoutIcon className="w-4 h-4" />, aspect: 'aspect-square' },
  { id: 'single', name: 'Single Shot', icon: <ImageIcon className="w-4 h-4" />, aspect: 'aspect-video' },
  { id: 'editorial', name: 'Editorial (Vertical)', icon: <Type className="w-4 h-4" />, aspect: 'aspect-[2/3]' },
];

const TIMERS = [
  { id: 3, name: '3s' },
  { id: 5, name: '5s' },
  { id: 10, name: '10s' },
];

const FILTERS = [
  { id: 'normal', name: 'Original', class: '' },
  { id: 'mono', name: 'Retro Mono', class: 'grayscale contrast-125' },
  { id: 'sepia', name: 'Aged Sepia', class: 'sepia contrast-110 brightness-90' },
  { id: 'high-contrast', name: 'Press Print', class: 'contrast-200 grayscale' },
  { id: 'soft', name: 'Soft Focus', class: 'blur-[0.5px] brightness-110' },
  { id: 'grain', name: 'Film Grain', class: 'contrast-125 brightness-105' },
];

const EFFECTS = [
  { id: 'timestamp', name: 'Timestamp', icon: <History className="w-4 h-4" /> },
  { id: 'vignette', name: 'Vignette', icon: <ImageIcon className="w-4 h-4" /> },
  { id: 'noise', name: 'Noise', icon: <Type className="w-4 h-4" /> },
];

const FRAMES = [
  { 
    id: 'queva', 
    name: 'QUEVA', 
    bg: '/frame 01/Queva layer 1.png', 
    fg: '/frame 01/Queva layer 3.png',
    thumbnail: '/frame 01/Queva layer 1.png'
  },
  { 
    id: 'numero', 
    name: 'NUMERO', 
    bg: '/frame 02/Numero layer 1.png', 
    fg: null,
    thumbnail: '/frame 02/Numero layer 1.png'
  },
  { 
    id: 'vogue', 
    name: 'VOGUE', 
    bg: '/frame 03/VOGUE layer 1.png', 
    fg: null,
    thumbnail: '/frame 03/VOGUE layer 1.png'
  }
];

export default function App() {
  const [capturedPhotos, setCapturedPhotos] = useState<(string | null)[]>([null]);
  const [currentLayout, setCurrentLayout] = useState('1x4');
  const [currentTimer, setCurrentTimer] = useState(3);
  const [currentFilter, setCurrentFilter] = useState('normal');
  const [isAuto, setIsAuto] = useState(false);
  const [isFlash, setIsFlash] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // New states for Preview Page
  const [view, setView] = useState<'capture' | 'preview'>('capture');
  const [selectedFrameId, setSelectedFrameId] = useState('queva');
  const [defaultFrameId, setDefaultFrameId] = useState('queva');
  const [transparentPerson, setTransparentPerson] = useState<string | null>(null);
  const [finalResult, setFinalResult] = useState<string | null>(null);

  const webcamRef = useRef<Webcam>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setCapturedPhotos(prev => {
          const next = [...prev];
          const emptyIndex = next.findIndex(p => p === null);
          if (emptyIndex !== -1) {
            next[emptyIndex] = result;
          }
          return next;
        });
      };
      reader.readAsDataURL(file);
    }
    // Reset input value to allow uploading the same file again
    if (event.target) event.target.value = '';
  };

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      setCapturedPhotos(prev => {
        const next = [...prev];
        const emptyIndex = next.findIndex(p => p === null);
        if (emptyIndex !== -1) {
          next[emptyIndex] = imageSrc;
        }
        return next;
      });
    }
  }, [webcamRef]);

  const handleCaptureClick = () => {
    let count = currentTimer;
    setCountdown(count);
    const interval = setInterval(() => {
      count -= 1;
      if (count <= 0) {
        clearInterval(interval);
        setCountdown(null);
        capture();
      } else {
        setCountdown(count);
      }
    }, 1000);
  };

  const resetPhotos = () => {
    setCapturedPhotos([null]);
  };

  const addSlot = async () => {
    if (capturedPhotos[0]) {
      setIsProcessing(true);
      try {
        // Step 1: Remove Background
        const transparentImage = await removeBackground(capturedPhotos[0]);
        setTransparentPerson(transparentImage);
        
        // Step 2: Generate Initial Merge (based on defaultFrameId)
        const frame = FRAMES.find(f => f.id === defaultFrameId)!;
        let merged = await mergeWithBackground(transparentImage, frame.bg);
        if (frame.fg) {
          merged = await overlayForeground(merged, frame.fg);
        }
        
        setFinalResult(merged);
        setSelectedFrameId(defaultFrameId);
        setView('preview');
      } catch (error) {
        console.error("Automated printing failed:", error);
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const switchFrame = async (frameId: string) => {
    if (!transparentPerson) return;
    
    setIsProcessing(true);
    setSelectedFrameId(frameId);
    try {
      const frame = FRAMES.find(f => f.id === frameId)!;
      let merged = await mergeWithBackground(transparentPerson, frame.bg);
      if (frame.fg) {
        merged = await overlayForeground(merged, frame.fg);
      }
      setFinalResult(merged);
    } catch (error) {
      console.error("Frame switch failed:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadResult = () => {
    if (!finalResult) return;
    const link = document.createElement('a');
    link.href = finalResult;
    link.download = `daily-snap-${selectedFrameId}-${Date.now()}.png`;
    link.click();
  };

  if (view === 'preview') {
    return (
      <div className="min-h-screen bg-paper text-ink flex flex-col font-sans selection:bg-press-red selection:text-white">
        {/* Header */}
        <header className="p-6 flex justify-between items-center border-b-4 border-ink bg-paper sticky top-0 z-50">
          <button 
            onClick={() => setView('capture')}
            className="flex items-center gap-2 px-4 py-2 border border-ink hover:bg-ink hover:text-paper transition-all font-mono text-xs uppercase tracking-widest"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Darkroom
          </button>
          
          <div className="flex flex-col items-center">
            <h2 className="font-display text-4xl tracking-tighter uppercase">Edition Preview</h2>
            <div className="flex items-center gap-4 border-y border-ink/20 py-0.5 px-4 mt-1">
              <span className="font-serif italic text-[10px] opacity-60">"Final Verification Phase"</span>
              <span className="font-mono text-[8px] uppercase tracking-[0.2em] opacity-40">Vol. LXIV</span>
            </div>
          </div>

          <div className="flex gap-3">
            <button className="p-2 border border-ink hover:bg-ink hover:text-paper transition-all">
              <Share2 className="w-4 h-4" />
            </button>
            <button 
              onClick={downloadResult}
              className="flex items-center gap-2 px-6 py-2 bg-ink text-paper hover:bg-press-red transition-all font-display text-sm uppercase tracking-tight"
            >
              <Download className="w-4 h-4" />
              Export Print
            </button>
          </div>
        </header>

        <main className="flex-grow grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
          {/* Left: Frame Selector */}
          <aside className="lg:col-span-2 border-r-2 border-ink p-6 flex flex-col gap-6 bg-paper">
            <div className="space-y-1 border-b border-ink/20 pb-4">
              <h3 className="font-display text-lg uppercase italic">Select Frame</h3>
              <p className="font-serif text-[10px] opacity-60 leading-tight">
                Choose the editorial layout for your story. Each frame is a testament to the power of the press.
              </p>
            </div>

            <div className="flex flex-col gap-4">
              {FRAMES.map(frame => (
                <button
                  key={frame.id}
                  onClick={() => switchFrame(frame.id)}
                  disabled={isProcessing}
                  className={cn(
                    "group relative flex flex-col border-2 transition-all duration-300 overflow-hidden",
                    selectedFrameId === frame.id 
                      ? "border-ink shadow-[4px_4px_0px_rgba(26,26,26,1)]" 
                      : "border-ink/10 hover:border-ink/40 opacity-60 hover:opacity-100"
                  )}
                >
                  <div className="aspect-[4/3] bg-ink/5 overflow-hidden halftone">
                    <img 
                      src={frame.thumbnail} 
                      alt={frame.name} 
                      className={cn(
                        "w-full h-full object-cover transition-transform duration-700",
                        selectedFrameId === frame.id ? "scale-110" : "group-hover:scale-105"
                      )} 
                    />
                  </div>
                  <div className="p-3 flex justify-between items-center bg-paper border-t border-ink/10">
                    <span className="font-display text-base uppercase tracking-tight">{frame.name}</span>
                    {selectedFrameId === frame.id && <Check className="w-4 h-4 text-ink" />}
                  </div>
                  {isProcessing && selectedFrameId === frame.id && (
                    <div className="absolute inset-0 bg-paper/60 flex items-center justify-center backdrop-blur-[1px]">
                      <Loader2 className="w-6 h-6 animate-spin text-ink" />
                    </div>
                  )}
                </button>
              ))}
            </div>

            <div className="mt-auto pt-8 border-t-2 border-ink space-y-4">
              <div className="flex justify-between items-center font-mono text-[10px] uppercase tracking-widest opacity-40">
                <span>Print Quality</span>
                <span>300 DPI</span>
              </div>
              <div className="flex justify-between items-center font-mono text-[10px] uppercase tracking-widest opacity-40">
                <span>Paper Stock</span>
                <span>Matte Newsprint</span>
              </div>
            </div>
          </aside>

          {/* Center: Main Preview */}
          <section className="lg:col-span-10 p-12 bg-paper relative flex items-center justify-center overflow-auto">
            <div className="absolute inset-0 opacity-5 pointer-events-none news-grid"></div>
            
            <AnimatePresence mode="wait">
              <motion.div 
                key={finalResult || 'loading'}
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 1.05, y: -20 }}
                transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
                className="relative w-full max-w-[520px] aspect-[2/3] shadow-[20px_20px_0px_rgba(26,26,26,0.1)] border-4 border-ink/5 overflow-hidden"
              >
                {finalResult ? (
                  <img 
                    src={finalResult} 
                    alt="Final Result" 
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="w-full h-full bg-ink/5 flex flex-col items-center justify-center gap-4">
                    <Loader2 className="w-12 h-12 animate-spin opacity-20" />
                    <span className="font-mono text-[10px] uppercase tracking-[0.3em] opacity-20">Rendering...</span>
                  </div>
                )}

                {/* Decorative Elements */}
                <div className="absolute -top-6 -left-6 font-mono text-[10px] uppercase tracking-widest opacity-20 rotate-90 origin-bottom-left">
                  Proof No. {Math.floor(Math.random() * 10000)}
                </div>
                <div className="absolute -bottom-6 -right-6 font-mono text-[10px] uppercase tracking-widest opacity-20">
                  Daily Snap Archives © 1924
                </div>
              </motion.div>
            </AnimatePresence>

            {isProcessing && (
              <div className="absolute inset-0 bg-paper/20 backdrop-blur-[1px] z-10 pointer-events-none" />
            )}
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col p-4 md:p-8 max-w-7xl mx-auto selection:bg-press-red selection:text-white">
      {/* Masthead */}
      <header className="border-b-4 border-ink pb-4 mb-8 text-center relative">
        <div className="flex justify-between items-center absolute top-0 left-0 right-0 px-2 pt-1">
          <span className="font-mono text-[10px] uppercase tracking-widest opacity-60">Vol. LXIV ... No. 24,026</span>
          <span className="font-mono text-[10px] uppercase tracking-widest opacity-60">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </div>
        
        <h1 className="font-display text-6xl md:text-8xl tracking-tighter uppercase mt-4">
          The Daily Snap
        </h1>
        <div className="border-y border-ink py-1 mt-2 flex justify-center gap-8">
          <span className="font-serif italic text-sm opacity-80">"All the news that's fit to print"</span>
          <span className="font-serif italic text-sm opacity-80">Est. 1924</span>
        </div>

        <button className="absolute left-0 bottom-6 p-2 border border-ink hover:bg-ink hover:text-paper transition-colors">
          <Menu className="w-5 h-5" />
        </button>

        <div className="absolute right-0 bottom-6 flex gap-2">
        </div>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-grow">
        {/* Left Column: Controls & Viewfinder */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          
          {/* Editorial Controls */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-ink pb-6">
            <div className="space-y-2">
              <label className="font-mono text-[10px] uppercase tracking-widest opacity-60">Layout Selection</label>
              <div className="relative">
                <select 
                  value={currentLayout}
                  onChange={(e) => setCurrentLayout(e.target.value)}
                  className="w-full py-2 pl-3 pr-10 border border-ink text-xs font-mono uppercase bg-paper focus:outline-none focus:ring-1 focus:ring-ink appearance-none cursor-pointer hover:bg-ink/5 transition-colors"
                >
                  {LAYOUTS.map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none opacity-60" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="font-mono text-[10px] uppercase tracking-widest opacity-60">Shutter Delay</label>
              <div className="relative">
                <select 
                  value={currentTimer}
                  onChange={(e) => setCurrentTimer(Number(e.target.value))}
                  className="w-full py-2 pl-3 pr-10 border border-ink text-xs font-mono uppercase bg-paper focus:outline-none focus:ring-1 focus:ring-ink appearance-none cursor-pointer hover:bg-ink/5 transition-colors"
                >
                  {TIMERS.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none opacity-60" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="font-mono text-[10px] uppercase tracking-widest opacity-60">Frame Style</label>
              <button className="w-full py-2 border border-ink text-xs font-mono uppercase hover:bg-ink hover:text-paper transition-all flex items-center justify-center gap-2">
                <Settings className="w-4 h-4" />
                Select Frame
              </button>
            </div>
          </section>

          {/* Viewfinder Area - Stable Container */}
          <section className="relative w-full aspect-video bg-zinc-950 border-4 border-ink shadow-[8px_8px_0px_rgba(26,26,26,0.1)] overflow-hidden group mx-auto">
            {/* Darkroom Backdrop */}
            <div className="absolute inset-0 opacity-20 pointer-events-none news-grid"></div>
            
            {/* Dynamic Camera Frame */}
            <div className="absolute inset-0 flex items-center justify-center p-4">
              <div className={cn(
                "relative transition-all duration-700 ease-in-out shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden border-2 border-paper/20",
                LAYOUTS.find(l => l.id === currentLayout)?.aspect || 'aspect-video',
                "h-full max-w-full"
              )}>
                {/* Camera Feed */}
                <div className={cn(
                  "w-full h-full transition-all duration-500 bg-zinc-900",
                  FILTERS.find(f => f.id === currentFilter)?.class
                )}>
                  {isCameraOn ? (
                    <Webcam
                      audio={false}
                      ref={webcamRef}
                      screenshotFormat="image/jpeg"
                      className="w-full h-full object-contain"
                      videoConstraints={{ facingMode: 'user' }}
                      disablePictureInPicture={false}
                      forceScreenshotSourceSize={false}
                      imageSmoothing={true}
                      mirrored={true}
                      onUserMedia={() => {}}
                      onUserMediaError={() => {}}
                      onScreenshot={() => {}}
                      screenshotQuality={0.92}
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-4 text-paper/20 bg-zinc-900">
                      <PowerOff className="w-12 h-12" />
                      <span className="font-mono text-[10px] uppercase tracking-[0.2em]">No Signal</span>
                    </div>
                  )}
                </div>

                {/* Frame Corner Marks */}
                <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-white/40"></div>
                <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-white/40"></div>
                <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-white/40"></div>
                <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-white/40"></div>
              </div>
            </div>

            {/* Viewfinder Overlays - Pinned to the stable container edges */}
            <div className="absolute inset-0 z-20 pointer-events-none flex flex-col justify-between p-6 font-mono">
              <div className="flex justify-between items-start">
                <div className={cn(
                  "flex items-center gap-3 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-all duration-300",
                  isCameraOn ? "bg-ink text-paper" : "bg-press-red text-white"
                )}>
                  <div className={cn("w-2 h-2 rounded-full", isCameraOn ? "bg-press-red animate-pulse" : "bg-white")} />
                  {isCameraOn ? "Press Feed" : "Standby"}
                </div>
                <div className="text-paper/80 text-[10px] bg-black/40 px-3 py-1.5 backdrop-blur-md border border-white/10">
                  REC <span className="text-press-red">●</span> 00:24:02:15
                </div>
              </div>

              {countdown !== null && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-auto">
                  <AnimatePresence mode="wait">
                    <motion.span 
                      key={countdown}
                      initial={{ scale: 2, opacity: 0, rotate: -10 }}
                      animate={{ scale: 1, opacity: 1, rotate: 0 }}
                      exit={{ scale: 0.5, opacity: 0, rotate: 10 }}
                      className="text-9xl font-display text-white drop-shadow-[0_0_30px_rgba(0,0,0,0.8)] italic"
                    >
                      {countdown}
                    </motion.span>
                  </AnimatePresence>
                </div>
              )}

              <div className="flex justify-between items-end">
                <div className="flex flex-col gap-1">
                  <div className="text-paper/60 text-[9px] uppercase tracking-widest">Exposure Index</div>
                  <div className="text-paper text-[10px] bg-black/40 px-3 py-1.5 backdrop-blur-md border border-white/10 uppercase">
                    Layout: {LAYOUTS.find(l => l.id === currentLayout)?.name}
                  </div>
                </div>
                <div className="flex gap-3 pointer-events-auto">
                  <button 
                    onClick={() => setIsCameraOn(!isCameraOn)}
                    className={cn(
                      "p-2.5 border transition-all duration-300 backdrop-blur-md", 
                      !isCameraOn 
                        ? "bg-press-red border-press-red text-white shadow-[0_0_15px_rgba(196,30,58,0.5)]" 
                        : "bg-black/40 border-white/20 text-paper hover:bg-white/10"
                    )}
                    title={isCameraOn ? "Power Down" : "Power Up"}
                  >
                    {isCameraOn ? <Power className="w-5 h-5" /> : <PowerOff className="w-5 h-5" />}
                  </button>
                  <button 
                    onClick={() => setIsFlash(!isFlash)}
                    className={cn(
                      "p-2.5 border transition-all duration-300 backdrop-blur-md", 
                      isFlash 
                        ? "bg-yellow-400 border-yellow-400 text-ink shadow-[0_0_15px_rgba(250,204,21,0.5)]" 
                        : "bg-black/40 border-white/20 text-paper hover:bg-white/10"
                    )}
                  >
                    <Zap className="w-5 h-5" />
                  </button>
                  <button className="p-2.5 bg-black/40 border border-white/20 text-paper hover:bg-white/10 backdrop-blur-md transition-all">
                    <RefreshCw className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Action Buttons */}
          <section className="flex flex-wrap items-center justify-center gap-6 py-4 border-y border-ink">
            <div className="flex flex-col items-center gap-2">
              <button 
                onClick={handleCaptureClick}
                className="w-20 h-20 rounded-full border-4 border-ink flex items-center justify-center hover:bg-ink hover:text-paper transition-all group"
              >
                <Camera className="w-10 h-10 group-active:scale-90 transition-transform" />
              </button>
              <span className="font-mono text-[10px] uppercase tracking-widest">Manual</span>
            </div>

            <div className="flex flex-col items-center gap-2">
              <button 
                onClick={() => setIsAuto(!isAuto)}
                className={cn(
                  "w-24 h-24 rounded-full border-4 border-ink flex flex-col items-center justify-center transition-all group",
                  isAuto ? "bg-press-red text-white border-press-red" : "hover:bg-ink hover:text-paper"
                )}
              >
                <span className="font-display text-xl leading-none">AUTO</span>
                <span className="font-mono text-[8px] uppercase tracking-tighter">Sequence</span>
              </button>
              <span className="font-mono text-[10px] uppercase tracking-widest">Automatic</span>
            </div>

            <div className="flex flex-col items-center gap-2">
              <button 
                onClick={resetPhotos}
                className="w-20 h-20 rounded-full border-4 border-ink flex items-center justify-center hover:bg-ink hover:text-paper transition-all group"
              >
                <RefreshCw className="w-10 h-10 group-active:rotate-180 transition-transform duration-500" />
              </button>
              <span className="font-mono text-[10px] uppercase tracking-widest">Retake</span>
            </div>

            <div className="flex flex-col items-center gap-2">
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-20 h-20 rounded-full border-4 border-ink flex items-center justify-center hover:bg-ink hover:text-paper transition-all group"
              >
                <Upload className="w-10 h-10 group-active:scale-90 transition-transform" />
              </button>
              <span className="font-mono text-[10px] uppercase tracking-widest">Upload</span>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={handleFileUpload}
              />
            </div>
          </section>

          {/* Filters & Effects */}
          <section className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <h3 className="font-display text-xl uppercase italic">Darkroom Filters</h3>
                <div className="flex-grow h-px bg-ink/20" />
              </div>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                {FILTERS.map(f => (
                  <button
                    key={f.id}
                    onClick={() => setCurrentFilter(f.id)}
                    className={cn(
                      "py-2 px-1 border border-ink text-[10px] font-mono uppercase transition-all",
                      currentFilter === f.id ? "bg-ink text-paper shadow-[4px_4px_0px_rgba(26,26,26,0.2)]" : "hover:bg-ink/5"
                    )}
                  >
                    {f.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <h3 className="font-display text-xl uppercase italic">Press Effects</h3>
                <div className="flex-grow h-px bg-ink/20" />
              </div>
              <div className="flex flex-wrap gap-4">
                {EFFECTS.map(e => (
                  <button
                    key={e.id}
                    className="flex items-center gap-2 py-1 px-3 border border-ink/30 rounded-full text-xs font-mono hover:border-ink hover:bg-ink/5 transition-all"
                  >
                    {e.icon}
                    {e.name}
                  </button>
                ))}
              </div>
            </div>
          </section>
        </div>

        {/* Right Column: Classifieds (Captured Photos) */}
        <div className="lg:col-span-4 border-l-2 border-ink pl-8 flex flex-col">
          <div className="border-b-2 border-ink pb-2 mb-6">
            <h2 className="font-display text-3xl uppercase text-center">Classifieds</h2>
            <p className="font-mono text-[10px] uppercase tracking-widest text-center opacity-60">Latest Captures</p>
          </div>

          <div className="flex-grow flex flex-col gap-4">
            {capturedPhotos.map((photo, i) => (
              <div key={i} className="space-y-2">
                <div className="font-mono text-[10px] uppercase tracking-widest opacity-60">{i === 0 ? "Step 1: Capture" : "Step 2: Final Edition"}</div>
                <div className="group relative aspect-[2/3] bg-ink/5 border border-ink overflow-hidden halftone transition-all duration-500">
                  <div className={cn(
                    "w-full h-full flex items-center justify-center transition-all duration-500",
                    photo ? "" : "opacity-30 group-hover:opacity-50"
                  )}>
                    {photo ? (
                      <div className={cn(
                        "h-full transition-all duration-500",
                        LAYOUTS.find(l => l.id === currentLayout)?.aspect || 'aspect-[2/3]'
                      )}>
                        <img src={photo} alt={`Capture ${i + 1}`} className={cn("w-full h-full object-contain", FILTERS.find(f => f.id === currentFilter)?.class)} />
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-2">
                        <ImageIcon className="w-8 h-8" />
                        <span className="font-mono text-[10px] uppercase tracking-widest">Slot {i + 1}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="absolute bottom-0 left-0 right-0 p-2 bg-ink text-paper font-mono text-[8px] uppercase flex justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                    <span>Photo No. {String(i + 1).padStart(3, '0')}</span>
                    <button className="hover:text-press-red transition-colors">
                      <Upload className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 space-y-4">
            <div className="border-t-2 border-ink pt-4">
              <div className="flex justify-between items-end mb-2">
                <span className="font-mono text-[10px] uppercase tracking-widest">Edition Progress</span>
                <span className="font-display text-2xl">{capturedPhotos.filter(p => p !== null).length} / 2</span>
              </div>
              <div className="flex gap-1 h-3">
                {[0, 1].map((idx) => (
                  <div 
                    key={idx} 
                    className={cn(
                      "flex-1 border border-ink transition-colors duration-300",
                      capturedPhotos[idx] ? "bg-ink" : "bg-transparent"
                    )}
                  />
                ))}
              </div>
              <p className="font-mono text-[8px] uppercase tracking-tighter mt-2 opacity-60">
                {capturedPhotos.length < 2 ? "Click Print Edition to finalize" : "Edition Complete"}
              </p>
            </div>

            <div className="flex flex-col items-center gap-4">
              <div className="flex gap-2">
                {[
                  { id: 'queva', label: '1' },
                  { id: 'numero', label: '2' },
                  { id: 'vogue', label: '3' }
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setDefaultFrameId(f.id)}
                    className={cn(
                      "w-8 h-8 rounded-full border-2 border-ink flex items-center justify-center font-mono text-xs transition-all",
                      defaultFrameId === f.id ? "bg-ink text-paper" : "hover:bg-ink/10"
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <button 
                onClick={addSlot}
                disabled={capturedPhotos.length >= 2 || isProcessing || !capturedPhotos[0]}
                className="w-full py-4 bg-ink text-paper font-display text-2xl uppercase tracking-tighter hover:bg-press-red disabled:opacity-50 disabled:hover:bg-ink transition-colors flex items-center justify-center gap-3 relative overflow-hidden"
              >
              {isProcessing ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  Printing Final Edition...
                </>
              ) : (
                <>
                  <Download className="w-6 h-6" />
                  Print Edition
                </>
              )}
              {isProcessing && (
                <motion.div 
                  className="absolute inset-0 bg-white/10"
                  animate={{ x: ['-100%', '100%'] }}
                  transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                />
              )}
            </button>
          </div>
            
            <p className="font-serif italic text-[10px] text-center opacity-60">
              * High-quality newsprint finish applied upon export.
            </p>
          </div>
        </div>
      </main>

      <footer className="mt-12 pt-8 border-t-4 border-ink grid grid-cols-1 md:grid-cols-3 gap-8 pb-8">
        <div className="space-y-2">
          <h4 className="font-display text-lg uppercase">The Editor's Note</h4>
          <p className="font-serif text-xs leading-relaxed opacity-80">
            Our mission is to capture the fleeting moments of today for the archives of tomorrow. Each snap is a story, each frame a headline.
          </p>
        </div>
        <div className="flex flex-col items-center justify-center border-x border-ink/20 px-4">
          <div className="w-16 h-16 border-2 border-ink rounded-full flex items-center justify-center mb-2">
            <span className="font-display text-2xl">10¢</span>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-widest">Price per copy</span>
        </div>
        <div className="flex flex-col items-end justify-between">
          <div className="flex gap-4">
            <button className="p-2 border border-ink hover:bg-ink hover:text-paper transition-all">
              <Settings className="w-4 h-4" />
            </button>
            <button className="p-2 border border-ink hover:bg-ink hover:text-paper transition-all">
              <X className="w-4 h-4" />
            </button>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-widest opacity-60">© 1924-2024 The Daily Snap Publishing Co.</span>
        </div>
      </footer>
    </div>
  );
}
